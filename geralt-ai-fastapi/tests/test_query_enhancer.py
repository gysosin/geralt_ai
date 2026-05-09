"""
Tests for RAG query enhancement guardrails.
"""
import pytest

from core.rag.query_enhancer import QueryEnhancer


class FakeLLM:
    def __init__(self, response: str):
        self.response = response

    async def complete(self, *args, **kwargs):
        return self.response


@pytest.mark.asyncio
async def test_llm_query_enhancement_rejects_topic_drift():
    """LLM rewrites must preserve the user's original retrieval intent."""
    enhancer = QueryEnhancer(use_llm=False)
    enhancer.use_llm = True
    enhancer.llm = FakeLLM("weather forecast for paris next weekend")

    result = await enhancer.enhance("show total invoice amount for Acme")

    assert result == "show total invoice amount for Acme"


def test_rule_based_enhancement_expands_uppercase_purchase_order():
    """Common document acronyms expand regardless of user casing."""
    enhancer = QueryEnhancer(use_llm=False)

    result = enhancer._enhance_rule_based("Show PO totals by vendor")

    assert "purchase order" in result.lower()
    assert "totals by vendor" in result
