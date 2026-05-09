"""
Tests for reusable agent templates.
"""
from core.agents.agent_templates import get_agent_template_registry


def test_agent_template_registry_exposes_standard_templates():
    registry = get_agent_template_registry()
    template_ids = {template["template_id"] for template in registry.list_templates()}

    assert "document_research" in template_ids
    assert "structured_data_analyst" in template_ids
    assert "collection_summarizer" in template_ids


def test_document_research_template_uses_registered_tool_names():
    registry = get_agent_template_registry()
    template = registry.get_template("document_research")

    assert template is not None
    assert template["tool_names"] == ["query.plan", "rag.search"]
    assert "grounded" in template["instruction"].lower()
