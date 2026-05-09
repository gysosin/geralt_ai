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
        import google.generativeai as genai

        self._api_key = api_key or settings.GEMINI_API_KEY
        if not self._api_key:
            raise ValueError("GEMINI_API_KEY is required for GeminiEmbeddingProvider")

        genai.configure(api_key=self._api_key)
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
        import google.generativeai as genai
        import numpy as np

        try:
            result = genai.embed_content(
                model=self._model,
                content=text,
                task_type=task_type,
                output_dimensionality=self._dimension
            )
            embedding = result["embedding"]

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
        import google.generativeai as genai

        self._api_key = api_key or settings.GEMINI_API_KEY
        if not self._api_key:
            raise ValueError("GEMINI_API_KEY is required for GeminiLLMProvider")

        genai.configure(api_key=self._api_key)
        self._model_name = settings.GEMINI_LLM_MODEL
        self._model = genai.GenerativeModel(self._model_name)

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
        import google.generativeai as genai

        try:
            generation_config = genai.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                stop_sequences=stop,
            )

            response = await self._model.generate_content_async(
                prompt,
                generation_config=generation_config,
            )

            return response.text

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
        import google.generativeai as genai

        try:
            # Convert messages to Gemini format
            chat = self._model.start_chat(history=[])

            # Process message history
            for msg in messages[:-1]:
                role = msg.get("role", "user")
                content = msg.get("content", "")

                if role == "user":
                    chat.send_message(content)
                elif role == "assistant":
                    # Gemini handles this internally
                    pass

            # Send the last message and get response
            last_message = messages[-1].get("content", "") if messages else ""

            generation_config = genai.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
            )

            response = await chat.send_message_async(
                last_message,
                generation_config=generation_config,
            )

            return response.text

        except Exception as e:
            logger.error(f"Gemini chat error: {e}")
            raise
