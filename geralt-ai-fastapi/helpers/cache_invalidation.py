"""
Cache Invalidation Service

OOP-based cache invalidation for Redis cache management.
"""
import logging
from typing import List, Optional

from core.clients.redis_client import get_redis_client, RedisClient


class CacheInvalidationService:
    """
    Service for managing cache invalidation across the application.
    
    Provides methods to invalidate various types of cached data:
    - Collection caches
    - Document caches
    - Conversation caches
    - Search result caches
    """
    
    _instance: Optional["CacheInvalidationService"] = None
    
    def __init__(self, redis_client: Optional[RedisClient] = None):
        """
        Initialize the cache invalidation service.
        
        Args:
            redis_client: Optional Redis client instance. Uses singleton if not provided.
        """
        self.logger = logging.getLogger(self.__class__.__name__)
        self._redis = redis_client or get_redis_client()
    
    @classmethod
    def get_instance(cls) -> "CacheInvalidationService":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @property
    def redis(self):
        """Get the Redis client."""
        return self._redis.client
    
    # =========================================================================
    # Collection Cache Invalidation
    # =========================================================================
    
    def invalidate_collections(self, username: str) -> bool:
        """
        Invalidate collections cache for a user.
        
        Args:
            username: The username whose collection cache to invalidate
            
        Returns:
            True if cache was invalidated, False otherwise
        """
        cache_key = f"collections_{username}"
        try:
            result = self.redis.delete(cache_key)
            self.logger.info(f"Cache invalidated for user {username}")
            return bool(result)
        except Exception as e:
            self.logger.error(f"Error invalidating collection cache for {username}: {e}")
            return False
    
    # =========================================================================
    # Document Cache Invalidation
    # =========================================================================
    
    def invalidate_documents(self, username: str, collection_id: str) -> bool:
        """
        Invalidate document cache for a specific collection.
        
        Args:
            username: The username
            collection_id: The collection ID
            
        Returns:
            True if cache was invalidated, False otherwise
        """
        cache_key = f"{username}_collection_{collection_id}_documents"
        try:
            if self.redis.exists(cache_key):
                self.redis.delete(cache_key)
                self.logger.info(f"Cache invalidated for {username}, collection: {collection_id}")
                return True
            else:
                self.logger.debug(f"No cache found for {username}, collection: {collection_id}")
                return False
        except Exception as e:
            self.logger.error(
                f"Error invalidating cache for {username}, collection: {collection_id}: {e}"
            )
            return False
    
    def invalidate_documents_by_username(self, username: str) -> int:
        """
        Invalidate all document caches for a user.
        
        Args:
            username: The username whose document caches to invalidate
            
        Returns:
            Number of cache keys deleted
        """
        pattern = f"{username}_collection_*_documents"
        try:
            keys = self.redis.keys(pattern)
            if keys:
                deleted = self.redis.delete(*keys)
                self.logger.info(f"Invalidated {deleted} document caches for user {username}")
                return deleted
            else:
                self.logger.debug(f"No document caches found for user {username}")
                return 0
        except Exception as e:
            self.logger.error(f"Error invalidating document caches for {username}: {e}")
            return 0
    
    # =========================================================================
    # Conversation Cache Invalidation
    # =========================================================================
    
    def invalidate_conversation(self, conversation_id: str) -> bool:
        """
        Invalidate cache for a specific conversation.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            True if cache was invalidated, False otherwise
        """
        cache_key = f"conversation_{conversation_id}"
        try:
            if self.redis.exists(cache_key):
                self.redis.delete(cache_key)
                self.logger.info(f"Cache invalidated for conversation ID: {conversation_id}")
                return True
            else:
                self.logger.debug(f"No cache found for conversation ID: {conversation_id}")
                return False
        except Exception as e:
            self.logger.error(f"Error invalidating cache for conversation ID: {conversation_id}: {e}")
            return False
    
    def invalidate_conversations_by_collection(self, username: str, collection_id: str) -> bool:
        """
        Invalidate conversation cache for a specific collection.
        
        Args:
            username: The username
            collection_id: The collection ID
            
        Returns:
            True if cache was invalidated, False otherwise
        """
        cache_key = f"conversations_by_collection_{username}_{collection_id}"
        try:
            if self.redis.exists(cache_key):
                self.redis.delete(cache_key)
                self.logger.info(
                    f"Cache invalidated for conversations in collection {collection_id} for user {username}"
                )
                return True
            else:
                self.logger.debug(
                    f"No cache found for conversations in collection {collection_id} for user {username}"
                )
                return False
        except Exception as e:
            self.logger.error(
                f"Error invalidating cache for collection {collection_id} and user {username}: {e}"
            )
            return False
    
    def invalidate_conversations_by_user(self, username: str) -> int:
        """
        Invalidate all conversation caches for a user.
        
        Args:
            username: The username
            
        Returns:
            Number of cache keys deleted
        """
        pattern = f"conversations_by_collection_{username}_*"
        try:
            keys = self.redis.keys(pattern)
            if keys:
                deleted = self.redis.delete(*keys)
                self.logger.info(f"Invalidated {deleted} conversation caches for user {username}")
                return deleted
            else:
                self.logger.debug(f"No conversation caches found for user {username}")
                return 0
        except Exception as e:
            self.logger.error(f"Error invalidating conversation caches for {username}: {e}")
            return 0
    
    def invalidate_all_conversations(self, username: str) -> bool:
        """
        Invalidate the all-conversations cache for a user.
        
        Args:
            username: The username
            
        Returns:
            True if cache was invalidated, False otherwise
        """
        cache_key = f"conversations_{username}"
        try:
            if self.redis.exists(cache_key):
                self.redis.delete(cache_key)
                self.logger.info(f"Cache invalidated for all conversations of user {username}")
                return True
            else:
                self.logger.debug(f"No cache found for all conversations of user {username}")
                return False
        except Exception as e:
            self.logger.error(f"Error invalidating all conversations cache for {username}: {e}")
            return False
    
    # =========================================================================
    # Search Cache Invalidation
    # =========================================================================
    
    def invalidate_search(self, username: str, collection_id: str) -> bool:
        """
        Invalidate search cache for a specific collection.
        
        Args:
            username: The username
            collection_id: The collection ID
            
        Returns:
            True if cache was invalidated, False otherwise
        """
        cache_key = f"search_conversation_{username}_{collection_id}"
        try:
            if self.redis.exists(cache_key):
                self.redis.delete(cache_key)
                self.logger.info(
                    f"Cache invalidated for search with collection ID '{collection_id}' for user {username}"
                )
                return True
            else:
                self.logger.debug(
                    f"No cache found for search with collection ID '{collection_id}' for user {username}"
                )
                return False
        except Exception as e:
            self.logger.error(
                f"Error invalidating search cache for collection '{collection_id}' for user {username}: {e}"
            )
            return False
    
    # =========================================================================
    # Bulk Operations
    # =========================================================================
    
    def invalidate_all_user_caches(self, username: str) -> dict:
        """
        Invalidate all caches for a user.
        
        Args:
            username: The username
            
        Returns:
            Dictionary with counts of invalidated caches per type
        """
        results = {
            "collections": self.invalidate_collections(username),
            "documents": self.invalidate_documents_by_username(username),
            "conversations": self.invalidate_conversations_by_user(username),
            "all_conversations": self.invalidate_all_conversations(username),
        }
        return results


