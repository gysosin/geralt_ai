"""
Tests for Core Clients

Tests for core/clients/ Redis, MinIO, Elasticsearch, and Mistral clients.
"""
import pytest
from unittest.mock import MagicMock, patch


class TestRedisClient:
    """Test suite for RedisClient class."""
    
    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis connection."""
        mock = MagicMock()
        mock.get.return_value = "test_value"
        mock.set.return_value = True
        mock.delete.return_value = 1
        mock.exists.return_value = True
        mock.keys.return_value = ["key1", "key2"]
        return mock
    
    @pytest.fixture
    def redis_client(self, mock_redis):
        """Create a RedisClient with mocked connection."""
        with patch('core.clients.redis_client.redis.StrictRedis', return_value=mock_redis):
            from core.clients.redis_client import RedisClient
            # Reset singleton for test
            RedisClient._instance = None
            client = RedisClient()
            return client
    
    def test_client_property(self, redis_client, mock_redis):
        """Test that client property returns raw Redis client."""
        assert redis_client.client is mock_redis
    
    def test_get(self, redis_client, mock_redis):
        """Test get method."""
        result = redis_client.get("test_key")
        mock_redis.get.assert_called_with("test_key")
        assert result == "test_value"
    
    def test_set(self, redis_client, mock_redis):
        """Test set method."""
        result = redis_client.set("test_key", "test_value")
        mock_redis.set.assert_called()
        assert result is True
    
    def test_set_with_expiry(self, redis_client, mock_redis):
        """Test set method with expiry."""
        redis_client.set("test_key", "test_value", ex=3600)
        mock_redis.set.assert_called_with("test_key", "test_value", ex=3600)
    
    def test_setex(self, redis_client, mock_redis):
        """Test setex method."""
        redis_client.setex("test_key", 3600, "test_value")
        mock_redis.setex.assert_called_with("test_key", 3600, "test_value")
    
    def test_delete(self, redis_client, mock_redis):
        """Test delete method."""
        result = redis_client.delete("test_key")
        mock_redis.delete.assert_called_with("test_key")
        assert result == 1
    
    def test_exists(self, redis_client, mock_redis):
        """Test exists method."""
        result = redis_client.exists("test_key")
        mock_redis.exists.assert_called_with("test_key")
        assert result is True
    
    def test_keys(self, redis_client, mock_redis):
        """Test keys method."""
        result = redis_client.keys("test_*")
        mock_redis.keys.assert_called_with("test_*")
        assert result == ["key1", "key2"]
    
    def test_singleton_instance(self, mock_redis):
        """Test that get_instance returns same object."""
        with patch('core.clients.redis_client.redis.StrictRedis', return_value=mock_redis):
            from core.clients.redis_client import RedisClient
            # Reset singleton for test
            RedisClient._instance = None
            
            instance1 = RedisClient.get_instance()
            instance2 = RedisClient.get_instance()
            
            assert instance1 is instance2
    
    def test_get_redis_client_function(self, mock_redis):
        """Test get_redis_client factory function."""
        with patch('core.clients.redis_client.redis.StrictRedis', return_value=mock_redis):
            # Reset module-level singleton
            import core.clients.redis_client as redis_module
            redis_module._redis_client_instance = None
            
            from core.clients.redis_client import get_redis_client
            
            client1 = get_redis_client()
            client2 = get_redis_client()
            
            assert client1 is client2


class TestMinioClient:
    """Test suite for MinioClient class."""
    
    @pytest.fixture
    def mock_minio(self):
        """Create a mock MinIO connection."""
        mock = MagicMock()
        mock.bucket_exists.return_value = True
        mock.make_bucket.return_value = None
        mock.presigned_get_object.return_value = "https://example.com/presigned"
        return mock
    
    @pytest.fixture
    def minio_client(self, mock_minio):
        """Create a MinioClient with mocked connection."""
        with patch('core.clients.minio_client.Minio', return_value=mock_minio):
            from core.clients.minio_client import MinioClient
            # Reset singleton for test
            MinioClient._instance = None
            client = MinioClient()
            return client
    
    def test_client_property(self, minio_client, mock_minio):
        """Test that client property returns raw MinIO client."""
        assert minio_client.client is mock_minio
    
    def test_ensure_bucket_exists(self, minio_client, mock_minio):
        """Test ensure_bucket when bucket already exists."""
        mock_minio.bucket_exists.return_value = True
        
        result = minio_client.ensure_bucket("test-bucket")
        mock_minio.bucket_exists.assert_called_with("test-bucket")
        mock_minio.make_bucket.assert_not_called()
        assert result is False
    
    def test_ensure_bucket_creates_new(self, minio_client, mock_minio):
        """Test ensure_bucket when bucket doesn't exist."""
        mock_minio.bucket_exists.return_value = False
        
        result = minio_client.ensure_bucket("test-bucket")
        mock_minio.bucket_exists.assert_called_with("test-bucket")
        mock_minio.make_bucket.assert_called_with("test-bucket")
        assert result is True
    
    def test_put_object(self, minio_client, mock_minio):
        """Test put_object method."""
        data = MagicMock()
        minio_client.put_object("bucket", "path/to/file", data, 1024)
        mock_minio.put_object.assert_called_with("bucket", "path/to/file", data, 1024)
    
    def test_get_object(self, minio_client, mock_minio):
        """Test get_object method."""
        minio_client.get_object("bucket", "path/to/file")
        mock_minio.get_object.assert_called_with("bucket", "path/to/file")
    
    def test_remove_object(self, minio_client, mock_minio):
        """Test remove_object method."""
        minio_client.remove_object("bucket", "path/to/file")
        mock_minio.remove_object.assert_called_with("bucket", "path/to/file")
    
    def test_presigned_get_object(self, minio_client, mock_minio):
        """Test presigned_get_object method."""
        result = minio_client.presigned_get_object("bucket", "path/to/file")
        mock_minio.presigned_get_object.assert_called()
        assert result == "https://example.com/presigned"
    
    def test_singleton_instance(self, mock_minio):
        """Test that get_instance returns same object."""
        with patch('core.clients.minio_client.Minio', return_value=mock_minio):
            from core.clients.minio_client import MinioClient
            # Reset singleton for test
            MinioClient._instance = None
            
            instance1 = MinioClient.get_instance()
            instance2 = MinioClient.get_instance()
            
            assert instance1 is instance2


