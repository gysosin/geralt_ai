"""
Tests for RAG pipeline routing behavior.
"""
import pytest

from core.rag.pipeline import RAGPipeline


class RecordingRetriever:
    def __init__(self):
        self.calls = []

    async def retrieve(self, **kwargs):
        self.calls.append(kwargs)
        return []


class FakeLLM:
    model_name = "fake-llm"

    async def complete(self, *args, **kwargs):
        return "fake answer"


@pytest.mark.asyncio
async def test_pipeline_skips_retrieval_for_chitchat_with_collection():
    retriever = RecordingRetriever()
    pipeline = RAGPipeline(retriever, FakeLLM())

    response = await pipeline.query("hi thanks", collection_ids=["col-1"])

    assert response.query_type == "chitchat"
    assert response.routing["retrieved"] is False
    assert response.retrieval_count == 0
    assert retriever.calls == []


@pytest.mark.asyncio
async def test_pipeline_broadens_listing_retrieval_depth():
    retriever = RecordingRetriever()
    pipeline = RAGPipeline(retriever, FakeLLM())

    response = await pipeline.query(
        "list all vendors and amounts in these documents",
        collection_ids=["col-1"],
        top_k=5,
        rerank_top_n=3,
    )

    assert response.query_type == "listing"
    assert retriever.calls[0]["top_k"] >= 25
    assert response.routing["suggested_top_k"] >= 25
