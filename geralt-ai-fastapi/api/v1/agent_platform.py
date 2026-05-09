"""
Agent platform API routes.

These endpoints expose GeraltAI's document intelligence as stable tool
contracts for agents, workflows, and future MCP adapters.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.agents.tool_registry import get_agent_tool_registry
from core.rag.query_classifier import get_query_classifier
from core.security.jwt import get_optional_user
from services.agents import AgentPlatformService, get_agent_platform_service


router = APIRouter(prefix="/agent-platform", tags=["Agent Platform"])


class ToolListResponse(BaseModel):
    """Agent platform tool list."""

    tools: List[Dict[str, Any]] = Field(default_factory=list)
    mcp_tools: List[Dict[str, Any]] = Field(default_factory=list)


class QueryPlanRequest(BaseModel):
    """Request to classify and plan a user query."""

    query: str = Field(min_length=1)


class QueryPlanResponse(BaseModel):
    """Deterministic query route for agents and workflows."""

    query_type: str
    should_retrieve: bool
    needs_all_docs: bool
    suggested_top_k: int
    suggested_rerank_top_n: int
    reason: str


class AgentDefinitionCreate(BaseModel):
    """Request to create a reusable agent."""

    name: str = Field(min_length=1)
    instruction: str = Field(min_length=1)
    tool_names: List[str] = Field(min_length=1)
    description: Optional[str] = None
    model: Optional[str] = None
    collection_ids: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentDefinitionResponse(BaseModel):
    """Stored agent definition."""

    agent_id: str
    name: str
    description: str = ""
    instruction: str
    tool_names: List[str]
    model: str
    collection_ids: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_by: str
    created_at: str
    updated_at: str


class WorkflowStepDefinition(BaseModel):
    """A workflow step that invokes one registered tool."""

    name: Optional[str] = None
    tool_name: str = Field(min_length=1)
    arguments: Dict[str, Any] = Field(default_factory=dict)
    depends_on: List[str] = Field(default_factory=list)
    approval_required: bool = False


class WorkflowDefinitionCreate(BaseModel):
    """Request to create a reusable workflow."""

    name: str = Field(min_length=1)
    steps: List[WorkflowStepDefinition] = Field(min_length=1)
    description: Optional[str] = None
    agent_id: Optional[str] = None
    triggers: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WorkflowDefinitionResponse(BaseModel):
    """Stored workflow definition."""

    workflow_id: str
    name: str
    description: str = ""
    agent_id: Optional[str] = None
    steps: List[Dict[str, Any]]
    triggers: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_by: str
    created_at: str
    updated_at: str


class WorkflowRunCreate(BaseModel):
    """Request to start or dry-run a workflow."""

    inputs: Dict[str, Any] = Field(default_factory=dict)
    dry_run: bool = True


class WorkflowRunResponse(BaseModel):
    """Workflow run plan or execution record."""

    run_id: str
    workflow_id: str
    status: str
    dry_run: bool
    inputs: Dict[str, Any] = Field(default_factory=dict)
    steps: List[Dict[str, Any]]
    created_by: str
    created_at: str
    updated_at: str


def _owner(current_user: str | None) -> str:
    return current_user or "anonymous"


def _result_or_error(result):
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.get("/tools", response_model=ToolListResponse)
async def list_agent_tools(
    current_user: str | None = Depends(get_optional_user),
) -> ToolListResponse:
    """List available agent tools and MCP-compatible declarations."""
    registry = get_agent_tool_registry()
    return ToolListResponse(
        tools=registry.list_public_tools(),
        mcp_tools=registry.list_mcp_tools(),
    )


@router.post("/query-plan", response_model=QueryPlanResponse)
async def plan_query(
    request: QueryPlanRequest,
    current_user: str | None = Depends(get_optional_user),
) -> QueryPlanResponse:
    """Classify a query before deciding which tool or workflow to run."""
    plan = get_query_classifier().plan(request.query)
    return QueryPlanResponse(
        query_type=plan.query_type.value,
        should_retrieve=plan.should_retrieve,
        needs_all_docs=plan.needs_all_docs,
        suggested_top_k=plan.suggested_top_k,
        suggested_rerank_top_n=plan.suggested_rerank_top_n,
        reason=plan.reason,
    )


@router.post("/agents", response_model=AgentDefinitionResponse, status_code=201)
async def create_agent_definition(
    request: AgentDefinitionCreate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Create a reusable agent definition from registered tools."""
    result = service.create_agent(
        owner=_owner(current_user),
        name=request.name,
        instruction=request.instruction,
        tool_names=request.tool_names,
        description=request.description,
        model=request.model,
        collection_ids=request.collection_ids,
        metadata=request.metadata,
    )
    return _result_or_error(result)


@router.get("/agents", response_model=List[AgentDefinitionResponse])
async def list_agent_definitions(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> List[Dict[str, Any]]:
    """List reusable agent definitions for the current owner."""
    return _result_or_error(service.list_agents(_owner(current_user)))


@router.get("/agents/{agent_id}", response_model=AgentDefinitionResponse)
async def get_agent_definition(
    agent_id: str,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Get a reusable agent definition."""
    return _result_or_error(service.get_agent(_owner(current_user), agent_id))


@router.post("/workflows", response_model=WorkflowDefinitionResponse, status_code=201)
async def create_workflow_definition(
    request: WorkflowDefinitionCreate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Create a reusable workflow definition from registered tools."""
    result = service.create_workflow(
        owner=_owner(current_user),
        name=request.name,
        steps=[step.model_dump() for step in request.steps],
        description=request.description,
        agent_id=request.agent_id,
        triggers=request.triggers,
        metadata=request.metadata,
    )
    return _result_or_error(result)


@router.get("/workflows", response_model=List[WorkflowDefinitionResponse])
async def list_workflow_definitions(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> List[Dict[str, Any]]:
    """List reusable workflow definitions for the current owner."""
    return _result_or_error(service.list_workflows(_owner(current_user)))


@router.get("/workflows/{workflow_id}", response_model=WorkflowDefinitionResponse)
async def get_workflow_definition(
    workflow_id: str,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Get a reusable workflow definition."""
    return _result_or_error(service.get_workflow(_owner(current_user), workflow_id))


@router.post(
    "/workflows/{workflow_id}/runs",
    response_model=WorkflowRunResponse,
    status_code=201,
)
async def start_workflow_run(
    workflow_id: str,
    request: WorkflowRunCreate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Create a workflow run record and execute safe deterministic steps."""
    result = service.start_workflow_run(
        owner=_owner(current_user),
        workflow_id=workflow_id,
        inputs=request.inputs,
        dry_run=request.dry_run,
    )
    return _result_or_error(result)


@router.get("/workflow-runs", response_model=List[WorkflowRunResponse])
async def list_workflow_runs(
    workflow_id: Optional[str] = None,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> List[Dict[str, Any]]:
    """List workflow run records for the current owner."""
    return _result_or_error(service.list_workflow_runs(_owner(current_user), workflow_id))
