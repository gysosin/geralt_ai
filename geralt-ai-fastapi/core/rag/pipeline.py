"""
RAG Pipeline

Complete RAG (Retrieval-Augmented Generation) pipeline orchestrator.
Provides retrieve → rerank → generate flow with comprehensive logging.
"""
import logging
from typing import List, Optional
from pydantic import BaseModel, Field

from core.ai.base import LLMProvider, RerankerProvider
from core.rag.retriever import HybridRetriever, RetrievalResult
from core.config import settings

logger = logging.getLogger(__name__)


class RAGResponse(BaseModel):
    """Response from RAG pipeline."""
    answer: str
    sources: List[dict]
    query: str
    model: str
    retrieval_count: int = 0
    reranked: bool = False
    query_type: str = "qa"
    routing: dict = Field(default_factory=dict)


class RAGPipeline:
    """
    Complete RAG pipeline orchestrator.

    Stages:
    1. Retrieve relevant chunks (hybrid search)
    2. Rerank results (optional, improves relevance)
    3. Generate response with LLM

    Usage:
        pipeline = RAGPipeline(retriever, llm, reranker)
        response = await pipeline.query("What is X?", collection_ids=["col1"])
    """

    def __init__(
        self,
        retriever: HybridRetriever,
        llm: LLMProvider,
        reranker: Optional[RerankerProvider] = None,
    ):
        """
        Initialize RAG pipeline.

        Args:
            retriever: Hybrid retriever for document search
            llm: LLM provider for response generation
            reranker: Optional reranker for improving retrieval quality
        """
        self.retriever = retriever
        self.llm = llm
        self.reranker = reranker
        self.logger = logging.getLogger(f"{self.__class__.__name__}")

    def _routing_metadata(self, query_plan, retrieved: bool) -> dict:
        """Expose deterministic routing decisions for debugging and UI hints."""
        if not query_plan:
            return {}

        return {
            "reason": query_plan.reason,
            "needs_all_docs": query_plan.needs_all_docs,
            "suggested_top_k": query_plan.suggested_top_k,
            "suggested_rerank_top_n": query_plan.suggested_rerank_top_n,
            "retrieved": retrieved,
        }

    async def query(
        self,
        question: str,
        collection_ids: Optional[List[str]] = None,
        system_prompt: str = "",
        top_k: int = 10,
        rerank_top_n: int = 10,  # Increased default
        max_tokens: int = 1000,
        temperature: float = 0.7,
        smart_routing: bool = True,
    ) -> RAGResponse:
        """
        Execute RAG query with smart routing.

        Args:
            question: User's question
            collection_ids: Optional collection filter
            system_prompt: Custom system prompt for LLM
            top_k: Number of chunks to retrieve
            rerank_top_n: Number of chunks after reranking
            max_tokens: Max tokens for LLM response
            temperature: LLM temperature
            smart_routing: If True, route aggregation/summary queries to specialized handlers

        Returns:
            RAGResponse with answer and sources
        """
        try:
            query_preview = question[:50] + "..." if len(question) > 50 else question
            self.logger.info(f"RAG query: '{query_preview}' | Collections: {collection_ids}")

            # Smart routing: classify query and route to appropriate handler
            query_plan = None
            if smart_routing and collection_ids:
                from core.rag.query_classifier import get_query_classifier, QueryType

                classifier = get_query_classifier()
                query_plan = classifier.plan(question)
                self.logger.info(
                    "Query plan: type=%s retrieve=%s top_k=%s reason=%s",
                    query_plan.query_type.value,
                    query_plan.should_retrieve,
                    query_plan.suggested_top_k,
                    query_plan.reason,
                )

                if query_plan.query_type == QueryType.CHITCHAT:
                    return RAGResponse(
                        answer="Hi. Ask me a question about your documents and I will search the selected knowledge base.",
                        sources=[],
                        query=question,
                        model=self.llm.model_name,
                        retrieval_count=0,
                        reranked=False,
                        query_type=query_plan.query_type.value,
                        routing=self._routing_metadata(query_plan, retrieved=False),
                    )

                if query_plan.query_type == QueryType.AGGREGATION:
                    return await self._handle_aggregation_query(
                        question, collection_ids, max_tokens
                    )
                elif query_plan.query_type == QueryType.SUMMARY:
                    return await self._handle_summary_query(
                        question, collection_ids, max_tokens
                    )

                top_k = max(top_k, query_plan.suggested_top_k)
                rerank_top_n = max(rerank_top_n, query_plan.suggested_rerank_top_n)

            # 0. Enhance query for better retrieval
            enhanced_query = question
            try:
                from core.rag.query_enhancer import get_query_enhancer
                enhancer = get_query_enhancer(use_llm=True)
                enhanced_query = await enhancer.enhance(question)
                if enhanced_query != question:
                    self.logger.info(f"Query enhanced for retrieval")
            except Exception as e:
                self.logger.warning(f"Query enhancement failed: {e}")

            # 1. Retrieve relevant chunks
            self.logger.debug(f"Retrieving top_k={top_k} chunks")
            results = await self.retriever.retrieve(
                query=enhanced_query,  # Use enhanced query for retrieval
                collection_ids=collection_ids,
                top_k=top_k,
            )

            if not results:
                self.logger.warning("No retrieval results found")
                return RAGResponse(
                    answer="I couldn't find any relevant information to answer your question.",
                    sources=[],
                    query=question,
                    model=self.llm.model_name,
                    retrieval_count=0,
                    reranked=False,
                    query_type=query_plan.query_type.value if query_plan else "qa",
                    routing=self._routing_metadata(query_plan, retrieved=True),
                )

            self.logger.info(f"Retrieved {len(results)} chunks")

            # 2. Rerank if reranker is available
            reranked = False
            if self.reranker and len(results) > rerank_top_n:
                self.logger.debug(f"Reranking {len(results)} results to top {rerank_top_n}")
                results = await self._rerank_results(question, results, rerank_top_n)  # Use original query for reranking
                reranked = True
                self.logger.info(f"Reranked to {len(results)} chunks")

                # 2.5 Filter by relevance score threshold
                results = self._filter_by_relevance(results, min_score=0.1)
                self.logger.info(f"After relevance filter: {len(results)} chunks")
            else:
                results = results[:rerank_top_n]
                self.logger.debug(f"Using top {len(results)} results (no reranker)")

            if not results:
                self.logger.warning("No relevant results after filtering")
                return RAGResponse(
                    answer="I couldn't find any relevant information to answer your question.",
                    sources=[],
                    query=question,
                    model=self.llm.model_name,
                    retrieval_count=0,
                    reranked=reranked,
                    query_type=query_plan.query_type.value if query_plan else "qa",
                    routing=self._routing_metadata(query_plan, retrieved=True),
                )

            # 3. Build context from top chunks
            context = self._build_context(results)
            context_length = len(context)
            self.logger.debug(f"Built context: {context_length} characters from {len(results)} chunks")

            # 4. Generate response with LLM
            prompt = self._build_prompt(system_prompt, context, question)
            self.logger.debug(f"Generating response with {self.llm.model_name}")

            answer = await self.llm.complete(
                prompt=prompt,
                max_tokens=max_tokens,
                temperature=temperature,
            )

            self.logger.info(f"Generated response: {len(answer)} chars")

            return RAGResponse(
                answer=answer,
                sources=[r.model_dump() for r in results],
                query=question,
                model=self.llm.model_name,
                retrieval_count=len(results),
                reranked=reranked,
                query_type=query_plan.query_type.value if query_plan else "qa",
                routing=self._routing_metadata(query_plan, retrieved=True),
            )

        except Exception as e:
            self.logger.error(f"RAG pipeline error: {e}", exc_info=True)
            raise

    async def _rerank_results(
        self,
        query: str,
        results: List[RetrievalResult],
        top_n: int,
    ) -> List[RetrievalResult]:
        """Rerank retrieval results."""
        try:
            documents = [r.content for r in results]
            reranked = await self.reranker.rerank(
                query=query,
                documents=documents,
                top_n=top_n,
            )

            # Map back to original results with new scores
            reranked_results = []
            for item in reranked:
                idx = item["index"]
                if idx < len(results):
                    result = results[idx]
                    result.score = item["score"]
                    reranked_results.append(result)

            return reranked_results

        except Exception as e:
            self.logger.warning(f"Reranking failed, using original order: {e}")
            return results[:top_n]

    def _filter_by_relevance(
        self,
        results: List[RetrievalResult],
        min_score: float = 0.1,
    ) -> List[RetrievalResult]:
        """
        Filter results by minimum relevance score.

        Removes documents that are not sufficiently relevant to the query.
        This prevents irrelevant documents from appearing in results.

        Args:
            results: Reranked results with scores
            min_score: Minimum score threshold (0-1 for reranker scores)

        Returns:
            Filtered results above threshold
        """
        if not results:
            return results

        filtered = [r for r in results if r.score >= min_score]

        if len(filtered) < len(results):
            self.logger.debug(
                f"Filtered {len(results) - len(filtered)} low-relevance results "
                f"(min_score={min_score})"
            )

        # Always return at least 1 result if we had any (avoid empty responses)
        if not filtered and results:
            self.logger.warning("All results below threshold, keeping top result")
            return [results[0]]

        return filtered

    def _build_context(self, results: List[RetrievalResult]) -> str:
        """Build context string from retrieval results."""
        context_parts = []

        for i, result in enumerate(results, 1):
            # Include source info if available
            source_info = ""
            metadata = result.metadata or {}

            if metadata.get("source"):
                source_info = f" (Source: {metadata['source']})"
            elif metadata.get("page_number"):
                source_info = f" (Page {metadata['page_number']})"

            # Include score for debugging
            context_parts.append(f"[{i}] {result.content}{source_info}")

        return "\n\n".join(context_parts)

    def _build_prompt(
        self,
        system_prompt: str,
        context: str,
        question: str,
    ) -> str:
        """Build final prompt for LLM."""

        default_instructions = """You are a precise data extraction assistant.
Follow these rules strictly:
1. Answer the question using ONLY the provided context.
2. If the user asks for a table or list, you MUST provide it even if only ONE item or vendor is found.
3. NEVER say "I don't have enough information" if you see at least one vendor name and one amount.
4. Format: Use Markdown tables for tabular data.

Example for single vendor:
Query: "Show me all vendors in a table"
Context: "Purchase Order to Vendor ABC for $100."
Response:
| Vendor Name | Total Amount |
| ----------- | ------------ |
| Vendor ABC  | $100         |"""

        system = system_prompt or default_instructions

        return f"""{system}

Context:
---
{context}
---

Question: {question}

Answer:"""

    async def _handle_aggregation_query(
        self,
        question: str,
        collection_ids: List[str],
        max_tokens: int,
    ) -> RAGResponse:
        """Handle aggregation queries using extracted structured data."""
        from core.rag.aggregation_engine import get_aggregation_engine

        self.logger.info(f"Routing to aggregation handler")

        engine = get_aggregation_engine()
        result = await engine.aggregate(question, collection_ids)

        return RAGResponse(
            answer=result["answer"],
            sources=[{"type": "aggregation", "data": result.get("data", [])}],
            query=question,
            model=self.llm.model_name,
            retrieval_count=result.get("metadata", {}).get("documents_analyzed", 0),
            reranked=False,
            query_type="aggregation",
            routing={"reason": "aggregation_handler", "retrieved": False},
        )

    async def _handle_summary_query(
        self,
        question: str,
        collection_ids: List[str],
        max_tokens: int,
    ) -> RAGResponse:
        """Handle collection summary queries."""
        from core.rag.collection_summarizer import get_collection_summarizer

        self.logger.info(f"Routing to summary handler")

        summarizer = get_collection_summarizer()

        # Use first collection ID for now
        collection_id = collection_ids[0] if collection_ids else None
        if not collection_id:
            return RAGResponse(
                answer="Please specify a collection to summarize.",
                sources=[],
                query=question,
            model=self.llm.model_name,
            retrieval_count=0,
            reranked=False,
            query_type="summary",
            routing={"reason": "missing_collection", "retrieved": False},
        )

        result = await summarizer.summarize(collection_id)

        return RAGResponse(
            answer=result["summary"],
            sources=[{
                "type": "collection_summary",
                "document_count": result.get("document_count", 0),
                "key_findings": result.get("key_findings", []),
            }],
            query=question,
            model=self.llm.model_name,
            retrieval_count=result.get("document_count", 0),
            reranked=False,
            query_type="summary",
            routing={"reason": "summary_handler", "retrieved": False},
        )


