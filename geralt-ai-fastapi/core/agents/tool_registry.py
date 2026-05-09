"""
Agent tool registry.

This module keeps GeraltAI's RAG capabilities behind stable, schema-backed tool
contracts. The same registry can feed local APIs today and an MCP/ADK adapter
later without exposing provider credentials.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


JsonSchema = Dict[str, Any]


@dataclass(frozen=True)
class AgentToolSpec:
    """Stable tool contract for agents, workflows, and MCP adapters."""

    name: str
    title: str
    description: str
    category: str
    parameters: JsonSchema
    required: List[str] = field(default_factory=list)
    output_schema: JsonSchema = field(default_factory=dict)
    auth_required: bool = True
    safe_for_automation: bool = True

    def input_schema(self) -> JsonSchema:
        """Return MCP/OpenAPI-compatible input schema."""
        return {
            "type": "object",
            "properties": self.parameters,
            "required": self.required,
            "additionalProperties": False,
        }

    def to_public_dict(self) -> Dict[str, Any]:
        """Return API-safe metadata for UI and automation clients."""
        return {
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "input_schema": self.input_schema(),
            "output_schema": self.output_schema,
            "auth_required": self.auth_required,
            "safe_for_automation": self.safe_for_automation,
        }

    def to_mcp_tool(self) -> Dict[str, Any]:
        """Return an MCP-style tool declaration."""
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema(),
        }


class AgentToolRegistry:
    """In-memory registry of agent-facing GeraltAI capabilities."""

    def __init__(self) -> None:
        self._tools: Dict[str, AgentToolSpec] = {}
        for tool in self._default_tools():
            self.register(tool)

    def register(self, tool: AgentToolSpec) -> None:
        """Register or replace a tool spec by name."""
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[AgentToolSpec]:
        """Look up a tool by its stable name."""
        return self._tools.get(name)

    def list_tools(self) -> List[AgentToolSpec]:
        """List tools sorted for stable API responses."""
        return [self._tools[name] for name in sorted(self._tools)]

    def list_public_tools(self) -> List[Dict[str, Any]]:
        """List API-safe tool metadata."""
        return [tool.to_public_dict() for tool in self.list_tools()]

    def list_mcp_tools(self) -> List[Dict[str, Any]]:
        """List MCP-compatible tool declarations."""
        return [tool.to_mcp_tool() for tool in self.list_tools()]

    def _default_tools(self) -> List[AgentToolSpec]:
        return [
            AgentToolSpec(
                name="agent.run",
                title="Run Agent",
                description="Invoke a saved agent inside a deterministic workflow step.",
                category="agents",
                required=["agent_id", "query"],
                parameters={
                    "agent_id": {
                        "type": "string",
                        "description": "Saved agent definition ID to invoke.",
                        "minLength": 1,
                    },
                    "query": {
                        "type": "string",
                        "description": "Task or question to pass to the agent.",
                        "minLength": 1,
                    },
                    "collection_ids": {
                        "type": "array",
                        "description": "Collection IDs available to the agent run.",
                        "items": {"type": "string"},
                    },
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "agent_id": {"type": "string"},
                        "agent_name": {"type": "string"},
                        "status": {"type": "string"},
                        "steps": {"type": "array"},
                    },
                },
            ),
            AgentToolSpec(
                name="rag.search",
                title="Search Documents",
                description="Answer a question using hybrid RAG over selected collections.",
                category="rag",
                required=["query", "collection_ids"],
                parameters={
                    "query": {
                        "type": "string",
                        "description": "Question to answer from the selected documents.",
                        "minLength": 1,
                    },
                    "collection_ids": {
                        "type": "array",
                        "description": "Collection IDs to search.",
                        "items": {"type": "string"},
                        "minItems": 1,
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Initial retrieval depth.",
                        "minimum": 1,
                        "maximum": 100,
                        "default": 10,
                    },
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "answer": {"type": "string"},
                        "sources": {"type": "array"},
                        "routing": {"type": "object"},
                    },
                },
            ),
            AgentToolSpec(
                name="rag.aggregate",
                title="Aggregate Structured Data",
                description="Run totals, counts, groupings, and listings over extracted collection data.",
                category="rag",
                required=["query", "collection_ids"],
                parameters={
                    "query": {
                        "type": "string",
                        "description": "Aggregation or listing request.",
                        "minLength": 1,
                    },
                    "collection_ids": {
                        "type": "array",
                        "description": "Collection IDs whose extracted data should be aggregated.",
                        "items": {"type": "string"},
                        "minItems": 1,
                    },
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "answer": {"type": "string"},
                        "data": {"type": "array"},
                        "metadata": {"type": "object"},
                    },
                },
            ),
            AgentToolSpec(
                name="collection.summarize",
                title="Summarize Collection",
                description="Create a collection-level summary with document count and key findings.",
                category="collection",
                required=["collection_id"],
                parameters={
                    "collection_id": {
                        "type": "string",
                        "description": "Collection ID to summarize.",
                        "minLength": 1,
                    },
                    "max_docs": {
                        "type": "integer",
                        "description": "Maximum documents to include.",
                        "minimum": 1,
                        "maximum": 100,
                        "default": 50,
                    },
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string"},
                        "document_count": {"type": "integer"},
                        "key_findings": {"type": "array"},
                    },
                },
            ),
            AgentToolSpec(
                name="query.plan",
                title="Plan Query Route",
                description="Classify a user query and return deterministic retrieval or workflow hints.",
                category="planning",
                required=["query"],
                parameters={
                    "query": {
                        "type": "string",
                        "description": "User query to classify.",
                        "minLength": 1,
                    }
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "query_type": {"type": "string"},
                        "should_retrieve": {"type": "boolean"},
                        "needs_all_docs": {"type": "boolean"},
                        "suggested_top_k": {"type": "integer"},
                        "reason": {"type": "string"},
                    },
                },
                auth_required=False,
            ),
        ]


_registry: Optional[AgentToolRegistry] = None


def get_agent_tool_registry() -> AgentToolRegistry:
    """Return the singleton agent tool registry."""
    global _registry
    if _registry is None:
        _registry = AgentToolRegistry()
    return _registry
