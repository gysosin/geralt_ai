"""
Agent platform service.

Persists reusable agent and workflow definitions while validating every tool
reference against the central registry.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from core.agents.tool_executor import get_agent_tool_executor
from core.agents.tool_registry import get_agent_tool_registry
from models.database import (
    agent_definitions_collection,
    workflow_definitions_collection,
    workflow_runs_collection,
)
from services.collections import BaseService, ServiceResult


class AgentPlatformService(BaseService):
    """CRUD service for agent and workflow definitions."""

    def __init__(
        self,
        agent_db=None,
        workflow_db=None,
        run_db=None,
        tool_executor=None,
    ) -> None:
        super().__init__()
        self.agent_db = agent_db or agent_definitions_collection
        self.workflow_db = workflow_db or workflow_definitions_collection
        self.run_db = run_db or workflow_runs_collection
        self.tool_executor = tool_executor or get_agent_tool_executor()
        self.registry = get_agent_tool_registry()

    def create_agent(
        self,
        owner: str,
        name: str,
        instruction: str,
        tool_names: List[str],
        description: Optional[str] = None,
        model: Optional[str] = None,
        collection_ids: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ServiceResult:
        """Create a reusable agent definition."""
        validation_error = self._validate_tools(tool_names)
        if validation_error:
            return validation_error

        if not name.strip():
            return ServiceResult.fail("Agent name is required", 400)
        if not instruction.strip():
            return ServiceResult.fail("Agent instruction is required", 400)

        now = datetime.utcnow().isoformat()
        agent_id = str(uuid4())
        document = {
            "agent_id": agent_id,
            "name": name.strip(),
            "description": description or "",
            "instruction": instruction.strip(),
            "tool_names": tool_names,
            "model": model or "default",
            "collection_ids": collection_ids or [],
            "metadata": metadata or {},
            "created_by": self.extract_username(owner),
            "created_at": now,
            "updated_at": now,
            "deleted": False,
        }
        self.agent_db.insert_one(document)
        return ServiceResult.ok(self._public_document(document), status_code=201)

    def list_agents(self, owner: str) -> ServiceResult:
        """List non-deleted agents owned by a user."""
        username = self.extract_username(owner)
        docs = self.agent_db.find({"created_by": username, "deleted": {"$ne": True}}, {"_id": 0})
        return ServiceResult.ok([self._public_document(doc) for doc in docs])

    def get_agent(self, owner: str, agent_id: str) -> ServiceResult:
        """Get a single agent owned by a user."""
        username = self.extract_username(owner)
        doc = self.agent_db.find_one(
            {"agent_id": agent_id, "created_by": username, "deleted": {"$ne": True}},
            {"_id": 0},
        )
        if not doc:
            return ServiceResult.fail("Agent not found", 404)
        return ServiceResult.ok(self._public_document(doc))

    def create_workflow(
        self,
        owner: str,
        name: str,
        steps: List[Dict[str, Any]],
        description: Optional[str] = None,
        agent_id: Optional[str] = None,
        triggers: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ServiceResult:
        """Create a reusable workflow definition."""
        if not name.strip():
            return ServiceResult.fail("Workflow name is required", 400)
        if not steps:
            return ServiceResult.fail("Workflow requires at least one step", 400)

        normalized_steps = []
        for index, step in enumerate(steps, start=1):
            tool_name = step.get("tool_name")
            validation_error = self._validate_tools([tool_name])
            if validation_error:
                return validation_error
            normalized_steps.append({
                "step_id": step.get("step_id") or f"step-{index}",
                "name": step.get("name") or f"Step {index}",
                "tool_name": tool_name,
                "arguments": step.get("arguments") or {},
                "depends_on": step.get("depends_on") or [],
                "approval_required": bool(step.get("approval_required", False)),
            })

        now = datetime.utcnow().isoformat()
        workflow_id = str(uuid4())
        document = {
            "workflow_id": workflow_id,
            "name": name.strip(),
            "description": description or "",
            "agent_id": agent_id,
            "steps": normalized_steps,
            "triggers": triggers or [],
            "metadata": metadata or {},
            "created_by": self.extract_username(owner),
            "created_at": now,
            "updated_at": now,
            "deleted": False,
        }
        self.workflow_db.insert_one(document)
        return ServiceResult.ok(self._public_document(document), status_code=201)

    def list_workflows(self, owner: str) -> ServiceResult:
        """List non-deleted workflows owned by a user."""
        username = self.extract_username(owner)
        docs = self.workflow_db.find({"created_by": username, "deleted": {"$ne": True}}, {"_id": 0})
        return ServiceResult.ok([self._public_document(doc) for doc in docs])

    def get_workflow(self, owner: str, workflow_id: str) -> ServiceResult:
        """Get a single workflow owned by a user."""
        username = self.extract_username(owner)
        doc = self.workflow_db.find_one(
            {"workflow_id": workflow_id, "created_by": username, "deleted": {"$ne": True}},
            {"_id": 0},
        )
        if not doc:
            return ServiceResult.fail("Workflow not found", 404)
        return ServiceResult.ok(self._public_document(doc))

    def start_workflow_run(
        self,
        owner: str,
        workflow_id: str,
        inputs: Optional[Dict[str, Any]] = None,
        dry_run: bool = True,
    ) -> ServiceResult:
        """Create a workflow run record and execute safe deterministic steps."""
        workflow_result = self.get_workflow(owner, workflow_id)
        if not workflow_result.success:
            return workflow_result

        inputs = inputs or {}
        now = datetime.utcnow().isoformat()
        run_id = str(uuid4())
        planned_steps = [
            self._plan_run_step(step, inputs, dry_run=dry_run)
            for step in workflow_result.data.get("steps", [])
        ]

        if dry_run:
            status = "planned"
        elif all(step["status"] == "completed" for step in planned_steps):
            status = "completed"
        else:
            status = "pending"

        document = {
            "run_id": run_id,
            "workflow_id": workflow_id,
            "status": status,
            "dry_run": dry_run,
            "inputs": inputs,
            "steps": planned_steps,
            "created_by": self.extract_username(owner),
            "created_at": now,
            "updated_at": now,
        }
        self.run_db.insert_one(document)
        return ServiceResult.ok(self._public_document(document), status_code=201)

    def list_workflow_runs(self, owner: str, workflow_id: Optional[str] = None) -> ServiceResult:
        """List workflow runs for the current owner."""
        query = {"created_by": self.extract_username(owner)}
        if workflow_id:
            query["workflow_id"] = workflow_id
        docs = self.run_db.find(query, {"_id": 0})
        return ServiceResult.ok([self._public_document(doc) for doc in docs])

    def _validate_tools(self, tool_names: List[Optional[str]]) -> Optional[ServiceResult]:
        missing = [
            tool_name
            for tool_name in tool_names
            if not tool_name or not self.registry.get_tool(tool_name)
        ]
        if missing:
            return ServiceResult.fail(f"Unknown agent tool(s): {', '.join(missing)}", 400)
        return None

    def _public_document(self, document: Dict[str, Any]) -> Dict[str, Any]:
        public = dict(document)
        public.pop("_id", None)
        return public

    def _plan_run_step(
        self,
        step: Dict[str, Any],
        inputs: Dict[str, Any],
        dry_run: bool,
    ) -> Dict[str, Any]:
        arguments = self._resolve_arguments(step.get("arguments") or {}, inputs)
        planned = {
            "step_id": step["step_id"],
            "name": step["name"],
            "tool_name": step["tool_name"],
            "arguments": arguments,
            "depends_on": step.get("depends_on", []),
            "approval_required": step.get("approval_required", False),
            "status": "planned",
            "output": None,
            "message": "",
        }
        if dry_run:
            return planned

        try:
            planned["output"] = self.tool_executor.execute(step["tool_name"], arguments)
            planned["status"] = "completed"
            return planned
        except NotImplementedError as e:
            planned["status"] = "pending"
            planned["message"] = str(e)
            return planned

        except Exception as e:
            planned["status"] = "failed"
            planned["message"] = str(e)
        return planned

    def _resolve_arguments(self, value: Any, inputs: Dict[str, Any]) -> Any:
        if isinstance(value, dict):
            return {key: self._resolve_arguments(item, inputs) for key, item in value.items()}
        if isinstance(value, list):
            return [self._resolve_arguments(item, inputs) for item in value]
        if isinstance(value, str) and value.startswith("{{input.") and value.endswith("}}"):
            key = value[len("{{input."):-2].strip()
            return inputs.get(key)
        return value


_agent_platform_service: Optional[AgentPlatformService] = None


def get_agent_platform_service() -> AgentPlatformService:
    """Return the singleton agent platform service."""
    global _agent_platform_service
    if _agent_platform_service is None:
        _agent_platform_service = AgentPlatformService()
    return _agent_platform_service