class RAGPipelineBuilder:
    """
    Builder for creating RAG pipelines with different configurations.

    Usage:
        pipeline = (
            RAGPipelineBuilder()
            .with_embedding_model("gemini")
            .with_llm_model("gemini")
            .with_reranker()
            .build(es_client)
        )
    """

    def __init__(self):
        self._embedding_model = None
        self._llm_model = None
        self._use_reranker = False
        self.logger = logging.getLogger(f"{self.__class__.__name__}")

    def with_embedding_model(self, model: str) -> "RAGPipelineBuilder":
        """Set embedding model (gemini, openai, mistral)."""
        self._embedding_model = model
        return self

    def with_llm_model(self, model: str) -> "RAGPipelineBuilder":
        """Set LLM model (gemini, openai, mistral)."""
        self._llm_model = model
        return self

    def with_reranker(self, enabled: bool = True) -> "RAGPipelineBuilder":
        """Enable/disable reranking."""
        self._use_reranker = enabled
        return self

    def build(self, es_client) -> RAGPipeline:
        """Build the RAG pipeline."""
        from elasticsearch import AsyncElasticsearch
        from core.ai.factory import AIProviderFactory, AIModel
        from core.clients.milvus_client import get_milvus_client

        self.logger.info("Building RAG pipeline...")

        # Get embedding provider
        embedding_model = self._embedding_model or settings.DEFAULT_EMBEDDING_MODEL
        embedder = AIProviderFactory.get_embedding_provider(AIModel(embedding_model))
        self.logger.debug(f"Embedding model: {embedding_model}")

        # Get LLM provider
        llm_model = self._llm_model or settings.DEFAULT_AI_MODEL
        llm = AIProviderFactory.get_llm_provider(AIModel(llm_model))
        self.logger.debug(f"LLM model: {llm_model}")

        # Get reranker if enabled
        reranker = None
        if self._use_reranker:
            reranker = AIProviderFactory.get_reranker_provider()
            self.logger.debug("Reranker enabled")

        # Get Milvus client
        milvus_client = get_milvus_client()
        milvus_client.connect()
        self.logger.debug("Milvus connected")

        # Create retriever
        retriever = HybridRetriever(
            es_client=es_client,
            embedder=embedder,
            milvus_client=milvus_client,
        )

        self.logger.info("RAG pipeline built successfully")
        return RAGPipeline(retriever, llm, reranker)
