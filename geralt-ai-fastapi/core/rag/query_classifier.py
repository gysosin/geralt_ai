"""
Query Classifier

Classifies user queries to route them appropriately:
- QA: Standard RAG retrieval + LLM answer
- AGGREGATION: Cross-document data queries using extracted structured data
- SUMMARY: Collection-wide summarization
"""
import re
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Optional, List

logger = logging.getLogger(__name__)


class QueryType(str, Enum):
    """Types of queries the system can handle."""
    QA = "qa"                    # Standard question-answering via RAG
    AGGREGATION = "aggregation"  # Cross-document data queries
    SUMMARY = "summary"          # Collection summarization
    LISTING = "listing"          # Enumerate matching items across documents
    COMPARISON = "comparison"    # Compare values/terms across documents
    CHITCHAT = "chitchat"        # Greeting or conversational filler


@dataclass(frozen=True)
class QueryPlan:
    """Execution hints for RAG routing and retrieval depth."""
    query_type: QueryType
    should_retrieve: bool = True
    needs_all_docs: bool = False
    suggested_top_k: int = 10
    suggested_rerank_top_n: int = 10
    reason: str = "default"


# Patterns that indicate aggregation queries
AGGREGATION_PATTERNS = [
    r"\b(total|sum|count|average|mean|median|max|min|how many)\b",
    r"\b(across|combined|aggregate|consolidated)\b",
    r"\b(by vendor|by month|by year|by date|grouped by|group by)\b",
    r"\bwhat (are|is) the (total|sum|count)\b",
    r"\b(payments?|amounts?|values?)\s+(from|in|across)\s+all\b",
]

LISTING_PATTERNS = [
    r"\b(list all|show all|get all|extract all|enumerate)\b",
    r"\b(all|every|each)\s+(vendors?|customers?|contracts?|invoices?|pos?|purchase orders?|files?|documents?|amounts?|payments?)\b",
    r"\b(table|spreadsheet)\s+of\b",
]

COMPARISON_PATTERNS = [
    r"\b(compare|comparison|versus|vs)\b",
    r"\b(differences?|similarities|contrast)\b",
    r"\b(across|between)\s+(the\s+)?(contracts?|documents?|invoices?|files?)\b",
]

CHITCHAT_PATTERNS = [
    r"^\s*(hi+|hello+|hey+|thanks?|thank\s+you|ok(?:ay)?|bye|good\s+(morning|evening|night))(\s+(thanks?|thank\s+you|ok(?:ay)?))*\s*[!.?]*\s*$",
    r"^\s*(how\s+are\s+you|what'?s\s+up|who\s+are\s+you|what\s+can\s+you\s+do)\s*[!.?]*\s*$",
]

# Patterns that indicate summary queries
SUMMARY_PATTERNS = [
    r"\b(summarize|summary|summarization|overview)\b",
    r"\bwhat('s| is| are) (in|inside)?\s*(this|the)\s+(collection|folder|documents?)\b",
    r"\b(describe|explain)\s+(all|the|this|these)\s+(documents?|collection|files?)\b",
    r"\bgive me (a |an )?(quick |brief )?(summary|overview|rundown)\b",
    r"\b(tldr|tl;dr)\b",
    r"\bwhat (do|does) (this|the) (collection|folder) contain\b",
]


