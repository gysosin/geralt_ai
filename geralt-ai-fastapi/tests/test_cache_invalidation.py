"""
Tests for Cache Invalidation Service

Tests for helpers/cache_invalidation.py CacheInvalidationService class.
"""
import pytest
from unittest.mock import MagicMock, patch


class TestCacheInvalidationService:
    """Test suite for CacheInvalidationService class."""
    
    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        mock = MagicMock()
        mock.delete.return_value = 1
        mock.exists.return_value = True
        mock.keys.return_value = ["key1", "key2"]
        return mock
    
    @pytest.fixture
    def cache_service(self, mock_redis):
        """Create a CacheInvalidationService with mocked Redis."""
        with patch('helpers.cache_invalidation.get_redis_client') as mock_get_redis:
            mock_client = MagicMock()
            mock_client.client = mock_redis
            mock_get_redis.return_value = mock_client
            
            from helpers.cache_invalidation import CacheInvalidationService
            service = CacheInvalidationService()
            service._redis = mock_client
            return service
    
    def test_invalidate_collections_success(self, cache_service, mock_redis):
        """Test successful collection cache invalidation."""
        result = cache_service.invalidate_collections("testuser")
        
        mock_redis.delete.assert_called_once_with("collections_testuser")
        assert result is True
    
    def test_invalidate_collections_failure(self, cache_service, mock_redis):
        """Test collection cache invalidation when delete fails."""
        mock_redis.delete.return_value = 0
        
        result = cache_service.invalidate_collections("testuser")
        assert result is False
    
    def test_invalidate_documents_exists(self, cache_service, mock_redis):
        """Test document cache invalidation when cache exists."""
        result = cache_service.invalidate_documents("testuser", "collection123")
        
        cache_key = "testuser_collection_collection123_documents"
        mock_redis.exists.assert_called_with(cache_key)
        mock_redis.delete.assert_called_with(cache_key)
        assert result is True
    
    def test_invalidate_documents_not_exists(self, cache_service, mock_redis):
        """Test document cache invalidation when cache doesn't exist."""
        mock_redis.exists.return_value = False
        
        result = cache_service.invalidate_documents("testuser", "collection123")
        assert result is False
    
    def test_invalidate_documents_by_username(self, cache_service, mock_redis):
        """Test invalidating all document caches for a user."""
        mock_redis.keys.return_value = ["key1", "key2", "key3"]
        mock_redis.delete.return_value = 3
        
        result = cache_service.invalidate_documents_by_username("testuser")
        
        mock_redis.keys.assert_called_with("testuser_collection_*_documents")
        assert result == 3
    
    def test_invalidate_documents_by_username_no_keys(self, cache_service, mock_redis):
        """Test invalidating document caches when no keys exist."""
        mock_redis.keys.return_value = []
        
        result = cache_service.invalidate_documents_by_username("testuser")
        assert result == 0
    
    def test_invalidate_conversation(self, cache_service, mock_redis):
        """Test conversation cache invalidation."""
        result = cache_service.invalidate_conversation("conv123")
        
        mock_redis.exists.assert_called_with("conversation_conv123")
        mock_redis.delete.assert_called_with("conversation_conv123")
        assert result is True
    
    def test_invalidate_conversations_by_collection(self, cache_service, mock_redis):
        """Test conversation cache invalidation by collection."""
        result = cache_service.invalidate_conversations_by_collection("testuser", "coll123")
        
        cache_key = "conversations_by_collection_testuser_coll123"
        mock_redis.exists.assert_called_with(cache_key)
        mock_redis.delete.assert_called_with(cache_key)
        assert result is True
    
    def test_invalidate_conversations_by_user(self, cache_service, mock_redis):
        """Test invalidating all conversation caches for a user."""
        mock_redis.keys.return_value = ["conv1", "conv2"]
        mock_redis.delete.return_value = 2
        
        result = cache_service.invalidate_conversations_by_user("testuser")
        
        mock_redis.keys.assert_called_with("conversations_by_collection_testuser_*")
        assert result == 2
    
    def test_invalidate_all_conversations(self, cache_service, mock_redis):
        """Test invalidating all conversations cache."""
        result = cache_service.invalidate_all_conversations("testuser")
        
        mock_redis.exists.assert_called_with("conversations_testuser")
        mock_redis.delete.assert_called_with("conversations_testuser")
        assert result is True
    
    def test_invalidate_search(self, cache_service, mock_redis):
        """Test search cache invalidation."""
        result = cache_service.invalidate_search("testuser", "coll123")
        
        cache_key = "search_conversation_testuser_coll123"
        mock_redis.exists.assert_called_with(cache_key)
        mock_redis.delete.assert_called_with(cache_key)
        assert result is True
    
    def test_invalidate_all_user_caches(self, cache_service, mock_redis):
        """Test invalidating all caches for a user."""
        mock_redis.keys.return_value = ["key1"]
        mock_redis.delete.return_value = 1
        
        results = cache_service.invalidate_all_user_caches("testuser")
        
        assert "collections" in results
        assert "documents" in results
        assert "conversations" in results
        assert "all_conversations" in results
    
    def test_exception_handling(self, cache_service, mock_redis):
        """Test exception handling during cache operations."""
        mock_redis.delete.side_effect = Exception("Redis error")
        
        result = cache_service.invalidate_collections("testuser")
        assert result is False


class TestBackwardsCompatibilityFunctions:
    """Test backwards compatible function exports."""
    
    @pytest.fixture
    def mock_service(self):
        """Mock the cache service."""
        with patch('helpers.cache_invalidation.get_cache_service') as mock:
            service = MagicMock()
            mock.return_value = service
            yield service
    
    def test_invalidate_collections_cache(self, mock_service):
        """Test backwards compatible invalidate_collections_cache."""
        from helpers.cache_invalidation import invalidate_collections_cache
        
        mock_service.invalidate_collections.return_value = True
        invalidate_collections_cache("testuser")
        
        mock_service.invalidate_collections.assert_called_once_with("testuser")
    
    def test_invalidate_cache_for_private_documents(self, mock_service):
        """Test backwards compatible invalidate_cache_for_private_documents."""
        from helpers.cache_invalidation import invalidate_cache_for_private_documents
        
        mock_service.invalidate_documents.return_value = True
        invalidate_cache_for_private_documents("testuser", "coll123")
        
        mock_service.invalidate_documents.assert_called_once_with("testuser", "coll123")
    
    def test_invalidate_cache_for_conversation(self, mock_service):
        """Test backwards compatible invalidate_cache_for_conversation."""
        from helpers.cache_invalidation import invalidate_cache_for_conversation
        
        mock_service.invalidate_conversation.return_value = True
        invalidate_cache_for_conversation("conv123")
        
        mock_service.invalidate_conversation.assert_called_once_with("conv123")
    
    def test_invalidate_cache_for_all_conversations(self, mock_service):
        """Test backwards compatible invalidate_cache_for_all_conversations."""
        from helpers.cache_invalidation import invalidate_cache_for_all_conversations
        
        mock_service.invalidate_all_conversations.return_value = True
        invalidate_cache_for_all_conversations("testuser")
        
        mock_service.invalidate_all_conversations.assert_called_once_with("testuser")
