"""
Tests for agent and workflow definition services.
"""
from unittest.mock import MagicMock

from services.agents.agent_platform_service import AgentPlatformService


def test_create_agent_definition_stores_valid_tool_contract():
    agent_db = MagicMock()
    workflow_db = MagicMock()
    service = AgentPlatformService(agent_db=agent_db, workflow_db=workflow_db)

    result = service.create_agent(
        owner="mehul",
        name="Invoice Analyst",
        instruction="Analyze invoices and surface risks.",
        tool_names=["rag.search", "rag.aggregate"],
        description="Finance document agent",
        model="gemini-2.5-flash",
        collection_ids=["collection-1"],
    )

    assert result.success is True
    inserted = agent_db.insert_one.call_args.args[0]
    assert inserted["agent_id"] == result.data["agent_id"]
    assert inserted["tool_names"] == ["rag.search", "rag.aggregate"]
    assert inserted["created_by"] == "mehul"


def test_create_agent_definition_rejects_unknown_tool():
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=MagicMock())

    result = service.create_agent(
        owner="mehul",
        name="Broken Agent",
        instruction="Use missing tools.",
        tool_names=["rag.search", "missing.tool"],
    )

    assert result.success is False
    assert result.status_code == 400
    assert "missing.tool" in result.error


def test_create_workflow_definition_validates_step_tools():
    workflow_db = MagicMock()
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=workflow_db)

    result = service.create_workflow(
        owner="mehul",
        name="Invoice Review Flow",
        steps=[
            {
                "name": "Plan query",
                "tool_name": "query.plan",
                "arguments": {"query": "{{input.query}}"},
            },
            {
                "name": "Search source documents",
                "tool_name": "rag.search",
                "arguments": {
                    "query": "{{input.query}}",
                    "collection_ids": "{{input.collection_ids}}",
                },
            },
        ],
        description="Plan, search, then answer",
    )

    assert result.success is True
    inserted = workflow_db.insert_one.call_args.args[0]
    assert inserted["workflow_id"] == result.data["workflow_id"]
    assert inserted["steps"][0]["tool_name"] == "query.plan"
    assert inserted["steps"][0]["step_id"]


def test_create_workflow_definition_rejects_unknown_step_tool():
    service = AgentPlatformService(agent_db=MagicMock(), workflow_db=MagicMock())

    result = service.create_workflow(
        owner="mehul",
        name="Bad Flow",
        steps=[{"name": "Missing", "tool_name": "missing.tool"}],
    )

    assert result.success is False
    assert result.status_code == 400
    assert "missing.tool" in result.error
