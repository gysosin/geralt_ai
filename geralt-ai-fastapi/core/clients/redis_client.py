"""
Redis Client

Provides Redis connection with OOP wrapper.
"""
import logging
from typing import Optional

import redis

from config import Config


class RedisClient:
    """
    Redis client wrapper with connection management.
    
    Provides:
    - Connection pooling
    - Error handling
    - Common operations
    """
    
    _instance: Optional["RedisClient"] = None
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self._client = redis.StrictRedis(
            host=Config.REDIS_HOST,
            port=Config.REDIS_PORT,
            password=Config.REDIS_PASSWORD,
            decode_responses=True,
        )
        self.logger.info(f"Redis connected to {Config.REDIS_HOST}:{Config.REDIS_PORT}")
    
    @classmethod
    def get_instance(cls) -> "RedisClient":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @property
    def client(self):
        """Get raw Redis client."""
        return self._client
    
    def get(self, key: str) -> Optional[str]:
        """Get value by key."""
        return self._client.get(key)
    
    def set(self, key: str, value: str, ex: int = None) -> bool:
        """Set value with optional expiry."""
        return self._client.set(key, value, ex=ex)
    
    def setex(self, key: str, time: int, value: str) -> bool:
        """Set value with expiry."""
        return self._client.setex(key, time, value)
    
    def delete(self, key: str) -> int:
        """Delete key."""
        return self._client.delete(key)
    
    def exists(self, key: str) -> bool:
        """Check if key exists."""
        return self._client.exists(key)
    
    def keys(self, pattern: str = "*"):
        """Get keys matching pattern."""
        return self._client.keys(pattern)
    
    def __getattr__(self, name):
        """Proxy other methods to underlying client."""
        return getattr(self._client, name)


# Singleton access
_redis_client_instance: Optional[RedisClient] = None


def get_redis_client() -> RedisClient:
    """Get or create the Redis client singleton."""
    global _redis_client_instance
    if _redis_client_instance is None:
        _redis_client_instance = RedisClient()
    return _redis_client_instance


# Backwards compatibility - direct client access
redis_client = None


def init_redis():
    """Initialize Redis client for backwards compatibility."""
    global redis_client
    redis_client = get_redis_client().client
    return redis_client
