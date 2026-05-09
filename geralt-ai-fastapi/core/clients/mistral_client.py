"""
Mistral Client

Provides Mistral AI client with OOP wrapper.
Updated for mistralai v1.x
"""
import logging
from typing import Optional

try:
    from mistralai import Mistral
except ImportError:  # mistralai >= 2 exposes the client from mistralai.client
    from mistralai.client import Mistral

from config import Config


class MistralClient:
    """
    Mistral AI client wrapper.
    
    Provides:
    - API connection
    - Chat completions
    - Embeddings
    """
    
    _instance: Optional["MistralClient"] = None
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self._client = Mistral(api_key=Config.MISTRAL_API_KEY)
        self.logger.info("Mistral client initialized")
    
    @classmethod
    def get_instance(cls) -> "MistralClient":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @property
    def client(self):
        """Get raw Mistral client."""
        return self._client
    
    def chat(self, model: str, messages: list, **kwargs):
        """Create chat completion."""
        # v1 API: client.chat.complete(...)
        return self._client.chat.complete(model=model, messages=messages, **kwargs)
    
    def embed(self, model: str, input: list):
        """Create embeddings."""
        # v1 API: client.embeddings.create(inputs=...)
        # Note: 'input' arg in older version is 'inputs' in newer version typically, checking docs...
        # Mistral v1 python client uses 'inputs' for list of strings.
        return self._client.embeddings.create(model=model, inputs=input)
    
    def embeddings(self, model: str, input: list):
        """Alias for embed to match older usage if any."""
        return self.embed(model, input)

    def __getattr__(self, name):
        """Proxy other methods to underlying client."""
        return getattr(self._client, name)


# Singleton access
_mistral_client_instance: Optional[MistralClient] = None


def get_mistral_client() -> MistralClient:
    """Get or create the Mistral client singleton."""
    global _mistral_client_instance
    if _mistral_client_instance is None:
        _mistral_client_instance = MistralClient()
    return _mistral_client_instance


# Backwards compatibility
mistral_client = None


def init_mistral():
    """Initialize Mistral client for backwards compatibility."""
    global mistral_client
    mistral_client = get_mistral_client() # Return wrapper to handle method diffs
    return mistral_client
