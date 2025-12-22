"""
Elasticsearch Client

Provides Elasticsearch connection with OOP wrapper.
"""
import logging
from typing import Optional, Dict, Any

from elasticsearch import Elasticsearch

from config import Config


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
        self._client = Elasticsearch(hosts=[Config.ELASTICSEARCH_URL])
        self.index_name = Config.ELASTIC_INDEX
        self.embedding_dim = Config.EMBEDDING_DIM
        self.logger.info(f"Elasticsearch connected to {Config.ELASTICSEARCH_URL}")
    
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
    
    def ping(self) -> bool:
        """Check connection to Elasticsearch."""
        try:
            return self._client.ping()
        except Exception as e:
            self.logger.error(f"Elasticsearch ping failed: {e}")
            return False
    
    def ensure_index(self, index_name: str = None) -> bool:
        """
        Create or verify the documents index.
        Returns True if index was created, False if existed.
        """
        index = index_name or self.index_name
        
        if self._client.indices.exists(index=index):
            mapping = self._client.indices.get_mapping(index=index)
            props = mapping[index]["mappings"]["properties"]
            
            if "embedding" in props and props["embedding"]["type"] == "dense_vector":
                current_dims = props["embedding"]["dims"]
                if current_dims == self.embedding_dim:
                    self.logger.info(f"Index '{index}' exists with correct dims={current_dims}")
                    return False
                else:
                    self.logger.warning(f"Index '{index}' has dims={current_dims}, need {self.embedding_dim}. Recreating.")
                    self._client.indices.delete(index=index)
            else:
                self.logger.warning(f"Index '{index}' missing embedding field. Recreating.")
                self._client.indices.delete(index=index)
        
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
                }
            }
        }
        self._client.indices.create(index=index, body=body)
        self.logger.info(f"Created index '{index}' with dims={self.embedding_dim}")
        return True
    
    def index_document(self, doc: Dict[str, Any], index: str = None):
        """Index a document."""
        return self._client.index(index=index or self.index_name, body=doc)
    
    def search(self, query: Dict[str, Any], index: str = None):
        """Execute search query."""
        return self._client.search(index=index or self.index_name, body=query)
    
    def delete_by_query(self, query: Dict[str, Any], index: str = None):
        """Delete documents matching query."""
        return self._client.delete_by_query(
            index=index or self.index_name,
            body=query,
            refresh=True
        )
    
    def __getattr__(self, name):
        """Proxy other methods to underlying client."""
        return getattr(self._client, name)


# Singleton access
_es_client_instance: Optional[ElasticsearchClient] = None


def get_elasticsearch_client() -> ElasticsearchClient:
    """Get or create the Elasticsearch client singleton."""
    global _es_client_instance
    if _es_client_instance is None:
        _es_client_instance = ElasticsearchClient()
    return _es_client_instance


# Backwards compatibility
es_client = None


def init_elasticsearch():
    """Initialize Elasticsearch client for backwards compatibility."""
    global es_client
    es_client = get_elasticsearch_client().client
    return es_client
