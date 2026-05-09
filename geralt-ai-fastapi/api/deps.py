"""
API Dependencies

Dependency injection for database connections, AI providers, and common utilities.
"""
import logging
from functools import lru_cache
from typing import Optional

from fastapi import Depends

from core.config import settings
from core.security.jwt import get_current_user, get_optional_user

logger = logging.getLogger(__name__)


# =============================================================================
# Database Dependencies
# =============================================================================

@lru_cache
def get_mongo_client():
    """Get MongoDB client (cached)."""
    from pymongo import MongoClient
    return MongoClient(
        settings.MONGO_URI,
        serverSelectionTimeoutMS=settings.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    )


def get_database():
    """Get MongoDB database instance."""
    client = get_mongo_client()
    return client[settings.MONGO_DATABASE]


async def get_async_es_client():
    """Get async Elasticsearch client."""
    from elasticsearch import AsyncElasticsearch
    return AsyncElasticsearch(settings.ELASTICSEARCH_URL)


@lru_cache
def get_redis_client():
    """Get Redis client (cached)."""
    import redis
    return redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD or None,
        decode_responses=True,
    )


@lru_cache
def get_minio_client():
    """Get MinIO client (cached)."""
    from minio import Minio
    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )


# =============================================================================
# AI Provider Dependencies
# =============================================================================

def get_embedding_provider():
    """Get embedding provider based on configuration."""
    from core.ai.factory import AIProviderFactory
    return AIProviderFactory.get_embedding_provider()


def get_llm_provider():
    """Get LLM provider based on configuration."""
    from core.ai.factory import AIProviderFactory
    return AIProviderFactory.get_llm_provider()


def get_reranker_provider():
    """Get reranker provider if enabled."""
    from core.ai.factory import AIProviderFactory
    return AIProviderFactory.get_reranker_provider()


# =============================================================================
# RAG Pipeline Dependencies
# =============================================================================

async def get_rag_pipeline():
    """Get configured RAG pipeline."""
    from core.rag.pipeline import RAGPipelineBuilder
    
    es_client = await get_async_es_client()
    
    pipeline = (
        RAGPipelineBuilder()
        .with_embedding_model(settings.DEFAULT_EMBEDDING_MODEL)
        .with_llm_model(settings.DEFAULT_AI_MODEL)
        .with_reranker(settings.DEFAULT_RERANKER != "none")
        .build(es_client)
    )
    
    return pipeline


# =============================================================================
# Repository Dependencies
# =============================================================================

def get_token_collection():
    """Get tokens MongoDB collection."""
    db = get_database()
    return db["tokens"]


def get_collection_collection():
    """Get collections MongoDB collection."""
    db = get_database()
    return db["collections"]


def get_document_collection():
    """Get documents MongoDB collection."""
    db = get_database()
    return db["documents"]


def get_conversation_collection():
    """Get conversations MongoDB collection."""
    db = get_database()
    return db["conversations"]


def get_user_collection():
    """Get users MongoDB collection."""
    db = get_database()
    return db["users"]


def get_quiz_collection():
    """Get quizzes MongoDB collection."""
    db = get_database()
    return db["quizzes"]


# =============================================================================
# Common Dependencies
# =============================================================================

class CommonDeps:
    """Common dependencies grouped together."""
    
    def __init__(
        self,
        current_user: str = Depends(get_current_user),
    ):
        self.current_user = current_user
        self.db = get_database()


class OptionalAuthDeps:
    """Dependencies with optional authentication."""
    
    def __init__(
        self,
        current_user: Optional[str] = Depends(get_optional_user),
    ):
        self.current_user = current_user
        self.is_authenticated = current_user is not None
