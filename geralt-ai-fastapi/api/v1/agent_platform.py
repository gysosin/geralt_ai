"""
Agent platform API routes.

These endpoints expose GeraltAI's document intelligence as stable tool
contracts for agents, workflows, and future MCP adapters.
"""
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from core.agents.tool_registry import get_agent_tool_registry
from core.rag.query_classifier import get_query_classifier
from core.security.jwt import get_optional_user


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
