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


class AgentDefinitionUpdate(BaseModel):
    """Request to update a reusable agent."""

    name: Optional[str] = None
    instruction: Optional[str] = None
    tool_names: Optional[List[str]] = None
    description: Optional[str] = None
    model: Optional[str] = None
    collection_ids: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class AgentTemplateCreate(BaseModel):
    """Request to create a reusable agent from a template."""

    template_id: str = Field(min_length=1)
    name: Optional[str] = None
    description: Optional[str] = None
    instruction: Optional[str] = None
    tool_names: Optional[List[str]] = None
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


class AgentRunCreate(BaseModel):
    """Request to run a reusable agent directly."""

    query: str = Field(min_length=1)
    collection_ids: Optional[List[str]] = None
    dry_run: bool = True


class McpServerCreate(BaseModel):
    """Request to register an external MCP server."""

    name: str = Field(min_length=1)
    transport: str = Field(min_length=1)
    url: Optional[str] = None
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    tool_names: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class McpServerUpdate(BaseModel):
    """Request to update an external MCP server."""

    name: Optional[str] = None
    transport: Optional[str] = None
    url: Optional[str] = None
    command: Optional[str] = None
    args: Optional[List[str]] = None
    tool_names: Optional[List[str]] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class McpServerResponse(BaseModel):
    """Stored external MCP server registration."""

    server_id: str
    name: str
    description: str = ""
    transport: str
    url: str = ""
    command: str = ""
    args: List[str] = Field(default_factory=list)
    tool_names: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    last_health_status: Optional[str] = None
    last_health_message: Optional[str] = None
    last_health_checked_at: Optional[str] = None
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


class WorkflowDefinitionUpdate(BaseModel):
    """Request to update a reusable workflow."""

    name: Optional[str] = None
    steps: Optional[List[WorkflowStepDefinition]] = None
    description: Optional[str] = None
    agent_id: Optional[str] = None
    triggers: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class WorkflowTemplateCreate(BaseModel):
    """Request to create a workflow from a built-in template."""

    template_id: str = Field(min_length=1)
    name: Optional[str] = None
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


class WorkflowRunRetryCreate(BaseModel):
    """Request to retry a previous workflow run."""

    dry_run: Optional[bool] = None


class WorkflowRunResponse(BaseModel):
    """Workflow run plan or execution record."""

    run_id: str
    workflow_id: str
    agent_id: Optional[str] = None
    retried_from: Optional[str] = None
    status: str
    dry_run: bool
    inputs: Dict[str, Any] = Field(default_factory=dict)
    steps: List[Dict[str, Any]]
    created_by: str
    created_at: str
    updated_at: str


class AuditEventResponse(BaseModel):
    """Agent platform lifecycle event."""

    event: str
    subject_type: str
    subject_id: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_by: str
    created_at: str


class ToolInvocationRequest(BaseModel):
    """Request to invoke one registered tool."""

    tool_name: str = Field(min_length=1)
    arguments: Dict[str, Any] = Field(default_factory=dict)
    dry_run: bool = False


class ToolInvocationResponse(BaseModel):
    """Result from a direct tool invocation."""

    step_id: str
    name: str
    tool_name: str
    arguments: Dict[str, Any]
    depends_on: List[str] = Field(default_factory=list)
    approval_required: bool = False
    status: str
    output: Any = None
    message: str = ""


class McpManifestResponse(BaseModel):
    """MCP-style tool manifest."""

    name: str
    version: str
    tools: List[Dict[str, Any]]


class PlatformStatsResponse(BaseModel):
    """Agent platform aggregate counts."""

    agents: int
    workflows: int
    tools: int
    runs: int
    active_runs: int
    run_statuses: Dict[str, int]


class PlatformExportResponse(BaseModel):
    """Exported agent platform data."""

    schema_version: str
    exported_at: str
    owner: str
    mcp_manifest: Dict[str, Any]
    agents: List[Dict[str, Any]]
    workflows: List[Dict[str, Any]]
    mcp_servers: List[Dict[str, Any]] = Field(default_factory=list)
    runs: List[Dict[str, Any]]
    audit_events: List[Dict[str, Any]]


class PlatformImportRequest(BaseModel):
    """Agent platform import payload."""

    agents: List[Dict[str, Any]] = Field(default_factory=list)
    workflows: List[Dict[str, Any]] = Field(default_factory=list)
    mcp_servers: List[Dict[str, Any]] = Field(default_factory=list)


class PlatformImportResponse(BaseModel):
    """Agent platform import summary."""

    agents_imported: int
    workflows_imported: int
    mcp_servers_imported: int
    agent_id_map: Dict[str, str]
    workflow_id_map: Dict[str, str]
    mcp_server_id_map: Dict[str, str]


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


