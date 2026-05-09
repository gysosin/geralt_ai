"""
Aggregation Engine

Execute aggregation queries on extracted structured data stored in MongoDB.
Provides collection-wide statistics, summaries, and cross-document data aggregation.
"""
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from core.ai.factory import AIProviderFactory

logger = logging.getLogger(__name__)


class AggregationEngine:
    """
    Execute aggregation queries on extracted document data.

    Queries MongoDB's document_extractions collection to answer
    questions like "total payments by vendor" or "contracts expiring this month".
    """

    def __init__(self):
        from models.database import extraction_collection
        self.collection = extraction_collection
        self.llm = AIProviderFactory.get_llm_provider()
        self.logger = logging.getLogger(f"{self.__class__.__name__}")

    async def aggregate(
        self,
        query: str,
        collection_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Execute an aggregation query.

        Args:
            query: Natural language query
            collection_ids: Optional filter to specific collections

        Returns:
            Dict with 'answer', 'data', and 'metadata'
        """
        try:
            self.logger.info(f"Aggregation query: {query[:50]}...")

            # Get collection stats first
            stats = await self.get_collection_stats(collection_ids)

            if stats["total_documents"] == 0:
                return {
                    "answer": "No documents with extracted data found in this collection.",
                    "data": [],
                    "metadata": {"documents_analyzed": 0}
                }

            # Get all extractions for analysis
            extractions = self._get_extractions(collection_ids)

            # Build aggregation result based on query type
            aggregation_data = self._run_aggregation(query, extractions)

            # Format answer with LLM
            answer = await self._format_answer(query, aggregation_data, stats)

            return {
                "answer": answer,
                "data": aggregation_data,
                "metadata": {
                    "documents_analyzed": stats["total_documents"],
                    "total_amount": stats.get("total_amount"),
                    "document_types": stats.get("document_types", []),
                }
            }

        except Exception as e:
            self.logger.error(f"Aggregation failed: {e}", exc_info=True)
            return {
                "answer": f"Failed to run aggregation: {str(e)}",
                "data": [],
                "metadata": {"error": str(e)}
            }

    async def get_collection_stats(
        self,
        collection_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Get statistics for a collection's extracted data.

        Args:
            collection_ids: Optional filter

        Returns:
            Dict with document counts, total amounts, document types, etc.
        """
        match_filter = {}
        if collection_ids:
            match_filter["collection_id"] = {"$in": collection_ids}

        pipeline = [
            {"$match": match_filter},
            {
                "$group": {
                    "_id": None,
                    "total_documents": {"$sum": 1},
                    "total_amount": {"$sum": {"$ifNull": ["$total_amount", 0]}},
                    "document_types": {"$addToSet": "$document_type"},
                    "entities_count": {"$sum": {"$size": {"$ifNull": ["$entities", []]}}},
                    "amounts_count": {"$sum": {"$size": {"$ifNull": ["$amounts", []]}}},
                }
            }
        ]

        result = list(self.collection.aggregate(pipeline))

        if not result:
            return {
                "total_documents": 0,
                "total_amount": 0,
                "document_types": [],
                "entities_count": 0,
                "amounts_count": 0,
            }

        stats = result[0]
        stats.pop("_id", None)
        return stats

    def _get_extractions(
        self,
        collection_ids: Optional[List[str]] = None,
        limit: int = 100,
    ) -> List[Dict]:
        """Get all extractions for analysis."""
        query = {}
        if collection_ids:
            query["collection_id"] = {"$in": collection_ids}

        return list(self.collection.find(query).limit(limit))

    def _run_aggregation(
        self,
        query: str,
        extractions: List[Dict],
    ) -> List[Dict]:
        """
        Run appropriate aggregation based on query.

        Detects query intent and runs matching aggregation.
        """
        query_lower = query.lower()

        # Check for amount-based queries
        if any(kw in query_lower for kw in ["total", "sum", "amount", "payment", "value"]):
            return self._aggregate_amounts(extractions, query_lower)

        # Check for entity-based queries
        if any(kw in query_lower for kw in ["vendor", "company", "party", "parties", "entity"]):
            return self._aggregate_entities(extractions, query_lower)

        # Check for date-based queries
        if any(kw in query_lower for kw in ["date", "when", "expir", "due", "month", "year"]):
            return self._aggregate_dates(extractions, query_lower)

        # Default: return document type breakdown
        return self._aggregate_by_type(extractions)

    def _aggregate_amounts(
        self,
        extractions: List[Dict],
        query: str,
    ) -> List[Dict]:
        """Aggregate amounts/payments."""
        results = []

        # Check if grouping by vendor is requested
        group_by_vendor = "by vendor" in query or "per vendor" in query

        if group_by_vendor:
            vendor_totals = {}
            for ext in extractions:
                # Find vendor/company in entities
                vendor = None
                for entity in ext.get("entities", []):
                    if entity.get("role") in ["vendor", "seller", "supplier"]:
                        vendor = entity.get("name")
                        break
                    if entity.get("type") == "company":
                        vendor = entity.get("name")

                vendor = vendor or "Unknown"
                amount = ext.get("total_amount") or 0

                if vendor not in vendor_totals:
                    vendor_totals[vendor] = {"vendor": vendor, "total": 0, "count": 0}
                vendor_totals[vendor]["total"] += amount
                vendor_totals[vendor]["count"] += 1

            results = sorted(vendor_totals.values(), key=lambda x: x["total"], reverse=True)
        else:
            # Simple sum of all amounts
            total = sum(ext.get("total_amount") or 0 for ext in extractions)
            doc_count = len([e for e in extractions if e.get("total_amount")])
            results = [{
                "total_amount": total,
                "documents_with_amounts": doc_count,
                "currency": self._get_most_common_currency(extractions),
            }]

        return results

    def _aggregate_entities(
        self,
        extractions: List[Dict],
        query: str,
    ) -> List[Dict]:
        """Aggregate entities/vendors."""
        entity_counts = {}

        for ext in extractions:
            for entity in ext.get("entities", []):
                name = entity.get("name")
                if not name:
                    continue

                if name not in entity_counts:
                    entity_counts[name] = {
                        "name": name,
                        "type": entity.get("type"),
                        "role": entity.get("role"),
                        "count": 0,
                        "documents": [],
                    }
                entity_counts[name]["count"] += 1
                entity_counts[name]["documents"].append(ext.get("document_id"))

        return sorted(entity_counts.values(), key=lambda x: x["count"], reverse=True)[:20]

    def _aggregate_dates(
        self,
        extractions: List[Dict],
        query: str,
    ) -> List[Dict]:
        """Aggregate by dates."""
        results = []

        for ext in extractions:
            for date_obj in ext.get("dates", []):
                results.append({
                    "document_id": ext.get("document_id"),
                    "document_type": ext.get("document_type"),
                    "date": date_obj.get("date") or date_obj.get("date_string"),
                    "label": date_obj.get("label"),
                    "title": ext.get("title"),
                })

        # Sort by date
        results.sort(key=lambda x: str(x.get("date") or ""), reverse=True)
        return results[:50]

    def _aggregate_by_type(
        self,
        extractions: List[Dict],
    ) -> List[Dict]:
        """Count documents by type."""
        type_counts = {}

        for ext in extractions:
            doc_type = ext.get("document_type") or "unknown"
            if doc_type not in type_counts:
                type_counts[doc_type] = {"type": doc_type, "count": 0}
            type_counts[doc_type]["count"] += 1

        return sorted(type_counts.values(), key=lambda x: x["count"], reverse=True)

    def _get_most_common_currency(self, extractions: List[Dict]) -> str:
        """Get most common currency."""
        currencies = [e.get("currency") for e in extractions if e.get("currency")]
        if not currencies:
            return "USD"
        return max(set(currencies), key=currencies.count)

    async def _format_answer(
        self,
        query: str,
        data: List[Dict],
        stats: Dict,
    ) -> str:
        """Use LLM to format aggregation results into natural language."""
        prompt = f"""Given this aggregation query and data, provide a clear, concise answer.

Query: {query}

Aggregation Results:
{data[:10]}  # Limit to first 10 for context

Collection Stats:
- Total documents analyzed: {stats.get('total_documents', 0)}
- Document types: {stats.get('document_types', [])}

Provide a direct answer to the query based on the data. Be specific with numbers and names."""

        try:
            answer = await self.llm.complete(prompt, max_tokens=500, temperature=0.3)
            return answer.strip()
        except Exception as e:
            self.logger.warning(f"LLM formatting failed: {e}")
            # Fallback to simple formatting
            return f"Found {len(data)} results across {stats.get('total_documents', 0)} documents."


# Singleton
_engine_instance: Optional[AggregationEngine] = None


def get_aggregation_engine() -> AggregationEngine:
    """Get or create aggregation engine singleton."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = AggregationEngine()
    return _engine_instance
