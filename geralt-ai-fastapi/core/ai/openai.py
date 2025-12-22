"""
OpenAI Provider

Implements embedding and LLM capabilities using OpenAI's API.
"""
import logging
from typing import List, Optional

from core.ai.base import EmbeddingProvider, LLMProvider
from core.config import settings

logger = logging.getLogger(__name__)


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """
    OpenAI embedding provider using text-embedding-3-small model.
    
    Embedding dimension: 1536
    """
    
    def __init__(self, api_key: Optional[str] = None):
        from openai import AsyncOpenAI
        
        self._api_key = api_key or settings.OPENAI_API_KEY
        if not self._api_key:
            raise ValueError("OPENAI_API_KEY is required for OpenAIEmbeddingProvider")
        
        self._client = AsyncOpenAI(api_key=self._api_key)
        self._model = settings.OPENAI_EMBEDDING_MODEL
        self._dimension = 1536
    
    @property
    def model_name(self) -> str:
        return self._model
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
    async def embed(self, text: str, **kwargs) -> List[float]:
        """Generate embedding for single text using OpenAI."""
        try:
            response = await self._client.embeddings.create(
                model=self._model,
                input=text,
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"OpenAI embedding error: {e}")
            raise
    
    async def embed_batch(self, texts: List[str], **kwargs) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        try:
            response = await self._client.embeddings.create(
                model=self._model,
                input=texts,
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"OpenAI batch embedding error: {e}")
            raise


class OpenAILLMProvider(LLMProvider):
    """
    OpenAI LLM provider using gpt-4o-mini model.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        from openai import AsyncOpenAI
        
        self._api_key = api_key or settings.OPENAI_API_KEY
        if not self._api_key:
            raise ValueError("OPENAI_API_KEY is required for OpenAILLMProvider")
        
        self._client = AsyncOpenAI(api_key=self._api_key)
        self._model = settings.OPENAI_LLM_MODEL
    
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
        """Generate text completion using OpenAI."""
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                stop=stop,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI completion error: {e}")
            raise
    
    async def chat(
        self,
        messages: List[dict],
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> str:
        """Generate chat completion from message history."""
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI chat error: {e}")
            raise
