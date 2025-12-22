"""
Clients Module (Backwards Compatibility Shim)

This file provides backwards compatibility for code importing from 'clients'.
All clients have been moved to core/clients/ package with OOP wrappers.

Usage Migration:
    # Old way
    from clients import redis_client, minio_client, es_client
    
    # New way
    from core.clients import get_redis_client, get_minio_client, get_elasticsearch_client
    redis = get_redis_client()
    minio = get_minio_client()
    es = get_elasticsearch_client()
"""
from core.clients.redis_client import get_redis_client, RedisClient
from core.clients.minio_client import get_minio_client, MinioClient
from core.clients.elasticsearch_client import get_elasticsearch_client, ElasticsearchClient
from core.clients.milvus_client import get_milvus_client, MilvusClient, connect_milvus, create_milvus_collections
from core.clients.mistral_client import get_mistral_client, MistralClient

# Backwards compatible client instances
redis_client = get_redis_client().client
minio_client = get_minio_client().client
es_client = get_elasticsearch_client().client
mistral_client = get_mistral_client().client

# Milvus collections (lazy loaded)
embedding_collection = None
public_embedding_collection = None


def create_es_index():
    """Create Elasticsearch index."""
    return get_elasticsearch_client().ensure_index()


def ensure_minio_bucket():
    """Ensure MinIO bucket exists."""
    return get_minio_client().ensure_bucket()


def migrate_milvus_to_elasticsearch():
    """Migration utility - moved to core/clients/elasticsearch_client.py"""
    raise NotImplementedError(
        "Migration utility has been deprecated. "
        "Use ElasticsearchClient directly for migration needs."
    )


__all__ = [
    # Client instances (backwards compatibility)
    "redis_client",
    "minio_client", 
    "es_client",
    "mistral_client",
    "embedding_collection",
    "public_embedding_collection",
    # Functions
    "connect_milvus",
    "create_milvus_collections",
    "create_es_index",
    "ensure_minio_bucket",
    # New OOP getters
    "get_redis_client",
    "get_minio_client",
    "get_elasticsearch_client",
    "get_milvus_client",
    "get_mistral_client",
]
