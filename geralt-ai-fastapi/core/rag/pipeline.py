"""
RAG Pipeline

Complete RAG (Retrieval-Augmented Generation) pipeline orchestrator.
Provides retrieve → rerank → generate flow with comprehensive logging.
"""
import logging
from typing import List, Optional
from pydantic import BaseModel

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
    
    async def query(
        self,
        question: str,
        collection_ids: Optional[List[str]] = None,
        system_prompt: str = "",
        top_k: int = 10,
        rerank_top_n: int = 3,
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> RAGResponse:
        """
        Execute RAG query.
        
        Args:
            question: User's question
            collection_ids: Optional collection filter
            system_prompt: Custom system prompt for LLM
            top_k: Number of chunks to retrieve
            rerank_top_n: Number of chunks after reranking
            max_tokens: Max tokens for LLM response
            temperature: LLM temperature
            
        Returns:
            RAGResponse with answer and sources
        """
        try:
            query_preview = question[:50] + "..." if len(question) > 50 else question
            self.logger.info(f"RAG query: '{query_preview}' | Collections: {collection_ids}")
            
            # 1. Retrieve relevant chunks
            self.logger.debug(f"Retrieving top_k={top_k} chunks")
            results = await self.retriever.retrieve(
                query=question,
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
                )
            
            self.logger.info(f"Retrieved {len(results)} chunks")
            
            # 2. Rerank if reranker is available
            reranked = False
            if self.reranker and len(results) > rerank_top_n:
                self.logger.debug(f"Reranking {len(results)} results to top {rerank_top_n}")
                results = await self._rerank_results(question, results, rerank_top_n)
                reranked = True
                self.logger.info(f"Reranked to {len(results)} chunks")
            else:
                results = results[:rerank_top_n]
                self.logger.debug(f"Using top {len(results)} results (no reranker)")
            
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
        
        default_instructions = """You are a helpful AI assistant. Answer the question based ONLY on the provided context. 
If the answer is not found in the context, say "I don't have enough information to answer that question."
Be concise and accurate. Reference the source numbers [1], [2], etc. when applicable."""
        
        system = system_prompt or default_instructions
        
        return f"""{system}

Context:
---
{context}
---

Question: {question}

Answer:"""


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
