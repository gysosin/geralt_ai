"""
Cohere Reranker Provider

Implements reranking using Cohere's rerank API.
"""
import logging
from typing import List, Optional

from core.ai.base import RerankerProvider
from core.config import settings

logger = logging.getLogger(__name__)


class CohereRerankerProvider(RerankerProvider):
    """
    Cohere reranker using rerank-english-v3.0 model.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        import cohere
        
        self._api_key = api_key or settings.COHERE_API_KEY
        if not self._api_key:
            raise ValueError("COHERE_API_KEY is required for CohereRerankerProvider")
        
        self._client = cohere.Client(self._api_key)
        self._model = settings.COHERE_RERANK_MODEL
    
    @property
    def model_name(self) -> str:
        return self._model
    
    async def rerank(
        self,
        query: str,
        documents: List[str],
        top_n: int = 3,
    ) -> List[dict]:
        """
        Rerank documents by relevance to query using Cohere.
        
        Args:
            query: Search query
            documents: List of document texts to rerank
            top_n: Number of top results to return
            
        Returns:
            List of dicts with 'index', 'text', 'score' keys
        """
        try:
            if not documents:
                return []
            
            response = self._client.rerank(
                model=self._model,
                query=query,
                documents=documents,
                top_n=min(top_n, len(documents)),
                return_documents=True,
            )
            
            return [
                {
                    "index": result.index,
                    "text": result.document.text,
                    "score": result.relevance_score,
                }
                for result in response.results
            ]
            
        except Exception as e:
            logger.error(f"Cohere rerank error: {e}")
            raise
