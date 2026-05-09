"""
Reusable workflow templates for the agent platform.
"""
from copy import deepcopy
from typing import Dict, List, Optional


class WorkflowTemplateRegistry:
    """Registry of built-in workflow templates."""

    def __init__(self) -> None:
        self._templates = {
            "document_aggregation": {
                "template_id": "document_aggregation",
                "name": "Document Aggregation",
                "description": "Plan a query and aggregate extracted structured data.",
                "required_inputs": ["query", "collection_ids"],
                "steps": [
                    {
                        "name": "Plan route",
                        "tool_name": "query.plan",
                        "arguments": {"query": "{{input.query}}"},
                    },
                    {
                        "name": "Aggregate extracted data",
                        "tool_name": "rag.aggregate",
                        "arguments": {
                            "query": "{{input.query}}",
                            "collection_ids": "{{input.collection_ids}}",
                        },
                    },
                ],
            },
            "document_search": {
                "template_id": "document_search",
                "name": "Document Search",
                "description": "Plan a query and search selected RAG collections.",
                "required_inputs": ["query", "collection_ids"],
                "steps": [
                    {
                        "name": "Plan route",
                        "tool_name": "query.plan",
                        "arguments": {"query": "{{input.query}}"},
                    },
                    {
                        "name": "Search documents",
                        "tool_name": "rag.search",
                        "arguments": {
                            "query": "{{input.query}}",
                            "collection_ids": "{{input.collection_ids}}",
                        },
                    },
                ],
            },
            "collection_summary": {
                "template_id": "collection_summary",
                "name": "Collection Summary",
                "description": "Summarize one selected document collection.",
                "required_inputs": ["collection_id"],
                "steps": [
                    {
                        "name": "Summarize collection",
                        "tool_name": "collection.summarize",
                        "arguments": {"collection_id": "{{input.collection_id}}"},
                    }
                ],
            },
        }

    def list_templates(self) -> List[Dict]:
        """List templates in stable order."""
        return [deepcopy(self._templates[key]) for key in sorted(self._templates)]

    def get_template(self, template_id: str) -> Optional[Dict]:
        """Get one template by ID."""
        template = self._templates.get(template_id)
        return deepcopy(template) if template else None


_template_registry: Optional[WorkflowTemplateRegistry] = None


def get_workflow_template_registry() -> WorkflowTemplateRegistry:
    """Return the singleton workflow template registry."""
    global _template_registry
    if _template_registry is None:
        _template_registry = WorkflowTemplateRegistry()
    return _template_registry
