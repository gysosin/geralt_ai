"""
Tests for agent tool execution.
"""
from core.agents.tool_executor import AgentToolExecutor
from core.rag.aggregation_engine import AggregationEngine


class FakeCursor(list):
    def limit(self, count):
        return FakeCursor(self[:count])


class FakeExtractionCollection:
    def __init__(self, documents):
        self.documents = documents

    def aggregate(self, pipeline):
        match_stage = pipeline[0].get("$match", {}) if pipeline else {}
        documents = self._filter(match_stage)
        return [{
            "_id": None,
            "total_documents": len(documents),
            "total_amount": sum(doc.get("total_amount") or 0 for doc in documents),
            "document_types": sorted({doc.get("document_type") for doc in documents}),
            "entities_count": sum(len(doc.get("entities", [])) for doc in documents),
            "amounts_count": sum(len(doc.get("amounts", [])) for doc in documents),
        }]

    def find(self, query):
        return FakeCursor(self._filter(query))

    def _filter(self, query):
        collection_filter = query.get("collection_id", {})
        allowed_ids = collection_filter.get("$in")
        if not allowed_ids:
            return list(self.documents)
        return [doc for doc in self.documents if doc.get("collection_id") in allowed_ids]


def test_executor_runs_query_plan_tool():
    executor = AgentToolExecutor()

    result = executor.execute("query.plan", {"query": "list all vendors"})

    assert result["query_type"] == "listing"
    assert result["needs_all_docs"] is True


def test_executor_runs_deterministic_aggregation_tool():
    engine = AggregationEngine(
        collection=FakeExtractionCollection([
            {
                "collection_id": "collection-1",
                "document_id": "doc-1",
                "document_type": "invoice",
                "total_amount": 120,
                "currency": "USD",
                "entities": [{"name": "Acme", "type": "company", "role": "vendor"}],
            },
            {
                "collection_id": "collection-1",
                "document_id": "doc-2",
                "document_type": "invoice",
                "total_amount": 80,
                "currency": "USD",
                "entities": [{"name": "Acme", "type": "company", "role": "vendor"}],
            },
        ]),
        load_llm=False,
    )
    executor = AgentToolExecutor(aggregation_engine=engine)

    result = executor.execute(
        "rag.aggregate",
        {"query": "total amount by vendor", "collection_ids": ["collection-1"]},
    )

    assert result["metadata"]["documents_analyzed"] == 2
    assert result["data"][0]["vendor"] == "Acme"
    assert result["data"][0]["total"] == 200
    assert "2 documents" in result["answer"]
