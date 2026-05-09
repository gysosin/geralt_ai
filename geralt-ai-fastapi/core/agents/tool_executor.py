"""
Agent tool executor.

Executes deterministic local tools used by workflow runs.
"""
import json
import re
from typing import Any, Dict, List, Optional

from core.rag.query_classifier import get_query_classifier


class DeterministicRagSearcher:
    """Source-grounded document search that avoids provider calls during workflows."""

    MAX_SCAN_DOCUMENTS = 500

    def __init__(self, extraction_collection=None, document_collection=None) -> None:
        if extraction_collection is None:
            from models.database import extraction_collection
        if document_collection is None:
            from models.database import document_collection

        self.extraction_collection = extraction_collection
        self.document_collection = document_collection

    def search(
        self,
        query: str,
        collection_ids: Optional[List[str]] = None,
        top_k: int = 10,
    ) -> Dict[str, Any]:
        """Search structured extraction records and return extractive evidence."""
        normalized_query = str(query or "").strip()
        selected_collections = [str(item) for item in collection_ids or [] if str(item).strip()]
        bounded_top_k = max(1, min(int(top_k or 10), 25))

        if not normalized_query:
            raise ValueError("query is required")
        if not selected_collections:
            raise ValueError("collection_ids must include at least one collection")

        documents = self._load_extractions(selected_collections)
        evidence_source = "extractions"
        if not documents:
            documents = self._load_document_summaries(selected_collections)
            evidence_source = "document_summaries"

        if not documents:
            return {
                "answer": "No searchable document evidence was found in the selected collections.",
                "sources": [],
                "routing": {
                    "method": "deterministic_extraction_search",
                    "source": evidence_source,
                    "collection_ids": selected_collections,
                    "top_k": bounded_top_k,
                    "matched_count": 0,
                },
            }

        query_tokens = self._tokenize(normalized_query)
        ranked = sorted(
            (
                (self._score_document(doc, normalized_query, query_tokens), doc)
                for doc in documents
            ),
            key=lambda item: item[0],
            reverse=True,
        )
        matches = [(score, doc) for score, doc in ranked if score > 0][:bounded_top_k]

        if not matches:
            return {
                "answer": "No matching extracted evidence was found for this query.",
                "sources": [],
                "routing": {
                    "method": "deterministic_extraction_search",
                    "source": evidence_source,
                    "collection_ids": selected_collections,
                    "top_k": bounded_top_k,
                    "matched_count": 0,
                    "documents_scanned": len(documents),
                },
            }

        sources = [self._source_payload(doc, score) for score, doc in matches]
        evidence_lines = [
            f"{source['title']}: {source['summary']}".strip()
            for source in sources
            if source.get("summary")
        ]
        answer = (
            f"Found {len(sources)} matching document"
            f"{'' if len(sources) == 1 else 's'} in extracted evidence."
        )
        if evidence_lines:
            answer = f"{answer} Top evidence: " + " ".join(evidence_lines[:3])

        return {
            "answer": answer,
            "sources": sources,
            "routing": {
                "method": "deterministic_extraction_search",
                "source": evidence_source,
                "collection_ids": selected_collections,
                "top_k": bounded_top_k,
                "matched_count": len(sources),
                "documents_scanned": len(documents),
            },
        }

    def _load_extractions(self, collection_ids: List[str]) -> List[Dict[str, Any]]:
        cursor = self.extraction_collection.find({"collection_id": {"$in": collection_ids}})
        if hasattr(cursor, "limit"):
            cursor = cursor.limit(self.MAX_SCAN_DOCUMENTS)
        return list(cursor)

    def _load_document_summaries(self, collection_ids: List[str]) -> List[Dict[str, Any]]:
        cursor = self.document_collection.find({
            "collection_id": {"$in": collection_ids},
            "status": {"$ne": "deleting"},
        })
        if hasattr(cursor, "limit"):
            cursor = cursor.limit(self.MAX_SCAN_DOCUMENTS)
        return [self._document_summary_payload(doc) for doc in cursor]

    def _document_summary_payload(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "document_id": str(doc.get("_id") or doc.get("document_id") or ""),
            "collection_id": str(doc.get("collection_id", "")),
            "title": doc.get("file_name") or doc.get("url") or "Untitled document",
            "summary": doc.get("extraction_summary") or doc.get("latest_status") or "",
            "document_type": doc.get("extraction_type") or doc.get("type") or "document",
            "status": doc.get("status"),
            "reference_numbers": [],
            "entities": [],
            "dates": [],
            "amounts": [],
            "line_items": [],
            "key_terms": [],
            "additional_fields": {
                "url": doc.get("url"),
                "processed": doc.get("processed"),
                "resource_type": doc.get("resource_type"),
            },
        }

    def _score_document(self, doc: Dict[str, Any], query: str, query_tokens: set[str]) -> int:
        search_text = self._search_text(doc)
        if not search_text:
            return 0

        score = sum(1 for token in query_tokens if token in search_text)
        if query.lower() in search_text:
            score += 5
        if doc.get("title") and any(token in str(doc["title"]).lower() for token in query_tokens):
            score += 2
        if doc.get("summary") and any(token in str(doc["summary"]).lower() for token in query_tokens):
            score += 2
        return score

    def _search_text(self, doc: Dict[str, Any]) -> str:
        fields = [
            doc.get("title"),
            doc.get("summary"),
            doc.get("document_type"),
            doc.get("document_subtype"),
            doc.get("document_number"),
            doc.get("status"),
            doc.get("currency"),
            doc.get("reference_numbers"),
            doc.get("entities"),
            doc.get("dates"),
            doc.get("amounts"),
            doc.get("line_items"),
            doc.get("key_terms"),
            doc.get("additional_fields"),
            doc.get("raw_extraction"),
        ]
        return " ".join(self._stringify(field) for field in fields if field is not None).lower()

    def _source_payload(self, doc: Dict[str, Any], score: int) -> Dict[str, Any]:
        title = doc.get("title") or doc.get("document_number") or doc.get("document_id") or "Untitled document"
        return {
            "document_id": str(doc.get("document_id", "")),
            "collection_id": str(doc.get("collection_id", "")),
            "title": str(title),
            "document_type": doc.get("document_type") or "unknown",
            "summary": doc.get("summary") or "",
            "score": score,
            "entities": self._named_items(doc.get("entities", [])),
            "amounts": self._amount_items(doc.get("amounts", [])),
        }

    def _named_items(self, items: Any) -> List[str]:
        if not isinstance(items, list):
            return []
        names = []
        for item in items[:5]:
            if isinstance(item, dict):
                name = item.get("name")
                if name:
                    names.append(str(name))
        return names

    def _amount_items(self, items: Any) -> List[Dict[str, Any]]:
        if not isinstance(items, list):
            return []
        amounts = []
        for item in items[:5]:
            if isinstance(item, dict):
                amounts.append({
                    "value": item.get("value"),
                    "currency": item.get("currency"),
                    "label": item.get("label") or item.get("type"),
                })
        return amounts

    def _tokenize(self, text: str) -> set[str]:
        return {
            token
            for token in re.findall(r"[a-z0-9][a-z0-9._-]*", text.lower())
            if len(token) > 1
        }

    def _stringify(self, value: Any) -> str:
        if isinstance(value, str):
            return value
        try:
            return json.dumps(value, default=str, sort_keys=True)
        except TypeError:
            return str(value)


class AgentToolExecutor:
    """Execute supported registered tools."""

    def __init__(
        self,
        aggregation_engine=None,
        collection_summarizer=None,
        rag_searcher=None,
    ) -> None:
        self.aggregation_engine = aggregation_engine
        self.collection_summarizer = collection_summarizer
        self.rag_searcher = rag_searcher

    def execute(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool synchronously when safe."""
        if tool_name == "query.plan":
            return self._execute_query_plan(arguments)
        if tool_name == "rag.search":
            return self._execute_rag_search(arguments)
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

    def _execute_rag_search(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        searcher = self.rag_searcher or self._get_default_rag_searcher()
        return searcher.search(
            query=arguments.get("query", ""),
            collection_ids=arguments.get("collection_ids") or [],
            top_k=arguments.get("top_k", 10),
        )

    def _get_default_rag_searcher(self):
        self.rag_searcher = DeterministicRagSearcher()
        return self.rag_searcher

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
