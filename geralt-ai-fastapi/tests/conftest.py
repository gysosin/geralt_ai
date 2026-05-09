"""
Test Configuration and Fixtures

Shared test fixtures and configuration for the test suite.
"""
import os
import sys
from unittest.mock import MagicMock, patch
import pytest

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# =============================================================================
# Mock Settings for Testing
# =============================================================================

class MockSettings:
    """Mock settings for testing without real environment variables."""
    API_VERSION = "v1"
    API_TITLE = "GeraltAI API Test"
    ENVIRONMENT = "test"
    DEBUG = True
    API_ENDPOINT = "127.0.0.1:8000"
    AUTO_START_CELERY_WORKER = True
    
    SECRET_KEY = "test_secret_key"
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRE_HOURS = 24
    
    CORS_ORIGINS = ["*"]
    
    MONGO_URI = "mongodb://localhost:27017"
    MONGO_DATABASE = "test_geraltai"
    MONGO_SERVER_SELECTION_TIMEOUT_MS = 1000
    
    ELASTICSEARCH_URL = "http://localhost:9200"
    ELASTIC_INDEX = "test_documents"
    
    REDIS_HOST = "localhost"
    REDIS_PORT = 6379
    REDIS_PASSWORD = ""
    
    @property
    def redis_url(self):
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}"
    
    MINIO_ENDPOINT = "localhost:9000"
    MINIO_ACCESS_KEY = "minioadmin"
    MINIO_SECRET_KEY = "minioadmin"
    MINIO_BUCKET = "test-documents"
    MINIO_SECURE = False
    
    MILVUS_HOST = "localhost"
    MILVUS_PORT = 19530
    
    DEFAULT_AI_MODEL = "gemini"
    DEFAULT_EMBEDDING_MODEL = "gemini"
    DEFAULT_RERANKER = "cohere"
    
    GEMINI_API_KEY = "test_key"
    GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"
    GEMINI_LLM_MODEL = "gemini-2.5-flash-lite"
    
    OPENAI_API_KEY = "test_key"
    OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
    OPENAI_LLM_MODEL = "gpt-4o-mini"
    
    MISTRAL_API_KEY = "test_key"
    MISTRAL_EMBEDDING_MODEL = "mistral-embed"
    MISTRAL_LLM_MODEL = "mistral-small-latest"
    
    COHERE_API_KEY = "test_key"
    COHERE_RERANK_MODEL = "rerank-english-v3.0"
    
    JINAAI_API_KEY = "test_key"
    
    AZURE_CLIENT_ID = ""
    AZURE_CLIENT_SECRET = ""
    AZURE_TENANT_ID = ""
    AZURE_SCOPE = "user"
    
    CHUNK_SIZE = 512
    CHUNK_OVERLAP = 128
    RETRIEVAL_TOP_K = 10
    RERANK_TOP_N = 3
    VECTOR_WEIGHT = 0.7
    KEYWORD_WEIGHT = 0.3
    EMBEDDING_DIMENSION = 3072
    
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
    BOT_EMBED_URL = "https://test.example.com"
    TIMEZONE = "UTC"


@pytest.fixture
def mock_settings():
    """Provide mock settings for tests."""
    return MockSettings()


@pytest.fixture
def mock_redis_client():
    """Provide a mock Redis client."""
    mock = MagicMock()
    mock.get.return_value = None
    mock.set.return_value = True
    mock.delete.return_value = 1
    mock.exists.return_value = True
    mock.keys.return_value = []
    return mock


@pytest.fixture
def mock_mongo_collection():
    """Provide a mock MongoDB collection."""
    mock = MagicMock()
    mock.find_one.return_value = None
    mock.find.return_value = []
    mock.insert_one.return_value = MagicMock(inserted_id="test_id")
    mock.update_one.return_value = MagicMock(modified_count=1)
    mock.delete_one.return_value = MagicMock(deleted_count=1)
    return mock


@pytest.fixture
def mock_minio_client():
    """Provide a mock MinIO client."""
    mock = MagicMock()
    mock.bucket_exists.return_value = True
    mock.presigned_get_object.return_value = "https://example.com/presigned-url"
    return mock


@pytest.fixture
def sample_user_data():
    """Provide sample user data for testing."""
    return {
        "_id": "test_user_id",
        "username": "testuser",
        "email": "testuser@example.com",
        "full_name": "Test User",
        "tenant_id": "test_tenant",
    }


@pytest.fixture
def sample_collection_data():
    """Provide sample collection data for testing."""
    return {
        "collection_id": "test_collection_id",
        "name": "Test Collection",
        "public": False,
        "created_by": "testuser",
        "created_at": "2024-01-01T00:00:00",
        "tenant_id": "test_tenant",
    }


@pytest.fixture
def sample_document_data():
    """Provide sample document data for testing."""
    return {
        "_id": "test_doc_id",
        "collection_id": "test_collection_id",
        "file_name": "test_document.pdf",
        "file_path": "testuser/test_collection_id/test_doc_id/test_document.pdf",
        "file_size": 1024,
        "status": "completed",
        "is_processing": False,
    }


@pytest.fixture
def sample_bot_data():
    """Provide sample bot data for testing."""
    return {
        "_id": "test_bot_id",
        "bot_token": "test_bot_token_123",
        "bot_name": "Test Bot",
        "collection_ids": ["test_collection_id"],
        "tenant_id": "test_tenant",
        "created_by": "testuser",
    }


# =============================================================================
# FastAPI Test Client Fixture
# =============================================================================

@pytest.fixture
def test_client():
    """Provide a test client for API testing."""
    # Patch settings before importing app
    with patch('core.config.settings', MockSettings()):
        from fastapi.testclient import TestClient
        from main import app
        
        client = TestClient(app)
        yield client
