"""
Agent tool executor.

Executes deterministic local tools used by workflow runs. Provider-backed RAG
search stays outside this sync executor until an async runner is added.
"""
from typing import Any, Dict, Optional

from core.rag.query_classifier import get_query_classifier


class AgentToolExecutor:
    """Execute supported registered tools."""

    def __init__(self, aggregation_engine=None, collection_summarizer=None) -> None:
        self.aggregation_engine = aggregation_engine
        self.collection_summarizer = collection_summarizer

    def execute(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool synchronously when safe."""
        if tool_name == "query.plan":
            return self._execute_query_plan(arguments)
        if tool_name == "rag.aggregate":
            return self._execute_rag_aggregate(arguments)
        if tool_name == "collection.summarize":
            return self._execute_collection_summarize(arguments)
        raise NotImplementedError(f"Execution for {tool_name} is not implemented yet")

    def _execute_query_plan(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        plan = get_query_classifier().plan(arguments.get("query", ""))
        return {
            "query_type": plan.query_type.value,
            "should_retrieve": plan.should_retrieve,
            "needs_all_docs": plan.needs_all_docs,
            "suggested_top_k": plan.suggested_top_k,
            "suggested_rerank_top_n": plan.suggested_rerank_top_n,
            "reason": plan.reason,
        }

    def _execute_rag_aggregate(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        engine = self.aggregation_engine or self._get_default_aggregation_engine()
        return engine.aggregate_deterministic(
            query=arguments.get("query", ""),
            collection_ids=arguments.get("collection_ids") or [],
        )

    def _get_default_aggregation_engine(self):
        from core.rag.aggregation_engine import AggregationEngine

        self.aggregation_engine = AggregationEngine(load_llm=False)
        return self.aggregation_engine

    def _execute_collection_summarize(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        summarizer = self.collection_summarizer or self._get_default_collection_summarizer()
        return summarizer.summarize_deterministic(
            collection_id=arguments.get("collection_id", ""),
            max_docs=arguments.get("max_docs", 50),
        )

    def _get_default_collection_summarizer(self):
        from core.rag.collection_summarizer import CollectionSummarizer

        self.collection_summarizer = CollectionSummarizer(load_llm=False)
        return self.collection_summarizer


_executor_instance: Optional[AgentToolExecutor] = None


def get_agent_tool_executor() -> AgentToolExecutor:
    """Return the singleton tool executor."""
    global _executor_instance
    if _executor_instance is None:
        _executor_instance = AgentToolExecutor()
    return _executor_instance
