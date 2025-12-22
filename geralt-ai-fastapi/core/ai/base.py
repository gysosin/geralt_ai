"""
Abstract Base Classes for AI Providers

Defines the interfaces for embedding and LLM providers to ensure consistency
across different AI backends (Gemini, OpenAI, Mistral).
"""
from abc import ABC, abstractmethod
from typing import List, Optional
from pydantic import BaseModel


class TokenUsage(BaseModel):
    """Token usage statistics for logging."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class EmbeddingResult(BaseModel):
    """Result from embedding operation."""
    embedding: List[float]
    model: str
    usage: Optional[TokenUsage] = None


class CompletionResult(BaseModel):
    """Result from LLM completion."""
    text: str
    model: str
    usage: Optional[TokenUsage] = None
    finish_reason: Optional[str] = None


class EmbeddingProvider(ABC):
    """
    Abstract base class for embedding providers.
    
    Implementations:
    - GeminiEmbeddingProvider
    - OpenAIEmbeddingProvider
    - MistralEmbeddingProvider
    """
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the model name used for embeddings."""
        pass
    
    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return the embedding vector dimension."""
        pass
    
    @abstractmethod
    async def embed(self, text: str, **kwargs) -> List[float]:
        """
        Generate embedding for single text.
        
        Args:
            text: Input text to embed
            **kwargs: Provider-specific arguments (e.g., task_type)
            
        Returns:
            List of floats representing the embedding vector
        """
        pass
    
    @abstractmethod
    async def embed_batch(self, texts: List[str], **kwargs) -> List[List[float]]:
        """
        Generate embedding vectors for multiple texts.
        
        Args:
            texts: List of input texts
            
        Returns:
            List of embedding vectors
        """
        pass
    
    def embed_sync(self, text: str) -> List[float]:
        """
        Synchronous wrapper for embed().
        Use for compatibility with non-async code.
        """
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self.embed(text))


class LLMProvider(ABC):
    """
    Abstract base class for LLM providers.
    
    Implementations:
    - GeminiLLMProvider
    - OpenAILLMProvider
    - MistralLLMProvider
    """
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the model name used for completions."""
        pass
    
    @abstractmethod
    async def complete(
        self,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[List[str]] = None,
    ) -> str:
        """
        Generate text completion.
        
        Args:
            prompt: Input prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0 - 2.0)
            top_p: Nucleus sampling parameter
            stop: Optional stop sequences
            
        Returns:
            Generated text
        """
        pass
    
    @abstractmethod
    async def chat(
        self,
        messages: List[dict],
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate chat completion from message history.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            
        Returns:
            Assistant's response text
        """
        pass
    
    def complete_sync(self, prompt: str, **kwargs) -> str:
        """Synchronous wrapper for complete()."""
        import asyncio
        return asyncio.get_event_loop().run_until_complete(
            self.complete(prompt, **kwargs)
        )


class RerankerProvider(ABC):
    """
    Abstract base class for reranker providers.
    
    Implementations:
    - CohereRerankerProvider
    """
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the reranker model name."""
        pass
    
    @abstractmethod
    async def rerank(
        self,
        query: str,
        documents: List[str],
        top_n: int = 3,
    ) -> List[dict]:
        """
        Rerank documents by relevance to query.
        
        Args:
            query: Search query
            documents: List of document texts to rerank
            top_n: Number of top results to return
            
        Returns:
            List of dicts with 'index', 'text', 'score' keys
        """
        pass