class QueryClassifier:
    """
    Classify user queries to determine optimal handling strategy.

    Uses pattern matching for fast classification. Can be extended
    with LLM-based classification for ambiguous cases.
    """

    def __init__(self, use_llm_fallback: bool = False):
        """
        Initialize classifier.

        Args:
            use_llm_fallback: If True, use LLM for ambiguous queries
        """
        self.use_llm_fallback = use_llm_fallback
        self._aggregation_patterns = [re.compile(p, re.IGNORECASE) for p in AGGREGATION_PATTERNS]
        self._summary_patterns = [re.compile(p, re.IGNORECASE) for p in SUMMARY_PATTERNS]
        self._listing_patterns = [re.compile(p, re.IGNORECASE) for p in LISTING_PATTERNS]
        self._comparison_patterns = [re.compile(p, re.IGNORECASE) for p in COMPARISON_PATTERNS]
        self._chitchat_patterns = [re.compile(p, re.IGNORECASE) for p in CHITCHAT_PATTERNS]
        self.logger = logging.getLogger(f"{self.__class__.__name__}")

    def plan(self, query: str, context: Optional[dict] = None) -> QueryPlan:
        """Create a deterministic retrieval plan for a user query."""
        query_lower = query.lower().strip()

        if self._match_patterns(query_lower, self._chitchat_patterns) > 0:
            return QueryPlan(
                query_type=QueryType.CHITCHAT,
                should_retrieve=False,
                suggested_top_k=0,
                suggested_rerank_top_n=0,
                reason="chitchat_pattern",
            )

        summary_score = self._match_patterns(query_lower, self._summary_patterns)
        if summary_score > 0:
            return QueryPlan(
                query_type=QueryType.SUMMARY,
                should_retrieve=False,
                needs_all_docs=True,
                suggested_top_k=0,
                suggested_rerank_top_n=0,
                reason=f"summary_pattern:{summary_score}",
            )

        listing_score = self._match_patterns(query_lower, self._listing_patterns)
        if listing_score > 0:
            return QueryPlan(
                query_type=QueryType.LISTING,
                needs_all_docs=True,
                suggested_top_k=30,
                suggested_rerank_top_n=20,
                reason=f"listing_pattern:{listing_score}",
            )

        comparison_score = self._match_patterns(query_lower, self._comparison_patterns)
        if comparison_score > 0:
            return QueryPlan(
                query_type=QueryType.COMPARISON,
                needs_all_docs=True,
                suggested_top_k=24,
                suggested_rerank_top_n=16,
                reason=f"comparison_pattern:{comparison_score}",
            )

        aggregation_score = self._match_patterns(query_lower, self._aggregation_patterns)
        if aggregation_score > 0:
            return QueryPlan(
                query_type=QueryType.AGGREGATION,
                should_retrieve=False,
                needs_all_docs=True,
                suggested_top_k=0,
                suggested_rerank_top_n=0,
                reason=f"aggregation_pattern:{aggregation_score}",
            )

        return QueryPlan(query_type=QueryType.QA)

    def classify(self, query: str, context: Optional[dict] = None) -> QueryType:
        """
        Classify a query into QA, AGGREGATION, or SUMMARY.

        Args:
            query: User's question/query
            context: Optional context (collection info, etc.)

        Returns:
            QueryType indicating how to handle the query
        """
        plan = self.plan(query, context)
        self.logger.info(
            "Query classified as %s (reason=%s): %s...",
            plan.query_type.value,
            plan.reason,
            query[:50],
        )
        return plan.query_type

    def _match_patterns(self, text: str, patterns: List[re.Pattern]) -> int:
        """Count pattern matches in text."""
        score = 0
        for pattern in patterns:
            if pattern.search(text):
                score += 1
        return score

    async def classify_with_llm(self, query: str, context: Optional[dict] = None) -> QueryType:
        """
        Use LLM to classify ambiguous queries.

        Args:
            query: User's question
            context: Optional context

        Returns:
            QueryType
        """
        from core.ai.factory import AIProviderFactory

        llm = AIProviderFactory.get_llm_provider()

        prompt = f"""Classify this query into one of three categories:

1. QA - A question about specific document content (e.g., "What are the payment terms in contract X?")
2. AGGREGATION - A query that needs data from multiple documents combined (e.g., "What is the total of all invoices?")
3. SUMMARY - A request to summarize a collection of documents (e.g., "Summarize all documents in this folder")

Query: "{query}"

Respond with exactly one word: QA, AGGREGATION, or SUMMARY"""

        try:
            response = await llm.complete(prompt, max_tokens=10, temperature=0)
            response = response.strip().upper()

            if "AGGREGATION" in response:
                return QueryType.AGGREGATION
            elif "SUMMARY" in response:
                return QueryType.SUMMARY
            else:
                return QueryType.QA

        except Exception as e:
            self.logger.warning(f"LLM classification failed: {e}")
            return QueryType.QA


# Singleton instance
_classifier_instance: Optional[QueryClassifier] = None


def get_query_classifier() -> QueryClassifier:
    """Get or create the query classifier singleton."""
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = QueryClassifier()
    return _classifier_instance