@router.get("/mcp/manifest", response_model=McpManifestResponse)
async def get_mcp_manifest(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Return a manifest for external agent runtimes."""
    return _result_or_error(service.get_mcp_manifest())


@router.get("/stats", response_model=PlatformStatsResponse)
async def get_platform_stats(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Return aggregate counts for the current agent platform workspace."""
    return _result_or_error(service.get_platform_stats(_owner(current_user)))


@router.get("/adk/manifest", response_model=Dict[str, Any])
async def get_adk_manifest(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Return an ADK-oriented manifest for agents, workflows, and MCP tools."""
    return _result_or_error(service.get_adk_manifest(_owner(current_user)))


@router.get("/export", response_model=PlatformExportResponse)
async def export_agent_platform(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Export agent platform definitions and recent activity."""
    return _result_or_error(service.export_platform(_owner(current_user)))


@router.post("/import", response_model=PlatformImportResponse, status_code=201)
async def import_agent_platform(
    request: PlatformImportRequest,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Import agent platform definitions from an exported JSON payload."""
    return _result_or_error(service.import_platform(_owner(current_user), request.model_dump()))


@router.post("/tool-invocations", response_model=ToolInvocationResponse)
async def invoke_tool(
    request: ToolInvocationRequest,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Invoke one registered tool directly."""
    return _result_or_error(service.invoke_tool(
        owner=_owner(current_user),
        tool_name=request.tool_name,
        arguments=request.arguments,
        dry_run=request.dry_run,
    ))


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


@router.get("/agent-templates", response_model=List[Dict[str, Any]])
async def list_agent_templates(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> List[Dict[str, Any]]:
    """List built-in agent templates."""
    return _result_or_error(service.list_agent_templates())


@router.post(
    "/agents/from-template",
    response_model=AgentDefinitionResponse,
    status_code=201,
)
async def create_agent_from_template(
    request: AgentTemplateCreate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Create a reusable agent from a built-in template."""
    result = service.create_agent_from_template(
        owner=_owner(current_user),
        template_id=request.template_id,
        name=request.name,
        description=request.description,
        instruction=request.instruction,
        tool_names=request.tool_names,
        model=request.model,
        collection_ids=request.collection_ids,
        metadata=request.metadata,
    )
    return _result_or_error(result)


@router.post(
    "/agents/{agent_id}/runs",
    response_model=WorkflowRunResponse,
    status_code=201,
)
async def start_agent_run(
    agent_id: str,
    request: AgentRunCreate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Create a workflow-style run directly from an agent definition."""
    result = service.start_agent_run(
        owner=_owner(current_user),
        agent_id=agent_id,
        query=request.query,
        collection_ids=request.collection_ids,
        dry_run=request.dry_run,
    )
    return _result_or_error(result)


@router.post("/mcp-servers", response_model=McpServerResponse, status_code=201)
async def create_mcp_server(
    request: McpServerCreate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Register an external MCP server."""
    result = service.create_mcp_server(
        owner=_owner(current_user),
        name=request.name,
        transport=request.transport,
        url=request.url,
        command=request.command,
        args=request.args,
        tool_names=request.tool_names,
        description=request.description,
        metadata=request.metadata,
    )
    return _result_or_error(result)


@router.get("/mcp-servers", response_model=List[McpServerResponse])
async def list_mcp_servers(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> List[Dict[str, Any]]:
    """List external MCP servers."""
    return _result_or_error(service.list_mcp_servers(_owner(current_user)))


@router.get("/mcp-servers/tools", response_model=List[Dict[str, Any]])
async def list_external_mcp_tools(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> List[Dict[str, Any]]:
    """List flattened tools declared by registered external MCP servers."""
    return _result_or_error(service.list_external_mcp_tools(_owner(current_user)))


@router.patch("/mcp-servers/{server_id}", response_model=McpServerResponse)
async def update_mcp_server(
    server_id: str,
    request: McpServerUpdate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Update an external MCP server."""
    result = service.update_mcp_server(
        owner=_owner(current_user),
        server_id=server_id,
        name=request.name,
        transport=request.transport,
        url=request.url,
        command=request.command,
        args=request.args,
        tool_names=request.tool_names,
        description=request.description,
        metadata=request.metadata,
    )
    return _result_or_error(result)


@router.post("/mcp-servers/{server_id}/health-check", response_model=McpServerResponse)
def check_mcp_server(
    server_id: str,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Check an external MCP server target and store the latest status."""
    return _result_or_error(service.check_mcp_server(_owner(current_user), server_id))


@router.delete("/mcp-servers/{server_id}")
async def delete_mcp_server(
    server_id: str,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Soft-delete an external MCP server."""
    return _result_or_error(service.delete_mcp_server(_owner(current_user), server_id))


@router.get("/agents/{agent_id}", response_model=AgentDefinitionResponse)
async def get_agent_definition(
    agent_id: str,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Get a reusable agent definition."""
    return _result_or_error(service.get_agent(_owner(current_user), agent_id))


@router.patch("/agents/{agent_id}", response_model=AgentDefinitionResponse)
async def update_agent_definition(
    agent_id: str,
    request: AgentDefinitionUpdate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Update a reusable agent definition."""
    result = service.update_agent(
        owner=_owner(current_user),
        agent_id=agent_id,
        name=request.name,
        instruction=request.instruction,
        tool_names=request.tool_names,
        description=request.description,
        model=request.model,
        collection_ids=request.collection_ids,
        metadata=request.metadata,
    )
    return _result_or_error(result)


@router.delete("/agents/{agent_id}")
async def delete_agent_definition(
    agent_id: str,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Soft-delete a reusable agent definition."""
    return _result_or_error(service.delete_agent(_owner(current_user), agent_id))


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


@router.get("/workflow-templates", response_model=List[Dict[str, Any]])
async def list_workflow_templates(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> List[Dict[str, Any]]:
    """List built-in workflow templates."""
    return _result_or_error(service.list_workflow_templates())


@router.get("/triggers", response_model=List[Dict[str, Any]])
async def list_workflow_triggers(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> List[Dict[str, Any]]:
    """List automation triggers bound to reusable workflows."""
    return _result_or_error(service.list_workflow_triggers(_owner(current_user)))


@router.post(
    "/triggers/{trigger_name}/runs",
    response_model=List[WorkflowRunResponse],
    status_code=201,
)
async def run_workflow_trigger(
    trigger_name: str,
    request: WorkflowRunCreate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> List[Dict[str, Any]]:
    """Start all owned workflows that match a named automation trigger."""
    result = service.run_workflow_trigger(
        owner=_owner(current_user),
        trigger_name=trigger_name,
        inputs=request.inputs,
        dry_run=request.dry_run,
    )
    return _result_or_error(result)


@router.post(
    "/workflows/from-template",
    response_model=WorkflowDefinitionResponse,
    status_code=201,
)
async def create_workflow_from_template(
    request: WorkflowTemplateCreate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Create a reusable workflow from a built-in template."""
    result = service.create_workflow_from_template(
        owner=_owner(current_user),
        template_id=request.template_id,
        name=request.name,
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


@router.patch("/workflows/{workflow_id}", response_model=WorkflowDefinitionResponse)
async def update_workflow_definition(
    workflow_id: str,
    request: WorkflowDefinitionUpdate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Update a reusable workflow definition."""
    result = service.update_workflow(
        owner=_owner(current_user),
        workflow_id=workflow_id,
        name=request.name,
        steps=[step.model_dump() for step in request.steps] if request.steps is not None else None,
        description=request.description,
        agent_id=request.agent_id,
        triggers=request.triggers,
        metadata=request.metadata,
    )
    return _result_or_error(result)


@router.delete("/workflows/{workflow_id}")
async def delete_workflow_definition(
    workflow_id: str,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Soft-delete a reusable workflow definition."""
    return _result_or_error(service.delete_workflow(_owner(current_user), workflow_id))


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


@router.get("/workflow-runs/pending-approvals", response_model=List[Dict[str, Any]])
async def list_pending_approvals(
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> List[Dict[str, Any]]:
    """List workflow steps waiting on human approval."""
    return _result_or_error(service.list_pending_approvals(_owner(current_user)))


@router.get("/workflow-runs/{run_id}", response_model=WorkflowRunResponse)
async def get_workflow_run(
    run_id: str,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Get one workflow run record."""
    return _result_or_error(service.get_workflow_run(_owner(current_user), run_id))


@router.get("/workflow-runs/{run_id}/trace", response_model=Dict[str, Any])
async def get_workflow_run_trace(
    run_id: str,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Get a compact execution timeline for one workflow run."""
    return _result_or_error(service.get_workflow_run_trace(_owner(current_user), run_id))


@router.post(
    "/workflow-runs/{run_id}/steps/{step_id}/approve",
    response_model=WorkflowRunResponse,
)
async def approve_workflow_step(
    run_id: str,
    step_id: str,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Approve and execute a workflow run step waiting on human approval."""
    return _result_or_error(service.approve_workflow_step(_owner(current_user), run_id, step_id))


@router.post("/workflow-runs/{run_id}/cancel", response_model=WorkflowRunResponse)
async def cancel_workflow_run(
    run_id: str,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Cancel a workflow run that has not completed."""
    return _result_or_error(service.cancel_workflow_run(_owner(current_user), run_id))


@router.post(
    "/workflow-runs/{run_id}/retry",
    response_model=WorkflowRunResponse,
    status_code=201,
)
async def retry_workflow_run(
    run_id: str,
    request: WorkflowRunRetryCreate,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> Dict[str, Any]:
    """Create a new workflow run from a previous run record."""
    result = service.retry_workflow_run(
        owner=_owner(current_user),
        run_id=run_id,
        dry_run=request.dry_run,
    )
    return _result_or_error(result)


@router.get("/audit-events", response_model=List[AuditEventResponse])
async def list_audit_events(
    limit: int = 50,
    current_user: str | None = Depends(get_optional_user),
    service: AgentPlatformService = Depends(get_agent_platform_service),
) -> List[Dict[str, Any]]:
    """List recent agent platform lifecycle events."""
    return _result_or_error(service.list_audit_events(_owner(current_user), limit=limit))
