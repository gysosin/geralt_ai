"""
Tests for deterministic RAG query planning.
"""
from core.rag.query_classifier import QueryClassifier, QueryType


def test_plan_skips_retrieval_for_greetings():
    classifier = QueryClassifier()

    plan = classifier.plan("hi thanks")

    assert plan.query_type == QueryType.CHITCHAT
    assert plan.should_retrieve is False
    assert plan.suggested_top_k == 0


def test_plan_broadens_listing_queries():
    classifier = QueryClassifier()

    plan = classifier.plan("list all vendors and amounts in these documents")

    assert plan.query_type == QueryType.LISTING
    assert plan.should_retrieve is True
    assert plan.needs_all_docs is True
    assert plan.suggested_top_k >= 25


def test_plan_routes_numeric_rollups_to_aggregation():
    classifier = QueryClassifier()

    plan = classifier.plan("what is the total amount by vendor")

    assert plan.query_type == QueryType.AGGREGATION
    assert plan.needs_all_docs is True


def test_plan_keeps_document_summaries_on_summary_route():
    classifier = QueryClassifier()

    plan = classifier.plan("give me a quick overview of this collection")

    assert plan.query_type == QueryType.SUMMARY
    assert plan.should_retrieve is False


def test_plan_broadens_comparison_queries_without_aggregation():
    classifier = QueryClassifier()

    plan = classifier.plan("compare the payment terms across the contracts")

    assert plan.query_type == QueryType.COMPARISON
    assert plan.should_retrieve is True
    assert plan.suggested_top_k >= 20