class TestElasticsearchClient:
    """Test suite for ElasticsearchClient class."""
    
    @pytest.fixture
    def mock_es(self):
        """Create a mock Elasticsearch connection."""
        mock = MagicMock()
        mock.ping.return_value = True
        mock.indices.exists.return_value = True
        mock.search.return_value = {"hits": {"hits": []}}
        return mock
    
    @pytest.fixture
    def es_client(self, mock_es):
        """Create an ElasticsearchClient with mocked connection."""
        with patch('core.clients.elasticsearch_client.Elasticsearch', return_value=mock_es):
            from core.clients.elasticsearch_client import ElasticsearchClient
            # Reset singleton for test
            ElasticsearchClient._instance = None
            client = ElasticsearchClient()
            return client
    
    def test_client_property(self, es_client, mock_es):
        """Test that client property returns raw ES client."""
        assert es_client.client is mock_es
    
    def test_ping_success(self, es_client, mock_es):
        """Test successful ping."""
        result = es_client.ping()
        mock_es.ping.assert_called()
        assert result is True
    
    def test_ping_failure(self, es_client, mock_es):
        """Test ping failure."""
        mock_es.ping.side_effect = Exception("Connection failed")
        
        result = es_client.ping()
        assert result is False
    
    def test_singleton_instance(self, mock_es):
        """Test that get_instance returns same object."""
        with patch('core.clients.elasticsearch_client.Elasticsearch', return_value=mock_es):
            from core.clients.elasticsearch_client import ElasticsearchClient
            # Reset singleton for test
            ElasticsearchClient._instance = None
            
            instance1 = ElasticsearchClient.get_instance()
            instance2 = ElasticsearchClient.get_instance()
            
            assert instance1 is instance2


class TestMistralClient:
    """Test suite for MistralClient class."""
    
    @pytest.fixture
    def mock_mistral(self):
        """Create a mock Mistral connection."""
        mock = MagicMock()
        mock.chat.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Test response"))]
        )
        mock.embeddings.return_value = MagicMock(
            data=[MagicMock(embedding=[0.1, 0.2, 0.3])]
        )
        return mock
    
    @pytest.fixture
    def mistral_client(self, mock_mistral):
        """Create a MistralClient with mocked connection."""
        with patch('core.clients.mistral_client.Mistral', return_value=mock_mistral):
            from core.clients.mistral_client import MistralClient
            # Reset singleton for test
            MistralClient._instance = None
            client = MistralClient()
            return client
    
    def test_client_property(self, mistral_client, mock_mistral):
        """Test that client property returns raw Mistral client."""
        assert mistral_client.client is mock_mistral
    
    def test_singleton_instance(self, mock_mistral):
        """Test that get_instance returns same object."""
        with patch('core.clients.mistral_client.Mistral', return_value=mock_mistral):
            from core.clients.mistral_client import MistralClient
            # Reset singleton for test
            MistralClient._instance = None
            
            instance1 = MistralClient.get_instance()
            instance2 = MistralClient.get_instance()
            
            assert instance1 is instance2


class TestClientsPackage:
    """Test suite for clients package exports."""
    
    def test_clients_module_exports(self):
        """Test that clients.py exports all expected items."""
        with patch('core.clients.redis_client.redis.StrictRedis'):
            with patch('core.clients.minio_client.Minio'):
                with patch('core.clients.elasticsearch_client.Elasticsearch'):
                    with patch('core.clients.mistral_client.Mistral'):
                        from clients import (
                            redis_client,
                            minio_client,
                            es_client,
                            get_redis_client,
                            get_minio_client,
                            get_elasticsearch_client,
                        )
                        
                        # Should be callable getters
                        assert callable(get_redis_client)
                        assert callable(get_minio_client)
                        assert callable(get_elasticsearch_client)
