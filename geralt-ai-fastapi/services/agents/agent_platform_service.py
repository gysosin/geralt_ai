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
from core.agents.workflow_templates import get_workflow_template_registry
from models.database import (
    agent_definitions_collection,
    agent_audit_collection,
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
        audit_db=None,
        tool_executor=None,
    ) -> None:
        super().__init__()
        self.agent_db = agent_db or agent_definitions_collection
        self.workflow_db = workflow_db or workflow_definitions_collection
        self.run_db = run_db or workflow_runs_collection
        if audit_db is not None:
            self.audit_db = audit_db
        elif agent_db is not None or workflow_db is not None or run_db is not None:
            self.audit_db = None
        else:
            self.audit_db = agent_audit_collection
        self.tool_executor = tool_executor or get_agent_tool_executor()
        self.registry = get_agent_tool_registry()
        self.template_registry = get_workflow_template_registry()

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
        self._record_audit("agent.created", owner, "agent", agent_id)
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

    def delete_agent(self, owner: str, agent_id: str) -> ServiceResult:
        """Soft-delete an owned agent definition."""
        result = self.agent_db.update_one(
            {
                "agent_id": agent_id,
                "created_by": self.extract_username(owner),
                "deleted": {"$ne": True},
            },
            {"$set": {"deleted": True, "updated_at": datetime.utcnow().isoformat()}},
        )
        if getattr(result, "modified_count", 0) == 0:
            return ServiceResult.fail("Agent not found", 404)
        self._record_audit("agent.deleted", owner, "agent", agent_id)
        return ServiceResult.ok({"message": "Agent deleted successfully"})

    def start_agent_run(
        self,
        owner: str,
        agent_id: str,
        query: str,
        collection_ids: Optional[List[str]] = None,
        dry_run: bool = True,
    ) -> ServiceResult:
        """Create a workflow-style run from an agent definition."""
        if not query.strip():
            return ServiceResult.fail("Agent run query is required", 400)

        agent_result = self.get_agent(owner, agent_id)
        if not agent_result.success:
            return agent_result

        agent = agent_result.data
        resolved_collection_ids = (
            collection_ids
            if collection_ids is not None
            else agent.get("collection_ids", [])
        )
        now = datetime.utcnow().isoformat()
        run_id = str(uuid4())
        planned_steps = [
            self._prepare_agent_run_step(
                index=index,
                tool_name=tool_name,
                query=query.strip(),
                collection_ids=resolved_collection_ids,
            )
            for index, tool_name in enumerate(agent.get("tool_names", []), start=1)
        ]
        validation_error = self._validate_run_steps(planned_steps)
        if validation_error:
            return validation_error

        if dry_run:
            status = "planned"
        else:
            planned_steps = self._execute_ready_steps(planned_steps)
            status = self._workflow_run_status(planned_steps)

        document = {
            "run_id": run_id,
            "workflow_id": f"agent:{agent_id}",
            "agent_id": agent_id,
            "status": status,
            "dry_run": dry_run,
            "inputs": {
                "query": query.strip(),
                "collection_ids": resolved_collection_ids,
            },
            "steps": planned_steps,
            "created_by": self.extract_username(owner),
            "created_at": now,
            "updated_at": now,
        }
        self.run_db.insert_one(document)
        self._record_audit(
            "agent.run_started",
            owner,
            "agent",
            agent_id,
            {"run_id": run_id, "status": status, "dry_run": dry_run},
        )
        return ServiceResult.ok(self._public_document(document), status_code=201)

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

        dependency_error = self._validate_workflow_dependencies(normalized_steps)
        if dependency_error:
            return dependency_error

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
        self._record_audit("workflow.created", owner, "workflow", workflow_id)
        return ServiceResult.ok(self._public_document(document), status_code=201)

    def list_workflow_templates(self) -> ServiceResult:
        """List built-in workflow templates."""
        return ServiceResult.ok(self.template_registry.list_templates())

    def create_workflow_from_template(
        self,
        owner: str,
        template_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        agent_id: Optional[str] = None,
        triggers: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ServiceResult:
        """Create a workflow from a built-in template."""
        template = self.template_registry.get_template(template_id)
        if not template:
            return ServiceResult.fail("Workflow template not found", 404)

        template_metadata = {
            "template_id": template_id,
            "required_inputs": template.get("required_inputs", []),
            **(metadata or {}),
        }
        return self.create_workflow(
            owner=owner,
            name=name or template["name"],
            description=description or template.get("description"),
            agent_id=agent_id,
            triggers=triggers,
            metadata=template_metadata,
            steps=template["steps"],
        )

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

    def delete_workflow(self, owner: str, workflow_id: str) -> ServiceResult:
        """Soft-delete an owned workflow definition."""
        result = self.workflow_db.update_one(
            {
                "workflow_id": workflow_id,
                "created_by": self.extract_username(owner),
                "deleted": {"$ne": True},
            },
            {"$set": {"deleted": True, "updated_at": datetime.utcnow().isoformat()}},
        )
        if getattr(result, "modified_count", 0) == 0:
            return ServiceResult.fail("Workflow not found", 404)
        self._record_audit("workflow.deleted", owner, "workflow", workflow_id)
        return ServiceResult.ok({"message": "Workflow deleted successfully"})

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

        return self._create_workflow_run_from_document(
            owner=owner,
            workflow=workflow_result.data,
            inputs=inputs,
            dry_run=dry_run,
        )

    def run_workflow_trigger(
        self,
        owner: str,
        trigger_name: str,
        inputs: Optional[Dict[str, Any]] = None,
        dry_run: bool = True,
    ) -> ServiceResult:
        """Start every workflow owned by the user that has the named trigger."""
        trigger_name = trigger_name.strip()
        if not trigger_name:
            return ServiceResult.fail("Workflow trigger name is required", 400)

        docs = self.workflow_db.find(
            {
                "created_by": self.extract_username(owner),
                "triggers": trigger_name,
                "deleted": {"$ne": True},
            },
            {"_id": 0},
        )
        runs = []
        for workflow in docs:
            result = self._create_workflow_run_from_document(
                owner=owner,
                workflow=workflow,
                inputs=inputs,
                dry_run=dry_run,
                audit_event="workflow.trigger_run",
                audit_metadata={"trigger": trigger_name},
            )
            if not result.success:
                return result
            runs.append(result.data)
        return ServiceResult.ok(runs, status_code=201)

    def _create_workflow_run_from_document(
        self,
        owner: str,
        workflow: Dict[str, Any],
        inputs: Optional[Dict[str, Any]] = None,
        dry_run: bool = True,
        audit_event: str = "workflow.run_started",
        audit_metadata: Optional[Dict[str, Any]] = None,
    ) -> ServiceResult:
        workflow_id = workflow["workflow_id"]
        inputs = inputs or {}
        now = datetime.utcnow().isoformat()
        run_id = str(uuid4())
        planned_steps = [
            self._prepare_run_step(step, inputs)
            for step in workflow.get("steps", [])
        ]
        validation_error = self._validate_run_steps(planned_steps)
        if validation_error:
            return validation_error

        if not dry_run:
            planned_steps = self._execute_ready_steps(planned_steps)

        if dry_run:
            status = "planned"
        else:
            status = self._workflow_run_status(planned_steps)

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
        metadata = {
            "workflow_id": workflow_id,
            "status": status,
            "dry_run": dry_run,
            **(audit_metadata or {}),
        }
        self._record_audit(
            audit_event,
            owner,
            "workflow_run",
            run_id,
            metadata,
        )
        return ServiceResult.ok(self._public_document(document), status_code=201)

    def list_workflow_runs(self, owner: str, workflow_id: Optional[str] = None) -> ServiceResult:
        """List workflow runs for the current owner."""
        query = {"created_by": self.extract_username(owner)}
        if workflow_id:
            query["workflow_id"] = workflow_id
        docs = self.run_db.find(query, {"_id": 0})
        return ServiceResult.ok([self._public_document(doc) for doc in docs])

    def get_workflow_run(self, owner: str, run_id: str) -> ServiceResult:
        """Get one workflow run owned by the current owner."""
        doc = self.run_db.find_one(
            {"created_by": self.extract_username(owner), "run_id": run_id},
            {"_id": 0},
        )
        if not doc:
            return ServiceResult.fail("Workflow run not found", 404)
        return ServiceResult.ok(self._public_document(doc))

    def approve_workflow_step(self, owner: str, run_id: str, step_id: str) -> ServiceResult:
        """Approve and execute one pending approval step in a workflow run."""
        run_result = self.get_workflow_run(owner, run_id)
        if not run_result.success:
            return run_result

        run_doc = run_result.data
        steps = list(run_doc.get("steps") or [])
        target_index = next(
            (index for index, step in enumerate(steps) if step.get("step_id") == step_id),
            None,
        )
        if target_index is None:
            return ServiceResult.fail("Workflow step not found", 404)

        target_step = dict(steps[target_index])
        if target_step.get("status") != "pending_approval":
            return ServiceResult.fail("Workflow step is not pending approval", 400)

        target_step["approval_required"] = False
        target_step["message"] = ""
        steps[target_index] = self._execute_run_step(target_step)
        steps = self._execute_ready_steps(steps)
        now = datetime.utcnow().isoformat()
        status = self._workflow_run_status(steps)
        update = {
            "steps": steps,
            "status": status,
            "updated_at": now,
        }
        self.run_db.update_one(
            {"created_by": self.extract_username(owner), "run_id": run_id},
            {"$set": update},
        )
        updated_doc = {
            **run_doc,
            **update,
        }
        self._record_audit(
            "workflow.step_approved",
            owner,
            "workflow_run",
            run_id,
            {"step_id": step_id, "status": steps[target_index].get("status")},
        )
        return ServiceResult.ok(self._public_document(updated_doc))

    def cancel_workflow_run(self, owner: str, run_id: str) -> ServiceResult:
        """Cancel a non-terminal workflow run."""
        run_result = self.get_workflow_run(owner, run_id)
        if not run_result.success:
            return run_result

        run_doc = run_result.data
        if run_doc.get("status") in {"completed", "canceled"}:
            return ServiceResult.fail("Workflow run cannot be canceled", 400)

        terminal_step_statuses = {"completed", "failed", "canceled"}
        steps = []
        for step in run_doc.get("steps") or []:
            next_step = dict(step)
            if next_step.get("status") not in terminal_step_statuses:
                next_step["status"] = "canceled"
                next_step["message"] = "Run canceled"
            steps.append(next_step)

        now = datetime.utcnow().isoformat()
        update = {
            "steps": steps,
            "status": "canceled",
            "updated_at": now,
        }
        self.run_db.update_one(
            {"created_by": self.extract_username(owner), "run_id": run_id},
            {"$set": update},
        )
        updated_doc = {
            **run_doc,
            **update,
        }
        self._record_audit(
            "workflow.run_canceled",
            owner,
            "workflow_run",
            run_id,
            {"workflow_id": run_doc.get("workflow_id")},
        )
        return ServiceResult.ok(self._public_document(updated_doc))

    def list_audit_events(self, owner: str, limit: int = 50) -> ServiceResult:
        """List recent agent platform audit events."""
        if self.audit_db is None:
            return ServiceResult.ok([])
        docs = self.audit_db.find(
            {"created_by": self.extract_username(owner)},
            {"_id": 0},
        ).sort("created_at", -1).limit(limit)
        return ServiceResult.ok([self._public_document(doc) for doc in docs])

    def invoke_tool(
        self,
        owner: str,
        tool_name: str,
        arguments: Optional[Dict[str, Any]] = None,
        dry_run: bool = False,
    ) -> ServiceResult:
        """Validate and invoke one registered tool."""
        planned = {
            "step_id": "tool-invocation",
            "name": tool_name,
            "tool_name": tool_name,
            "arguments": arguments or {},
            "depends_on": [],
            "approval_required": False,
            "status": "planned",
            "output": None,
            "message": "",
        }
        validation_error = self._validate_run_steps([planned])
        if validation_error:
            return validation_error

        result = planned if dry_run else self._execute_run_step(planned)
        self._record_audit(
            "tool.invoked",
            owner,
            "tool",
            tool_name,
            {"status": result["status"], "dry_run": dry_run},
        )
        return ServiceResult.ok(result)

    def get_mcp_manifest(self) -> ServiceResult:
        """Return an MCP-style manifest for external agent runtimes."""
        return ServiceResult.ok({
            "name": "GeraltAI Agent Platform",
            "version": "1.0.0",
            "tools": self.registry.list_mcp_tools(),
        })

    def get_adk_manifest(self, owner: str) -> ServiceResult:
        """Return an ADK-oriented manifest for agents, workflows, and MCP tools."""
        username = self.extract_username(owner)
        agents = list(self.agent_db.find(
            {"created_by": username, "deleted": {"$ne": True}},
            {"_id": 0},
        ))
        workflows = list(self.workflow_db.find(
            {"created_by": username, "deleted": {"$ne": True}},
            {"_id": 0},
        ))
        return ServiceResult.ok({
            "name": "GeraltAI Agent Platform",
            "version": "1.0.0",
            "adk_version_hint": "google-adk",
            "mcp": {
                "toolset_name": "geraltai_mcp_tools",
                "transport": "streamable_http",
                "manifest_path": "/api/v1/agent-platform/mcp/manifest",
                "tools": self.registry.list_mcp_tools(),
            },
            "agents": [
                {
                    "agent_id": agent.get("agent_id"),
                    "name": agent.get("name"),
                    "model": agent.get("model") or "default",
                    "instruction": agent.get("instruction") or "",
                    "tools": agent.get("tool_names", []),
                    "collection_ids": agent.get("collection_ids", []),
                    "mcp_toolset": "geraltai_mcp_tools",
                }
                for agent in agents
            ],
            "workflows": [
                {
                    "workflow_id": workflow.get("workflow_id"),
                    "name": workflow.get("name"),
                    "description": workflow.get("description", ""),
                    "triggers": workflow.get("triggers", []),
                    "steps": [
                        {
                            "step_id": step.get("step_id"),
                            "tool_name": step.get("tool_name"),
                            "arguments": step.get("arguments", {}),
                            "depends_on": step.get("depends_on", []),
                            "approval_required": step.get("approval_required", False),
                        }
                        for step in workflow.get("steps", [])
                    ],
                }
                for workflow in workflows
            ],
        })

    def export_platform(self, owner: str) -> ServiceResult:
        """Export agent platform definitions and recent activity."""
        username = self.extract_username(owner)
        agents = list(self.agent_db.find(
            {"created_by": username, "deleted": {"$ne": True}},
            {"_id": 0},
        ))
        workflows = list(self.workflow_db.find(
            {"created_by": username, "deleted": {"$ne": True}},
            {"_id": 0},
        ))
        runs = list(self.run_db.find({"created_by": username}, {"_id": 0}))
        audit_events = self.list_audit_events(owner, limit=100).data or []
        return ServiceResult.ok({
            "schema_version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "owner": username,
            "mcp_manifest": self.get_mcp_manifest().data,
            "agents": [self._public_document(doc) for doc in agents],
            "workflows": [self._public_document(doc) for doc in workflows],
            "runs": [self._public_document(doc) for doc in runs],
            "audit_events": audit_events,
        })

    def import_platform(self, owner: str, payload: Dict[str, Any]) -> ServiceResult:
        """Import agent and workflow definitions from a platform export."""
        username = self.extract_username(owner)
        agents = payload.get("agents") or []
        workflows = payload.get("workflows") or []
        agent_id_map: Dict[str, str] = {}
        workflow_id_map: Dict[str, str] = {}

        for agent in agents:
            tool_names = agent.get("tool_names") or agent.get("tools") or []
            validation_error = self._validate_tools(tool_names)
            if validation_error:
                return validation_error
            if not str(agent.get("name", "")).strip():
                return ServiceResult.fail("Imported agent name is required", 400)
            if not str(agent.get("instruction", "")).strip():
                return ServiceResult.fail("Imported agent instruction is required", 400)

        normalized_workflows = []
        for workflow in workflows:
            if not str(workflow.get("name", "")).strip():
                return ServiceResult.fail("Imported workflow name is required", 400)
            steps = []
            for index, step in enumerate(workflow.get("steps") or [], start=1):
                tool_name = step.get("tool_name")
                validation_error = self._validate_tools([tool_name])
                if validation_error:
                    return validation_error
                steps.append({
                    "step_id": step.get("step_id") or f"step-{index}",
                    "name": step.get("name") or f"Step {index}",
                    "tool_name": tool_name,
                    "arguments": step.get("arguments") or {},
                    "depends_on": step.get("depends_on") or [],
                    "approval_required": bool(step.get("approval_required", False)),
                })
            dependency_error = self._validate_workflow_dependencies(steps)
            if dependency_error:
                return dependency_error
            normalized_workflows.append((workflow, steps))

        now = datetime.utcnow().isoformat()
        for agent in agents:
            old_agent_id = agent.get("agent_id") or str(uuid4())
            new_agent_id = str(uuid4())
            agent_id_map[old_agent_id] = new_agent_id
            self.agent_db.insert_one({
                "agent_id": new_agent_id,
                "name": str(agent.get("name", "")).strip(),
                "description": agent.get("description", ""),
                "instruction": str(agent.get("instruction", "")).strip(),
                "tool_names": agent.get("tool_names") or agent.get("tools") or [],
                "model": agent.get("model") or "default",
                "collection_ids": agent.get("collection_ids", []),
                "metadata": agent.get("metadata", {}),
                "created_by": username,
                "created_at": now,
                "updated_at": now,
                "deleted": False,
            })

        for workflow, steps in normalized_workflows:
            old_workflow_id = workflow.get("workflow_id") or str(uuid4())
            new_workflow_id = str(uuid4())
            workflow_id_map[old_workflow_id] = new_workflow_id
            old_agent_id = workflow.get("agent_id")
            self.workflow_db.insert_one({
                "workflow_id": new_workflow_id,
                "name": str(workflow.get("name", "")).strip(),
                "description": workflow.get("description", ""),
                "agent_id": agent_id_map.get(old_agent_id, old_agent_id),
                "steps": steps,
                "triggers": workflow.get("triggers", []),
                "metadata": workflow.get("metadata", {}),
                "created_by": username,
                "created_at": now,
                "updated_at": now,
                "deleted": False,
            })

        self._record_audit(
            "platform.imported",
            owner,
            "platform",
            username,
            {
                "agents_imported": len(agents),
                "workflows_imported": len(workflows),
            },
        )
        return ServiceResult.ok({
            "agents_imported": len(agents),
            "workflows_imported": len(workflows),
            "agent_id_map": agent_id_map,
            "workflow_id_map": workflow_id_map,
        }, status_code=201)

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

    def _prepare_run_step(
        self,
        step: Dict[str, Any],
        inputs: Dict[str, Any],
    ) -> Dict[str, Any]:
        arguments = self._resolve_arguments(step.get("arguments") or {}, inputs)
        return {
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

    def _prepare_agent_run_step(
        self,
        index: int,
        tool_name: str,
        query: str,
        collection_ids: List[str],
    ) -> Dict[str, Any]:
        tool = self.registry.get_tool(tool_name)
        arguments = self._agent_tool_arguments(tool_name, query, collection_ids)
        return {
            "step_id": f"agent-step-{index}",
            "name": tool.title if tool else tool_name,
            "tool_name": tool_name,
            "arguments": arguments,
            "depends_on": [],
            "approval_required": False,
            "status": "planned",
            "output": None,
            "message": "",
        }

    def _agent_tool_arguments(
        self,
        tool_name: str,
        query: str,
        collection_ids: List[str],
    ) -> Dict[str, Any]:
        tool = self.registry.get_tool(tool_name)
        if not tool:
            return {}

        arguments: Dict[str, Any] = {}
        for required_name in tool.input_schema().get("required", []):
            if required_name == "query":
                arguments["query"] = query
            elif required_name == "collection_ids":
                arguments["collection_ids"] = collection_ids
            elif required_name == "collection_id":
                arguments["collection_id"] = collection_ids[0] if collection_ids else ""
        return arguments

    def _execute_run_step(self, planned: Dict[str, Any]) -> Dict[str, Any]:
        if planned.get("approval_required"):
            planned["status"] = "pending_approval"
            planned["message"] = "Approval required before execution"
            return planned

        try:
            planned["output"] = self.tool_executor.execute(
                planned["tool_name"],
                planned["arguments"],
            )
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

    def _execute_ready_steps(self, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        executable_statuses = {"planned", "blocked"}
        steps = [dict(step) for step in steps]
        made_progress = True
        while made_progress:
            made_progress = False
            steps_by_id = {step.get("step_id"): step for step in steps}
            for index, step in enumerate(steps):
                if step.get("status") not in executable_statuses:
                    continue

                waiting_for = self._waiting_dependencies(step, steps_by_id)
                if waiting_for:
                    step["status"] = "blocked"
                    step["message"] = f"Waiting for dependency: {', '.join(waiting_for)}"
                    continue

                previous_status = step.get("status")
                step["message"] = ""
                steps[index] = self._execute_run_step(step)
                if steps[index].get("status") != previous_status:
                    made_progress = True
        return steps

    def _waiting_dependencies(
        self,
        step: Dict[str, Any],
        steps_by_id: Dict[str, Dict[str, Any]],
    ) -> List[str]:
        waiting_for = []
        for dependency_id in step.get("depends_on", []):
            dependency = steps_by_id.get(dependency_id)
            if not dependency or dependency.get("status") != "completed":
                waiting_for.append(dependency_id)
        return waiting_for

    def _workflow_run_status(self, steps: List[Dict[str, Any]]) -> str:
        if all(step.get("status") == "completed" for step in steps):
            return "completed"
        return "pending"

    def _validate_run_steps(self, planned_steps: List[Dict[str, Any]]) -> Optional[ServiceResult]:
        for step in planned_steps:
            tool = self.registry.get_tool(step["tool_name"])
            if not tool:
                return ServiceResult.fail(f"Unknown agent tool(s): {step['tool_name']}", 400)

            schema = tool.input_schema()
            properties = schema.get("properties", {})
            arguments = step.get("arguments") or {}
            for required_name in schema.get("required", []):
                value = arguments.get(required_name)
                if value is None or value == "" or value == []:
                    return ServiceResult.fail(
                        f"Step {step['step_id']} is missing required argument: {required_name}",
                        400,
                    )

            for name, value in arguments.items():
                expected_type = properties.get(name, {}).get("type")
                if expected_type == "array" and not isinstance(value, list):
                    return ServiceResult.fail(
                        f"Step {step['step_id']} argument {name} must be an array",
                        400,
                    )
                if expected_type == "string" and not isinstance(value, str):
                    return ServiceResult.fail(
                        f"Step {step['step_id']} argument {name} must be a string",
                        400,
                    )
                if expected_type == "integer" and not isinstance(value, int):
                    return ServiceResult.fail(
                        f"Step {step['step_id']} argument {name} must be an integer",
                        400,
                    )

        return None

    def _validate_workflow_dependencies(
        self,
        steps: List[Dict[str, Any]],
    ) -> Optional[ServiceResult]:
        step_ids = {step["step_id"] for step in steps}
        for step in steps:
            missing = [dep for dep in step.get("depends_on", []) if dep not in step_ids]
            if missing:
                return ServiceResult.fail(
                    f"Step {step['step_id']} depends on unknown step(s): {', '.join(missing)}",
                    400,
                )
        return None

    def _resolve_arguments(self, value: Any, inputs: Dict[str, Any]) -> Any:
        if isinstance(value, dict):
            return {key: self._resolve_arguments(item, inputs) for key, item in value.items()}
        if isinstance(value, list):
            return [self._resolve_arguments(item, inputs) for item in value]
        if isinstance(value, str) and value.startswith("{{input.") and value.endswith("}}"):
            key = value[len("{{input."):-2].strip()
            return inputs.get(key)
        return value

    def _record_audit(
        self,
        event: str,
        owner: str,
        subject_type: str,
        subject_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        if self.audit_db is None:
            return
        try:
            self.audit_db.insert_one({
                "event": event,
                "subject_type": subject_type,
                "subject_id": subject_id,
                "metadata": metadata or {},
                "created_by": self.extract_username(owner),
                "created_at": datetime.utcnow().isoformat(),
            })
        except Exception as e:
            self.logger.warning("Failed to record agent platform audit event: %s", e)


_agent_platform_service: Optional[AgentPlatformService] = None


def get_agent_platform_service() -> AgentPlatformService:
    """Return the singleton agent platform service."""
    global _agent_platform_service
    if _agent_platform_service is None:
        _agent_platform_service = AgentPlatformService()
    return _agent_platform_service
