"""
Configuration Module (Backwards Compatibility Shim)

This file provides backwards compatibility for code importing from 'config'.
Configuration has been moved to core/config.py with Pydantic Settings.

Usage Migration:
    # Old way
    from config import Config
    value = Config.MONGO_URI
    
    # New way
    from core.config import settings
    value = settings.MONGO_URI
"""
from core.config import settings


class Config:
    """
    Backwards compatibility class that proxies to pydantic settings.
    
    This class provides attribute access to the new Settings class,
    maintaining backwards compatibility with code using Config.ATTR pattern.
    """
    
    # ==========================================================================
    # API Configuration
    # ==========================================================================
    API_VERSION = settings.API_VERSION
    API_TITLE = settings.API_TITLE
    ENVIRONMENT = settings.ENVIRONMENT
    DEBUG = settings.DEBUG
    API_ENDPOINT = settings.API_ENDPOINT
    AUTO_START_CELERY_WORKER = settings.AUTO_START_CELERY_WORKER
    ALLOW_ANONYMOUS_AGENT_PLATFORM = settings.ALLOW_ANONYMOUS_AGENT_PLATFORM
    # Handle case where API_ENDPOINT may already include http:// or https://
    BASE_API_URL = settings.API_ENDPOINT if settings.API_ENDPOINT.startswith(('http://', 'https://')) else f"http://{settings.API_ENDPOINT}"
    
    # ==========================================================================
    # Security
    # ==========================================================================
    SECRET_KEY = settings.SECRET_KEY
    JWT_ALGORITHM = settings.JWT_ALGORITHM
    JWT_EXPIRE_HOURS = settings.JWT_EXPIRE_HOURS
    
    # ==========================================================================
    # CORS
    # ==========================================================================
    CORS_ORIGINS = settings.CORS_ORIGINS
    
    # ==========================================================================
    # MongoDB
    # ==========================================================================
    MONGO_URI = settings.MONGO_URI
    MONGO_DATABASE = settings.MONGO_DATABASE
    MONGO_SERVER_SELECTION_TIMEOUT_MS = settings.MONGO_SERVER_SELECTION_TIMEOUT_MS
    
    # ==========================================================================
    # Elasticsearch
    # ==========================================================================
    ELASTICSEARCH_URL = settings.ELASTICSEARCH_URL
    ELASTIC_INDEX = settings.ELASTIC_INDEX
    
    # ==========================================================================
    # Redis
    # ==========================================================================
    REDIS_HOST = settings.REDIS_HOST
    REDIS_PORT = settings.REDIS_PORT
    REDIS_PASSWORD = settings.REDIS_PASSWORD
    
    @classmethod
    def get_redis_url(cls) -> str:
        return settings.redis_url
    
    # ==========================================================================
    # MinIO (Object Storage)
    # ==========================================================================
    MINIO_ENDPOINT = settings.MINIO_ENDPOINT
    MINIO_ACCESS_KEY = settings.MINIO_ACCESS_KEY
    MINIO_SECRET_KEY = settings.MINIO_SECRET_KEY
    BUCKET_NAME = settings.MINIO_BUCKET
    MINIO_SECURE = settings.MINIO_SECURE
    
    # ==========================================================================
    # Milvus (Vector DB)
    # ==========================================================================
    MILVUS_HOST = settings.MILVUS_HOST
    MILVUS_PORT = settings.MILVUS_PORT
    MILVUS_USER = settings.MILVUS_USER
    MILVUS_PASSWORD = settings.MILVUS_PASSWORD
    MILVUS_TOKEN = settings.MILVUS_TOKEN
    
    # ==========================================================================
    # AI Providers
    # ==========================================================================
    DEFAULT_MODEL = settings.DEFAULT_AI_MODEL
    DEFAULT_EMBEDDING_MODEL = settings.DEFAULT_EMBEDDING_MODEL
    DEFAULT_RERANKER = settings.DEFAULT_RERANKER
    
    # Gemini
    GEMINI_API_KEY = settings.GEMINI_API_KEY
    GEMINI_EMBEDDING_MODEL = settings.GEMINI_EMBEDDING_MODEL
    GEMINI_LLM_MODEL = settings.GEMINI_LLM_MODEL
    
    # OpenAI
    OPENAI_API_KEY = settings.OPENAI_API_KEY
    OPENAI_EMBEDDING_MODEL = settings.OPENAI_EMBEDDING_MODEL
    OPENAI_LLM_MODEL = settings.OPENAI_LLM_MODEL
    
    # OpenAI client instance
    @classmethod
    @property
    def OPENAI_CLIENT(cls):
        """Lazy load OpenAI client."""
        from openai import OpenAI
        return OpenAI(api_key=settings.OPENAI_API_KEY)
    
    # Mistral
    MISTRAL_API_KEY = settings.MISTRAL_API_KEY
    MISTRAL_EMBEDDING_MODEL = settings.MISTRAL_EMBEDDING_MODEL
    MISTRAL_LLM_MODEL = settings.MISTRAL_LLM_MODEL
    
    # Cohere
    COHERE_API_KEY = settings.COHERE_API_KEY
    COHERE_RERANK_MODEL = settings.COHERE_RERANK_MODEL
    
    # Jina AI
    JINAAI_API_KEY = settings.JINAAI_API_KEY
    
    # ==========================================================================
    # Azure AD (Microsoft Auth)
    # ==========================================================================
    AZURE_CLIENT_ID = settings.AZURE_CLIENT_ID
    AZURE_CLIENT_SECRET = settings.AZURE_CLIENT_SECRET
    AZURE_TENANT_ID = settings.AZURE_TENANT_ID
    AZURE_SCOPE = settings.AZURE_SCOPE
    
    # ==========================================================================
    # RAG Configuration
    # ==========================================================================
    CHUNK_SIZE = settings.CHUNK_SIZE
    CHUNK_OVERLAP = settings.CHUNK_OVERLAP
    RETRIEVAL_TOP_K = settings.RETRIEVAL_TOP_K
    RERANK_TOP_N = settings.RERANK_TOP_N
    VECTOR_WEIGHT = settings.VECTOR_WEIGHT
    KEYWORD_WEIGHT = settings.KEYWORD_WEIGHT
    EMBEDDING_DIMENSION = settings.EMBEDDING_DIMENSION
    EMBEDDING_DIM = settings.EMBEDDING_DIMENSION
    
    # ==========================================================================
    # Upload Limits
    # ==========================================================================
    MAX_CONTENT_LENGTH = settings.MAX_CONTENT_LENGTH
    
    # ==========================================================================
    # External URLs
    # ==========================================================================
    BOT_EMBED_URL = settings.BOT_EMBED_URL
    
    # ==========================================================================
    # Timezone
    # ==========================================================================
    TIMEZONE = settings.TIMEZONE


# Also export settings directly for new code
__all__ = ["Config", "settings"]
