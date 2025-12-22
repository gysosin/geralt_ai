"""
Hybrid Retriever

Industry-standard hybrid retriever combining BM25 keyword search with dense vector similarity.
"""
import logging
import inspect
from typing import List, Optional
from pydantic import BaseModel

from elasticsearch import AsyncElasticsearch

from core.ai.base import EmbeddingProvider
from core.config import settings

logger = logging.getLogger(__name__)


class RetrievalResult(BaseModel):
    """Result from retrieval operation."""
    content: str
    score: float
    document_id: str
    chunk_id: str
    collection_id: Optional[str] = None
    metadata: dict = {}


class HybridRetriever:
    """
    Industry-standard hybrid retriever combining:
    - BM25 keyword search (Elasticsearch)
    - Dense vector similarity (cosine)
    - Optional collection filtering
    
    Uses script_score to combine keyword and vector scores.
    
    Usage:
        retriever = HybridRetriever(es_client, embedder)
        results = await retriever.retrieve("query", collection_ids=["col1"])
    """
    
    def __init__(
        self,
        es_client: AsyncElasticsearch,
        embedder: EmbeddingProvider,
        index_name: Optional[str] = None,
        vector_weight: float = 0.7,
        keyword_weight: float = 0.3,
    ):
        """
        Initialize hybrid retriever.
        
        Args:
            es_client: Async Elasticsearch client
            embedder: Embedding provider for query vectorization
            index_name: Elasticsearch index name
            vector_weight: Weight for vector similarity (0-1)
            keyword_weight: Weight for keyword matching (0-1)
        """
        self.es = es_client
        self.embedder = embedder
        self.index = index_name or settings.ELASTIC_INDEX
        self.vector_weight = vector_weight
        self.keyword_weight = keyword_weight
    
    async def retrieve(
        self,
        query: str,
        collection_ids: Optional[List[str]] = None,
        top_k: int = 10,
    ) -> List[RetrievalResult]:
        """
        Perform hybrid retrieval.
        
        Args:
            query: Search query
            collection_ids: Optional list of collection IDs to filter
            top_k: Number of results to return
            
        Returns:
            List of RetrievalResult objects sorted by score
        """
        try:
            # 1. Generate query embedding
            query_vector = await self.embedder.embed(query, task_type="retrieval_query")
            
            # 2. Build hybrid query
            body = self._build_query(query, query_vector, collection_ids, top_k)
            
            # 3. Execute search
            response = self.es.search(index=self.index, body=body)
            if inspect.isawaitable(response):
                response = await response
            
            # 4. Parse and return results
            return self._parse_results(response)
            
        except Exception as e:
            logger.error(f"Hybrid retrieval error: {e}")
            raise
    
    def _build_query(
        self,
        query: str,
        query_vector: List[float],
        collection_ids: Optional[List[str]],
        top_k: int,
    ) -> dict:
        """Build Elasticsearch hybrid query."""
        
        # Base bool query
        bool_query = {
            "should": [
                # BM25 keyword match with boost
                {
                    "multi_match": {
                        "query": query,
                        "fields": ["content^2", "metadata.title^1.5"],
                        "type": "best_fields",
                        "tie_breaker": 0.3,
                    }
                }
            ],
            "minimum_should_match": 0,
        }
        
        # Add collection filter if specified
        # Use collection_id.keyword since the field is mapped as text with a keyword subfield
        if collection_ids:
            bool_query["filter"] = [
                {"terms": {"collection_id.keyword": collection_ids}}
            ]
        
        # Combine with vector similarity using script_score
        body = {
            "size": top_k,
            "query": {
                "script_score": {
                    "query": {"bool": bool_query},
                    "script": {
                        "source": f"""
                            double keyword_score = _score * {self.keyword_weight};
                            double vector_score = (cosineSimilarity(params.qv, 'embedding') + 1.0) * {self.vector_weight};
                            return keyword_score + vector_score;
                        """,
                        "params": {"qv": query_vector},
                    },
                }
            },
            "_source": {
                "excludes": ["embedding"]  # Don't return embedding vector
            },
        }
        
        return body
    
    def _parse_results(self, response: dict) -> List[RetrievalResult]:
        """Parse Elasticsearch response into RetrievalResult objects."""
        results = []
        
        for hit in response.get("hits", {}).get("hits", []):
            source = hit.get("_source", {})
            
            # Parse metadata (may be JSON string or dict)
            metadata = source.get("metadata", {})
            if isinstance(metadata, str):
                import json
                try:
                    metadata = json.loads(metadata)
                except:
                    metadata = {}
            
            results.append(RetrievalResult(
                content=source.get("content", ""),
                score=hit.get("_score", 0.0),
                document_id=source.get("document_id", ""),
                chunk_id=source.get("chunk_id", ""),
                collection_id=source.get("collection_id"),
                metadata=metadata,
            ))
        
        return results
    
    async def retrieve_with_keyword_only(
        self,
        query: str,
        collection_ids: Optional[List[str]] = None,
        top_k: int = 10,
    ) -> List[RetrievalResult]:
        """
        Perform keyword-only retrieval (BM25).
        Useful for fallback or debugging.
        """
        try:
            bool_query = {
                "must": [
                    {
                        "multi_match": {
                            "query": query,
                            "fields": ["content", "metadata.title"],
                        }
                    }
                ]
            }
            
            if collection_ids:
                bool_query["filter"] = [
                    {"terms": {"collection_id.keyword": collection_ids}}
                ]
            
            body = {
                "size": top_k,
                "query": {"bool": bool_query},
                "_source": {"excludes": ["embedding"]},
            }
            
            response = self.es.search(index=self.index, body=body)
            if inspect.isawaitable(response):
                response = await response
            return self._parse_results(response)
            
        except Exception as e:
            logger.error(f"Keyword retrieval error: {e}")
            raise
