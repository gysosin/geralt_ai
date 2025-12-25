"""
Elasticsearch Client

Provides Elasticsearch connection with OOP wrapper.
Supports both async (FastAPI) and sync (Celery) usage.
"""
import logging
from typing import Optional, Dict, Any
import inspect

from elasticsearch import AsyncElasticsearch, Elasticsearch

from config import Config

logger = logging.getLogger(__name__)


class ElasticsearchClient:
    """
    Elasticsearch client wrapper with connection and index management.
    
    Provides:
    - Index creation and management
    - Document operations
    - Search functionality
    """
    
    _instance: Optional["ElasticsearchClient"] = None
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self._client = AsyncElasticsearch(hosts=[Config.ELASTICSEARCH_URL])
        self.index_name = Config.ELASTIC_INDEX
        self.embedding_dim = Config.EMBEDDING_DIM
        self.logger.info(f"Elasticsearch (Async) connected to {Config.ELASTICSEARCH_URL}")
    
    @classmethod
    def get_instance(cls) -> "ElasticsearchClient":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @property
    def client(self):
        """Get raw Elasticsearch client."""
        return self._client
    
    async def ping(self) -> bool:
        """Check connection to Elasticsearch."""
        try:
            return await self._client.ping()
        except Exception as e:
            self.logger.error(f"Elasticsearch ping failed: {e}")
            return False
    
    async def ensure_index(self, index_name: str = None) -> bool:
        """
        Create or verify the documents index.
        Returns True if index was created, False if existed.
        """
        index = index_name or self.index_name
        
        if await self._client.indices.exists(index=index):
            mapping = await self._client.indices.get_mapping(index=index)
            props = mapping[index]["mappings"]["properties"]
            
            # For hierarchical RRF, embedding might be optional on parent, 
            # but we keep the mapping for compatibility if needed.
            if "embedding" in props and props["embedding"]["type"] == "dense_vector":
                current_dims = props["embedding"].get("dims", 0)
                if current_dims == self.embedding_dim:
                    self.logger.info(f"Index '{index}' exists with correct dims={current_dims}")
                    return False
                else:
                    self.logger.warning(f"Index '{index}' has dims={current_dims}, need {self.embedding_dim}. Recreating.")
                    await self._client.indices.delete(index=index)
            else:
                # If we are strictly using RRF Hierarchical, we might not NEED dense_vector here,
                # but to avoid breaking other things, let's keep it but make it flexible.
                # If it exists but isn't dense_vector, we might want to keep it if it has other fields.
                # However, for consistency, let's ensure it has our required fields.
                pass
        
        # Create fresh index if it doesn't exist (deleted above if mismatch)
        if not await self._client.indices.exists(index=index):
            body = {
                "mappings": {
                    "properties": {
                        "document_id": {"type": "keyword"},
                        "content": {"type": "text"},
                        "metadata": {"type": "keyword"},
                        "embedding": {"type": "dense_vector", "dims": self.embedding_dim},
                        "chunk_id": {"type": "keyword"},
                        "collection_id": {"type": "keyword"},
                        "chunk_type": {"type": "keyword"}, # added for hierarchical
                        "parent_chunk_id": {"type": "keyword"}, # added for hierarchical
                    }
                }
            }
            await self._client.indices.create(index=index, body=body)
            self.logger.info(f"Created index '{index}' with hierarchical support")
            return True
        return False
    
    async def index_document(self, doc: Dict[str, Any], index: str = None):
        """Index a document."""
        return await self._client.index(index=index or self.index_name, body=doc)
    
    async def search(self, query: Dict[str, Any], index: str = None):
        """Execute search query."""
        return await self._client.search(index=index or self.index_name, body=query)
    
    async def delete_by_query(self, query: Dict[str, Any], index: str = None):
        """Delete documents matching query."""
        return await self._client.delete_by_query(
            index=index or self.index_name,
            body=query,
            refresh=True
        )
    
    def __getattr__(self, name):
        """Proxy other methods to underlying client."""
        return getattr(self._client, name)


# =============================================================================
# Synchronous Client for Celery Tasks
# =============================================================================

class SyncElasticsearchClient:
    """
    Synchronous Elasticsearch client for use in Celery background tasks.
    
    Celery tasks cannot use async/await directly, so this provides
    a synchronous interface to Elasticsearch.
    """
    
    _instance: Optional["SyncElasticsearchClient"] = None
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self._client = Elasticsearch(hosts=[Config.ELASTICSEARCH_URL])
        self.index_name = Config.ELASTIC_INDEX
        self.embedding_dim = Config.EMBEDDING_DIM
        self.logger.info(f"Elasticsearch (Sync) connected to {Config.ELASTICSEARCH_URL}")
    
    @classmethod
    def get_instance(cls) -> "SyncElasticsearchClient":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @property
    def client(self):
        """Get raw Elasticsearch client."""
        return self._client
    
    def ping(self) -> bool:
        """Check connection to Elasticsearch."""
        try:
            return self._client.ping()
        except Exception as e:
            self.logger.error(f"Elasticsearch ping failed: {e}")
            return False
    
    def ensure_index(self, index_name: str = None) -> bool:
        """
        Create or verify the documents index (sync version).
        Returns True if index was created, False if existed.
        """
        index = index_name or self.index_name
        
        if self._client.indices.exists(index=index):
            self.logger.info(f"Index '{index}' exists")
            return False
        
        # Create fresh index
        body = {
            "mappings": {
                "properties": {
                    "document_id": {"type": "keyword"},
                    "content": {"type": "text"},
                    "metadata": {"type": "keyword"},
                    "embedding": {"type": "dense_vector", "dims": self.embedding_dim},
                    "chunk_id": {"type": "keyword"},
                    "collection_id": {"type": "keyword"},
                    "chunk_type": {"type": "keyword"},
                    "parent_chunk_id": {"type": "keyword"},
                }
            }
        }
        self._client.indices.create(index=index, body=body)
        self.logger.info(f"Created index '{index}' with hierarchical support")
        return True
    
    def index_document(self, doc: Dict[str, Any], index: str = None):
        """Index a document (sync)."""
        return self._client.index(index=index or self.index_name, body=doc)
    
    def search(self, query: Dict[str, Any], index: str = None):
        """Execute search query (sync)."""
        return self._client.search(index=index or self.index_name, body=query)
    
    def delete_by_query(self, query: Dict[str, Any], index: str = None):
        """Delete documents matching query (sync)."""
        return self._client.delete_by_query(
            index=index or self.index_name,
            body=query,
            refresh=True
        )


# =============================================================================
# Singleton Access
# =============================================================================

_es_client_instance: Optional[ElasticsearchClient] = None
_sync_es_client_instance: Optional[SyncElasticsearchClient] = None


def get_elasticsearch_client() -> ElasticsearchClient:
    """Get or create the async Elasticsearch client singleton."""
    global _es_client_instance
    if _es_client_instance is None:
        _es_client_instance = ElasticsearchClient()
    return _es_client_instance


def get_sync_elasticsearch_client() -> SyncElasticsearchClient:
    """Get or create the sync Elasticsearch client singleton for Celery tasks."""
    global _sync_es_client_instance
    if _sync_es_client_instance is None:
        _sync_es_client_instance = SyncElasticsearchClient()
    return _sync_es_client_instance


# Backwards compatibility (async client)
es_client = None


async def init_elasticsearch():
    """Initialize Elasticsearch client for backwards compatibility."""
    global es_client
    es_client = get_elasticsearch_client().client
    return es_client