# Singleton access
_cache_service_instance: Optional[CacheInvalidationService] = None


def get_cache_service() -> CacheInvalidationService:
    """Get or create the cache invalidation service singleton."""
    global _cache_service_instance
    if _cache_service_instance is None:
        _cache_service_instance = CacheInvalidationService()
    return _cache_service_instance


# =============================================================================
# Backwards Compatibility Functions
# =============================================================================

def invalidate_collections_cache(username: str):
    """Backwards compatible: Invalidate collections cache."""
    return get_cache_service().invalidate_collections(username)


def invalidate_cache_for_private_documents(username: str, collection_id: str):
    """Backwards compatible: Invalidate document cache."""
    return get_cache_service().invalidate_documents(username, collection_id)


def invalidate_cache_for_conversation(conversation_id: str):
    """Backwards compatible: Invalidate conversation cache."""
    return get_cache_service().invalidate_conversation(conversation_id)


def invalidate_cache_for_conversations_by_collection(username: str, collection_id: str):
    """Backwards compatible: Invalidate conversation cache by collection."""
    return get_cache_service().invalidate_conversations_by_collection(username, collection_id)


def invalidate_cache_for_conversations_by_user(username: str):
    """Backwards compatible: Invalidate all conversation caches for user."""
    return get_cache_service().invalidate_conversations_by_user(username)


def invalidate_cache_for_search_with_collection_id(username: str, collection_id: str):
    """Backwards compatible: Invalidate search cache."""
    return get_cache_service().invalidate_search(username, collection_id)


def invalidate_cache_for_all_conversations(username: str):
    """Backwards compatible: Invalidate all conversations cache."""
    return get_cache_service().invalidate_all_conversations(username)


def invalidate_cache_for_private_documents_by_username(username: str):
    """Backwards compatible: Invalidate all document caches for user."""
    return get_cache_service().invalidate_documents_by_username(username)
