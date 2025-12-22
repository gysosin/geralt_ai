"""
AI Provider Factory

Factory pattern for creating AI providers based on configuration.
Supports Gemini, OpenAI, and Mistral backends.
"""
from enum import Enum
from functools import lru_cache
from typing import Optional

from core.ai.base import EmbeddingProvider, LLMProvider, RerankerProvider
from core.config import settings


class AIModel(str, Enum):
    """Supported AI models."""
    GEMINI = "gemini"
    OPENAI = "openai"
    MISTRAL = "mistral"


class AIProviderFactory:
    """
    Factory for creating AI providers.
    
    Usage:
        embedder = AIProviderFactory.get_embedding_provider()
        llm = AIProviderFactory.get_llm_provider(AIModel.GEMINI)
    """
    
    @classmethod
    def get_embedding_provider(
        cls,
        model: Optional[AIModel] = None,
    ) -> EmbeddingProvider:
        """
        Get embedding provider for specified model.
        
        Args:
            model: AI model to use, defaults to settings.DEFAULT_EMBEDDING_MODEL
            
        Returns:
            EmbeddingProvider instance
        """
        model = model or AIModel(settings.DEFAULT_EMBEDDING_MODEL)
        
        if model == AIModel.GEMINI:
            from core.ai.gemini import GeminiEmbeddingProvider
            return GeminiEmbeddingProvider()
        elif model == AIModel.OPENAI:
            from core.ai.openai import OpenAIEmbeddingProvider
            return OpenAIEmbeddingProvider()
        elif model == AIModel.MISTRAL:
            from core.ai.mistral import MistralEmbeddingProvider
            return MistralEmbeddingProvider()
        else:
            raise ValueError(f"Unsupported embedding model: {model}")
    
    @classmethod
    def get_llm_provider(
        cls,
        model: Optional[AIModel] = None,
    ) -> LLMProvider:
        """
        Get LLM provider for specified model.
        
        Args:
            model: AI model to use, defaults to settings.DEFAULT_AI_MODEL
            
        Returns:
            LLMProvider instance
        """
        model = model or AIModel(settings.DEFAULT_AI_MODEL)
        
        if model == AIModel.GEMINI:
            from core.ai.gemini import GeminiLLMProvider
            return GeminiLLMProvider()
        elif model == AIModel.OPENAI:
            from core.ai.openai import OpenAILLMProvider
            return OpenAILLMProvider()
        elif model == AIModel.MISTRAL:
            from core.ai.mistral import MistralLLMProvider
            return MistralLLMProvider()
        else:
            raise ValueError(f"Unsupported LLM model: {model}")
    
    @classmethod
    def get_reranker_provider(cls) -> Optional[RerankerProvider]:
        """
        Get reranker provider based on configuration.
        
        Returns:
            RerankerProvider instance or None if reranking is disabled
        """
        if settings.DEFAULT_RERANKER == "none":
            return None
        elif settings.DEFAULT_RERANKER == "cohere":
            from core.ai.cohere import CohereRerankerProvider
            return CohereRerankerProvider()
        else:
            return None


@lru_cache
def get_default_embedding_provider() -> EmbeddingProvider:
    """Get cached default embedding provider."""
    return AIProviderFactory.get_embedding_provider()


@lru_cache
def get_default_llm_provider() -> LLMProvider:
    """Get cached default LLM provider."""
    return AIProviderFactory.get_llm_provider()
