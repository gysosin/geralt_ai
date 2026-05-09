"""
Collection Summarizer

Generate summaries across entire document collections using map-reduce approach.
Handles large collections by summarizing in batches then combining.
"""
import logging
from typing import List, Dict, Optional, Any

from core.ai.factory import AIProviderFactory

logger = logging.getLogger(__name__)


class CollectionSummarizer:
    """
    Generate summaries for entire document collections.

    Uses map-reduce pattern:
    1. MAP: Summarize each document (or use existing extraction summaries)
    2. REDUCE: Combine individual summaries into collection summary
    """

    def __init__(self):
        from models.database import extraction_collection, document_collection
        self.extraction_collection = extraction_collection
        self.document_collection = document_collection
        self.llm = AIProviderFactory.get_llm_provider()
        self.logger = logging.getLogger(f"{self.__class__.__name__}")

    async def summarize(
        self,
        collection_id: str,
        max_docs: int = 50,
    ) -> Dict[str, Any]:
        """
        Generate a summary of the entire collection.

        Args:
            collection_id: Collection to summarize
            max_docs: Maximum documents to include

        Returns:
            Dict with 'summary', 'document_count', 'key_findings'
        """
        try:
            self.logger.info(f"Summarizing collection: {collection_id}")

            # Get document extractions for this collection
            extractions = list(self.extraction_collection.find(
                {"collection_id": collection_id}
            ).limit(max_docs))

            if not extractions:
                # Fallback: Get document info from documents collection
                docs = list(self.document_collection.find(
                    {"collection_id": collection_id, "status": "processed"}
                ).limit(max_docs))

                if not docs:
                    return {
                        "summary": "No processed documents found in this collection.",
                        "document_count": 0,
                        "key_findings": [],
                    }

                # Generate summary from document metadata only
                return await self._summarize_from_metadata(docs)

            # MAP phase: Collect individual document summaries
            doc_summaries = self._collect_summaries(extractions)

            # REDUCE phase: Combine into collection summary
            collection_summary = await self._reduce_summaries(
                doc_summaries,
                extractions
            )

            # Extract key findings
            key_findings = self._extract_key_findings(extractions)

            return {
                "summary": collection_summary,
                "document_count": len(extractions),
                "key_findings": key_findings,
                "document_types": list(set(e.get("document_type", "unknown") for e in extractions)),
            }

        except Exception as e:
            self.logger.error(f"Collection summarization failed: {e}", exc_info=True)
            return {
                "summary": f"Failed to generate summary: {str(e)}",
                "document_count": 0,
                "key_findings": [],
            }

    def _collect_summaries(self, extractions: List[Dict]) -> List[str]:
        """Collect existing summaries from extractions."""
        summaries = []
        for ext in extractions:
            summary = ext.get("summary")
            if summary:
                doc_type = ext.get("document_type", "document")
                title = ext.get("title") or ext.get("document_number") or "Untitled"
                summaries.append(f"[{doc_type.upper()}] {title}: {summary}")
        return summaries

    async def _reduce_summaries(
        self,
        summaries: List[str],
        extractions: List[Dict],
    ) -> str:
        """Combine individual summaries into collection-level summary."""

        # If we have many summaries, batch them
        if len(summaries) > 20:
            # Reduce in batches
            batch_size = 10
            intermediate_summaries = []

            for i in range(0, len(summaries), batch_size):
                batch = summaries[i:i+batch_size]
                batch_summary = await self._summarize_batch(batch)
                intermediate_summaries.append(batch_summary)

            summaries = intermediate_summaries

        # Final reduction
        summaries_text = "\n\n".join(summaries[:30])  # Limit context

        # Calculate stats for context
        total_amount = sum(e.get("total_amount") or 0 for e in extractions)
        doc_types = list(set(e.get("document_type", "unknown") for e in extractions))
        entity_count = sum(len(e.get("entities", [])) for e in extractions)

        prompt = f"""Synthesize these document summaries into a comprehensive collection overview.

Document Summaries:
{summaries_text}

Collection Statistics:
- Total documents: {len(extractions)}
- Document types: {', '.join(doc_types)}
- Total monetary value: ${total_amount:,.2f} (if applicable)
- Entities/parties involved: {entity_count}

Write a 2-3 paragraph summary that:
1. Describes what this collection contains
2. Highlights key themes, patterns, or important information
3. Notes any significant amounts, dates, or parties

Be specific and informative."""

        try:
            summary = await self.llm.complete(prompt, max_tokens=800, temperature=0.3)
            return summary.strip()
        except Exception as e:
            self.logger.warning(f"LLM summarization failed: {e}")
            return f"Collection contains {len(extractions)} documents of types: {', '.join(doc_types)}."

    async def _summarize_batch(self, summaries: List[str]) -> str:
        """Summarize a batch of document summaries."""
        text = "\n".join(summaries)

        prompt = f"""Combine these document summaries into one concise paragraph:

{text}

Write a brief synthesis (2-3 sentences)."""

        try:
            return await self.llm.complete(prompt, max_tokens=200, temperature=0.3)
        except Exception:
            return " | ".join(summaries[:3])

    def _extract_key_findings(self, extractions: List[Dict]) -> List[str]:
        """Extract key findings from extractions."""
        findings = []

        # Top entities
        all_entities = []
        for ext in extractions:
            for ent in ext.get("entities", []):
                all_entities.append(ent.get("name"))

        if all_entities:
            # Get most frequent entities
            entity_counts = {}
            for e in all_entities:
                if e:
                    entity_counts[e] = entity_counts.get(e, 0) + 1

            top_entities = sorted(entity_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            if top_entities:
                findings.append(f"Key parties: {', '.join(e[0] for e in top_entities)}")

        # Total amounts
        total_amount = sum(e.get("total_amount") or 0 for e in extractions)
        if total_amount > 0:
            findings.append(f"Total value: ${total_amount:,.2f}")

        # Document types
        doc_types = list(set(e.get("document_type", "unknown") for e in extractions))
        if doc_types:
            findings.append(f"Document types: {', '.join(doc_types)}")

        return findings

    async def _summarize_from_metadata(self, docs: List[Dict]) -> Dict[str, Any]:
        """Fallback: summarize from document metadata only."""
        file_names = [d.get("file_name", "Unknown") for d in docs]

        summary = f"This collection contains {len(docs)} documents: {', '.join(file_names[:10])}"
        if len(file_names) > 10:
            summary += f" and {len(file_names) - 10} more."

        return {
            "summary": summary,
            "document_count": len(docs),
            "key_findings": [f"Contains {len(docs)} processed documents"],
        }


# Singleton
_summarizer_instance: Optional[CollectionSummarizer] = None


def get_collection_summarizer() -> CollectionSummarizer:
    """Get or create collection summarizer singleton."""
    global _summarizer_instance
    if _summarizer_instance is None:
        _summarizer_instance = CollectionSummarizer()
    return _summarizer_instance
