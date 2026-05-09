"""
Core Clients Package

Provides singleton access to external service clients.
Each client is wrapped in a class for better encapsulation and testability.
"""
from typing import Optional
import logging

from . import mistral_client as mistral_client


class ClientManager:
    """
    Centralized client manager providing access to all external service clients.
    Uses lazy initialization for efficiency.
    """
    
    _instance: Optional["ClientManager"] = None
    
    def __init__(self):
        self._redis = None
        self._minio = None
        self._elasticsearch = None
        self._milvus = None
        self._mistral = None
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @classmethod
    def get_instance(cls) -> "ClientManager":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @property
    def redis(self):
        """Get Redis client."""
        if self._redis is None:
            from core.clients.redis_client import get_redis_client
            self._redis = get_redis_client()
        return self._redis
    
    @property
    def minio(self):
        """Get MinIO client."""
        if self._minio is None:
            from core.clients.minio_client import get_minio_client
            self._minio = get_minio_client()
        return self._minio
    
    @property
    def elasticsearch(self):
        """Get Elasticsearch client."""
        if self._elasticsearch is None:
            from core.clients.elasticsearch_client import get_elasticsearch_client
            self._elasticsearch = get_elasticsearch_client()
        return self._elasticsearch
    
    @property
    def milvus(self):
        """Get Milvus client."""
        if self._milvus is None:
            from core.clients.milvus_client import get_milvus_client
            self._milvus = get_milvus_client()
        return self._milvus
    
    @property
    def mistral(self):
        """Get Mistral client."""
        if self._mistral is None:
            from core.clients.mistral_client import get_mistral_client
            self._mistral = get_mistral_client()
        return self._mistral


def get_client_manager() -> ClientManager:
    """Get the client manager singleton."""
    return ClientManager.get_instance()


# Convenience exports for backwards compatibility
def get_redis_client():
    """Get Redis client."""
    from core.clients.redis_client import get_redis_client as _get
    return _get()


def get_minio_client():
    """Get MinIO client."""
    from core.clients.minio_client import get_minio_client as _get
    return _get()


def get_elasticsearch_client():
    """Get Elasticsearch client."""
    from core.clients.elasticsearch_client import get_elasticsearch_client as _get
    return _get()


def get_mistral_client():
    """Get Mistral client."""
    from core.clients.mistral_client import get_mistral_client as _get
    return _get()


__all__ = [
    "ClientManager",
    "get_client_manager",
    "get_redis_client",
    "get_minio_client",
    "get_elasticsearch_client",
    "get_mistral_client",
    "mistral_client",
]
