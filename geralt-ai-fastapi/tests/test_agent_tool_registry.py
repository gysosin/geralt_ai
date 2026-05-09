"""
Tests for agent tool registry contracts.
"""
import json

from core.agents.tool_registry import get_agent_tool_registry


def test_registry_exposes_core_rag_platform_tools():
    registry = get_agent_tool_registry()
    tool_names = {tool.name for tool in registry.list_tools()}

    assert "rag.search" in tool_names
    assert "rag.aggregate" in tool_names
    assert "collection.summarize" in tool_names
    assert "query.plan" in tool_names
    assert "agent.run" in tool_names


def test_mcp_tool_specs_are_secret_safe_and_schema_backed():
    registry = get_agent_tool_registry()
    mcp_tools = registry.list_mcp_tools()

    assert mcp_tools
    for tool in mcp_tools:
        assert "inputSchema" in tool
        assert tool["inputSchema"]["type"] == "object"
        assert "properties" in tool["inputSchema"]
        assert "required" in tool["inputSchema"]

    serialized = json.dumps(mcp_tools).lower()
    blocked_terms = ["api_key", "secret_key", "password", "bearer", "sk-"]
    assert all(term not in serialized for term in blocked_terms)


def test_rag_search_tool_requires_query_and_collections():
    registry = get_agent_tool_registry()
    rag_search = registry.get_tool("rag.search")

    assert rag_search is not None
    schema = rag_search.input_schema()
    assert schema["required"] == ["query", "collection_ids"]
    assert schema["properties"]["collection_ids"]["type"] == "array"
    assert schema["properties"]["query"]["type"] == "string"


def test_agent_run_tool_requires_agent_id_and_query():
    registry = get_agent_tool_registry()
    agent_run = registry.get_tool("agent.run")

    assert agent_run is not None
    schema = agent_run.input_schema()
    assert schema["required"] == ["agent_id", "query"]
    assert schema["properties"]["agent_id"]["type"] == "string"
    assert schema["properties"]["collection_ids"]["type"] == "array"
