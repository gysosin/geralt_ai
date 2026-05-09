"""
Reusable agent templates for common document intelligence jobs.
"""
from copy import deepcopy
from typing import Dict, List, Optional


class AgentTemplateRegistry:
    """Registry of built-in agent templates."""

    def __init__(self) -> None:
        self._templates = {
            "collection_summarizer": {
                "template_id": "collection_summarizer",
                "name": "Collection Summarizer",
                "description": "Summarize one selected document collection with a concise grounded brief.",
                "instruction": (
                    "Summarize the selected collection, preserve important facts, "
                    "and clearly separate grounded findings from missing context."
                ),
                "tool_names": ["collection.summarize"],
                "model": "default",
            },
            "document_research": {
                "template_id": "document_research",
                "name": "Document Research Agent",
                "description": "Plan a document question and retrieve grounded supporting passages.",
                "instruction": (
                    "Plan the user's document question, search selected collections, "
                    "and answer only from grounded retrieved evidence."
                ),
                "tool_names": ["query.plan", "rag.search"],
                "model": "default",
            },
            "structured_data_analyst": {
                "template_id": "structured_data_analyst",
                "name": "Structured Data Analyst",
                "description": "Plan and aggregate structured values extracted from documents.",
                "instruction": (
                    "Classify the request, aggregate extracted structured data, "
                    "and return totals, counts, and caveats that are traceable to source collections."
                ),
                "tool_names": ["query.plan", "rag.aggregate"],
                "model": "default",
            },
        }

    def list_templates(self) -> List[Dict]:
        """List templates in stable order."""
        return [deepcopy(self._templates[key]) for key in sorted(self._templates)]

    def get_template(self, template_id: str) -> Optional[Dict]:
        """Get one template by ID."""
        template = self._templates.get(template_id)
        return deepcopy(template) if template else None


_agent_template_registry: Optional[AgentTemplateRegistry] = None


def get_agent_template_registry() -> AgentTemplateRegistry:
    """Return the singleton agent template registry."""
    global _agent_template_registry
    if _agent_template_registry is None:
        _agent_template_registry = AgentTemplateRegistry()
    return _agent_template_registry
