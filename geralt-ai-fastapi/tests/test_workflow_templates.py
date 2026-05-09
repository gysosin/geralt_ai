"""
Tests for agent workflow templates.
"""
from core.agents.workflow_templates import get_workflow_template_registry


def test_workflow_template_registry_exposes_standard_templates():
    registry = get_workflow_template_registry()
    template_ids = {template["template_id"] for template in registry.list_templates()}

    assert "document_aggregation" in template_ids
    assert "document_search" in template_ids
    assert "collection_summary" in template_ids
    assert "agent_handoff" in template_ids


def test_document_aggregation_template_uses_registered_tool_names():
    registry = get_workflow_template_registry()
    template = registry.get_template("document_aggregation")

    assert template is not None
    assert [step["tool_name"] for step in template["steps"]] == [
        "query.plan",
        "rag.aggregate",
    ]
    assert template["required_inputs"] == ["query", "collection_ids"]


def test_agent_handoff_template_invokes_agent_run_tool():
    registry = get_workflow_template_registry()
    template = registry.get_template("agent_handoff")

    assert template is not None
    assert template["steps"][0]["tool_name"] == "agent.run"
    assert template["required_inputs"] == ["agent_id", "query", "collection_ids"]
