"""
Query Enhancer

Rewrites and expands user queries before retrieval to improve search results.
Uses LLM to generate better search terms and disambiguate intent.
"""
import logging
import re
from typing import Optional

from core.ai.factory import AIProviderFactory

logger = logging.getLogger(__name__)


_DRIFT_JACCARD_THRESHOLD = 0.2
_DRIFT_NEW_TOKEN_THRESHOLD = 3
_DRIFT_MIN_TOKEN_LEN = 2
_DRIFT_MIN_ORIGINAL_TOKENS = 2


def _meaningful_tokens(text: str) -> set:
    """Lowercased word tokens used to compare query rewrite drift."""
    return {t for t in re.findall(r"\w+", text.lower()) if len(t) > _DRIFT_MIN_TOKEN_LEN}


def _jaccard(a: str, b: str) -> tuple[float, set, set]:
    """Return token Jaccard similarity and token sets."""
    left = _meaningful_tokens(a)
    right = _meaningful_tokens(b)
    if not left or not right:
        return 1.0, left, right
    return len(left & right) / len(left | right), left, right


QUERY_ENHANCEMENT_PROMPT = '''You are a search query optimizer. Given a user's question, rewrite it to be more effective for semantic search and keyword matching while strictly preserving the user's intent.

Rules:
1. Expand abbreviations and acronyms
2. Fix obvious typos
3. Add only directly synonymous terms
4. Extract key entities already present; do not invent new entities or topics
5. If the original query is clear, return it unchanged
6. Keep the enhanced query concise (max 200 chars)

User Query: "{query}"

Respond with ONLY the enhanced query, nothing else:'''


class QueryEnhancer:
    """
    Enhance user queries for better retrieval.

    Capabilities:
    - Query expansion with synonyms
    - Entity extraction
    - Intent clarification
    """

    def __init__(self, use_llm: bool = True):
        """
        Initialize enhancer.

        Args:
            use_llm: If True, use LLM for enhancement. If False, use rule-based only.
        """
        self.use_llm = use_llm
        self.llm = AIProviderFactory.get_llm_provider() if use_llm else None
        self.logger = logging.getLogger(f"{self.__class__.__name__}")

    async def enhance(self, query: str) -> str:
        """
        Enhance a query for better retrieval.

        Args:
            query: Original user query

        Returns:
            Enhanced query string
        """
        # Skip enhancement for very short or already good queries
        if len(query) < 10 or self._is_already_specific(query):
            return query

        if self.use_llm and self.llm:
            try:
                enhanced = await self._enhance_with_llm(query)
                if self._has_topic_drift(query, enhanced):
                    self.logger.warning(
                        "Rejecting query enhancement due to topic drift: '%s...' -> '%s...'",
                        query[:80],
                        enhanced[:80],
                    )
                    return self._enhance_rule_based(query)
                self.logger.info(f"Query enhanced: '{query[:30]}...' -> '{enhanced[:30]}...'")
                return enhanced
            except Exception as e:
                self.logger.warning(f"LLM enhancement failed: {e}")
                return self._enhance_rule_based(query)
        else:
            return self._enhance_rule_based(query)

    async def _enhance_with_llm(self, query: str) -> str:
        """Use LLM to enhance query."""
        prompt = QUERY_ENHANCEMENT_PROMPT.format(query=query)

        response = await self.llm.complete(
            prompt=prompt,
            max_tokens=100,
            temperature=0.3,
        )

        enhanced = response.strip().strip('"').strip("'")

        # Fallback if LLM returns empty or too different
        if not enhanced or len(enhanced) < 5:
            return query

        return enhanced

    def _enhance_rule_based(self, query: str) -> str:
        """Rule-based query enhancement."""
        enhanced = query

        # Common abbreviation expansions
        expansions = {
            "po": "purchase order",
            "nda": "non-disclosure agreement",
            "sow": "statement of work",
            "msa": "master service agreement",
            "sla": "service level agreement",
            "roi": "return on investment",
            "kpi": "key performance indicator",
        }

        query_lower = query.lower()
        for abbrev, expansion in expansions.items():
            if f" {abbrev} " in f" {query_lower} " or query_lower.startswith(f"{abbrev} ") or query_lower.endswith(f" {abbrev}"):
                enhanced = re.sub(
                    rf"\b{re.escape(abbrev)}\b",
                    expansion,
                    enhanced,
                    count=1,
                    flags=re.IGNORECASE,
                )
                break

        return enhanced

    def _has_topic_drift(self, original: str, enhanced: str) -> bool:
        """Detect LLM rewrites that introduce a different retrieval topic."""
        similarity, original_tokens, enhanced_tokens = _jaccard(original, enhanced)
        if len(original_tokens) < _DRIFT_MIN_ORIGINAL_TOKENS:
            return False

        new_tokens = enhanced_tokens - original_tokens
        return (
            similarity < _DRIFT_JACCARD_THRESHOLD
            and len(new_tokens) >= _DRIFT_NEW_TOKEN_THRESHOLD
        )

    def _is_already_specific(self, query: str) -> bool:
        """Check if query is already specific enough."""
        # Queries mentioning specific documents or entities are specific
        specific_indicators = [
            "in document", "in the", "from the", "in contract",
            "in agreement", "in invoice", "in po",
        ]
        query_lower = query.lower()
        return any(ind in query_lower for ind in specific_indicators)


# Singleton
_enhancer_instance: Optional[QueryEnhancer] = None


def get_query_enhancer(use_llm: bool = True) -> QueryEnhancer:
    """Get query enhancer singleton."""
    global _enhancer_instance
    if _enhancer_instance is None:
        _enhancer_instance = QueryEnhancer(use_llm=use_llm)
    return _enhancer_instance
