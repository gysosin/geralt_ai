"""
Google Gemini AI Provider

Implements embedding and LLM capabilities using Google's Gemini API.
"""
import logging
from typing import List, Optional

from core.ai.base import EmbeddingProvider, LLMProvider, TokenUsage
from core.config import settings

logger = logging.getLogger(__name__)


class GeminiEmbeddingProvider(EmbeddingProvider):
    """
    Gemini embedding provider using text-embedding-004 model.

    Embedding dimension: 768
    """

    def __init__(self, api_key: Optional[str] = None):
        from google import genai

        self._api_key = api_key or settings.GEMINI_API_KEY
        if not self._api_key:
            raise ValueError("GEMINI_API_KEY is required for GeminiEmbeddingProvider")

        self._client = genai.Client(api_key=self._api_key)
        self._model = settings.GEMINI_EMBEDDING_MODEL
        self._dimension = settings.EMBEDDING_DIMENSION

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, text: str, task_type: str = "retrieval_document") -> List[float]:
        """Generate embedding for single text using Gemini."""
        from google.genai import types
        import numpy as np

        try:
            result = await self._client.aio.models.embed_content(
                model=self._model,
                contents=[text],
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=self._dimension,
                ),
            )
            embedding = list(result.embeddings[0].values)

            # Normalize if not 3072 (as per Gemini documentation)
            if self._dimension != 3072:
                emb_np = np.array(embedding)
                norm = np.linalg.norm(emb_np)
                if norm > 0:
                    embedding = (emb_np / norm).tolist()

            return embedding
        except Exception as e:
            logger.error(f"Gemini embedding error: {e}")
            raise

    async def embed_batch(self, texts: List[str], task_type: str = "retrieval_document") -> List[List[float]]:
        """Generate embeddings for multiple texts concurrently."""
        import asyncio
        tasks = [self.embed(text, task_type=task_type) for text in texts]
        return await asyncio.gather(*tasks)


class GeminiLLMProvider(LLMProvider):
    """
    Gemini LLM provider using gemini-1.5-flash model.

    Supports both completion and chat interfaces.
    """

    def __init__(self, api_key: Optional[str] = None):
        from google import genai

        self._api_key = api_key or settings.GEMINI_API_KEY
        if not self._api_key:
            raise ValueError("GEMINI_API_KEY is required for GeminiLLMProvider")

        self._model_name = settings.GEMINI_LLM_MODEL
        self._client = genai.Client(api_key=self._api_key)

    @property
    def model_name(self) -> str:
        return self._model_name

    async def complete(
        self,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[List[str]] = None,
    ) -> str:
        """Generate text completion using Gemini."""
        from google.genai import types

        try:
            generation_config = types.GenerateContentConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                stop_sequences=stop,
            )

            response = await self._client.aio.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config=generation_config,
            )

            return response.text or ""

        except Exception as e:
            logger.error(f"Gemini completion error: {e}")
            raise

    async def chat(
        self,
        messages: List[dict],
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> str:
        """Generate chat completion from message history."""
        from google.genai import types

        try:
            transcript = "\n".join(
                f"{msg.get('role', 'user')}: {msg.get('content', '')}"
                for msg in messages
            )
            generation_config = types.GenerateContentConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
            )

            response = await self._client.aio.models.generate_content(
                model=self._model_name,
                contents=transcript,
                config=generation_config,
            )

            return response.text or ""

        except Exception as e:
            logger.error(f"Gemini chat error: {e}")
            raise
