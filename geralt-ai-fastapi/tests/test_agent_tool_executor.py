"""
Tests for agent tool execution.
"""
from core.agents.tool_executor import AgentToolExecutor, DeterministicRagSearcher
from core.rag.aggregation_engine import AggregationEngine
from core.rag.collection_summarizer import CollectionSummarizer


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
        allowed_ids = (
            collection_filter.get("$in")
            if isinstance(collection_filter, dict)
            else [collection_filter]
        )
        if not allowed_ids:
            return list(self.documents)
        return [doc for doc in self.documents if doc.get("collection_id") in allowed_ids]


class FakeDocumentCollection:
    def __init__(self, documents):
        self.documents = documents

    def find(self, query):
        collection_id = query.get("collection_id")
        status = query.get("status")
        documents = [
            doc for doc in self.documents
            if (not collection_id or doc.get("collection_id") == collection_id)
            and (not status or doc.get("status") == status)
        ]
        return FakeCursor(documents)


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


def test_executor_runs_deterministic_rag_search_tool():
    searcher = DeterministicRagSearcher(
        extraction_collection=FakeExtractionCollection([
            {
                "collection_id": "collection-1",
                "document_id": "doc-1",
                "document_type": "contract",
                "title": "Acme Warranty Agreement",
                "summary": "Acme provides a two year warranty for hardware support.",
                "entities": [{"name": "Acme", "type": "company"}],
                "amounts": [{"value": 1200, "currency": "USD", "label": "support fee"}],
            },
            {
                "collection_id": "collection-1",
                "document_id": "doc-2",
                "document_type": "invoice",
                "title": "Contoso Invoice",
                "summary": "Monthly services invoice.",
                "entities": [{"name": "Contoso", "type": "company"}],
            },
        ]),
        document_collection=FakeDocumentCollection([]),
    )
    executor = AgentToolExecutor(rag_searcher=searcher)

    result = executor.execute(
        "rag.search",
        {
            "query": "Acme warranty",
            "collection_ids": ["collection-1"],
            "top_k": 1,
        },
    )

    assert result["routing"]["method"] == "deterministic_extraction_search"
    assert result["routing"]["matched_count"] == 1
    assert result["sources"][0]["document_id"] == "doc-1"
    assert result["sources"][0]["title"] == "Acme Warranty Agreement"
    assert "Top evidence" in result["answer"]


def test_executor_runs_deterministic_collection_summary_tool():
    summarizer = CollectionSummarizer(
        extraction_collection=FakeExtractionCollection([
            {
                "collection_id": "collection-1",
                "document_id": "doc-1",
                "document_type": "invoice",
                "title": "Invoice 1",
                "summary": "First invoice for Acme.",
                "total_amount": 120,
                "entities": [{"name": "Acme"}],
            },
            {
                "collection_id": "collection-1",
                "document_id": "doc-2",
                "document_type": "contract",
                "title": "Contract 1",
                "summary": "Service agreement with Acme.",
                "total_amount": 80,
                "entities": [{"name": "Acme"}],
            },
        ]),
        document_collection=FakeDocumentCollection([]),
        load_llm=False,
    )
    executor = AgentToolExecutor(collection_summarizer=summarizer)

    result = executor.execute("collection.summarize", {"collection_id": "collection-1"})

    assert result["document_count"] == 2
    assert "invoice" in result["document_types"]
    assert "contract" in result["document_types"]
    assert any("Acme" in finding for finding in result["key_findings"])
