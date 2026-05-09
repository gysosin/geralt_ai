"""
Mistral AI Provider

Implements embedding and LLM capabilities using Mistral's API (v1.x).
"""
import logging
from typing import List, Optional

from core.ai.base import EmbeddingProvider, LLMProvider
from core.config import settings

logger = logging.getLogger(__name__)


def _get_mistral_client_class():
    try:
        from mistralai import Mistral
    except ImportError:  # mistralai >= 2 exposes the client from mistralai.client
        from mistralai.client import Mistral

    return Mistral


class MistralEmbeddingProvider(EmbeddingProvider):
    """
    Mistral embedding provider using mistral-embed model.
    
    Embedding dimension: 1024
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or settings.MISTRAL_API_KEY
        if not self._api_key:
            raise ValueError("MISTRAL_API_KEY is required for MistralEmbeddingProvider")
        
        Mistral = _get_mistral_client_class()
        self._client = Mistral(api_key=self._api_key)
        self._model = settings.MISTRAL_EMBEDDING_MODEL
        self._dimension = 1024
    
    @property
    def model_name(self) -> str:
        return self._model
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    async def embed(self, text: str, **kwargs) -> List[float]:
        """Generate embedding for single text using Mistral."""
        try:
            response = await self._client.embeddings.create_async(
                model=self._model,
                inputs=[text],
            )
            return response.data[0].embedding
        except Exception as e:
            # Fallback to sync if async fails (client might not be fully async configured in all versions)
            # or handle error
            logger.error(f"Mistral embedding error: {e}")
            raise
    
    async def embed_batch(self, texts: List[str], **kwargs) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        try:
            response = await self._client.embeddings.create_async(
                model=self._model,
                inputs=texts,
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"Mistral batch embedding error: {e}")
            raise


class MistralLLMProvider(LLMProvider):
    """
    Mistral LLM provider using mistral-small-latest model.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or settings.MISTRAL_API_KEY
        if not self._api_key:
            raise ValueError("MISTRAL_API_KEY is required for MistralLLMProvider")
        
        Mistral = _get_mistral_client_class()
        self._client = Mistral(api_key=self._api_key)
        self._model = settings.MISTRAL_LLM_MODEL
    
    @property
    def model_name(self) -> str:
        return self._model
    
    async def complete(
        self,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[List[str]] = None,
    ) -> str:
        """Generate text completion using Mistral."""
        try:
            messages = [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ]
            
            response = await self._client.chat.complete_async(
                model=self._model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Mistral completion error: {e}")
            raise
    
    async def chat(
        self,
        messages: List[dict],
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> str:
        """Generate chat completion from message history."""
        try:
            response = await self._client.chat.complete_async(
                model=self._model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Mistral chat error: {e}")
            raise
