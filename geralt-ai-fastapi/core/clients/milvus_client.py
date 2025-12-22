"""
Milvus Client

Provides Milvus vector database connection with OOP wrapper.
"""
import logging
from typing import Optional, List

from pymilvus import (
    connections,
    Collection,
    FieldSchema,
    CollectionSchema,
    DataType,
    utility,
)

from config import Config


class MilvusClient:
    """
    Milvus client wrapper with collection management.
    
    Provides:
    - Connection management
    - Collection creation
    - Vector operations
    """
    
    _instance: Optional["MilvusClient"] = None
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.host = Config.MILVUS_HOST
        self.port = Config.MILVUS_PORT
        self.embedding_dim = Config.EMBEDDING_DIM
        self._connected = False
        self._embedding_collection = None
        self._public_embedding_collection = None
    
    @classmethod
    def get_instance(cls) -> "MilvusClient":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def connect(self) -> bool:
        """Establish connection to Milvus."""
        if not self._connected:
            connections.connect(host=self.host, port=self.port)
            self._connected = True
            self.logger.info(f"Milvus connected to {self.host}:{self.port}")
        return self._connected
    
    @property
    def embedding_collection(self) -> Collection:
        """Get or create embedding collection."""
        if self._embedding_collection is None:
            self.connect()
            self._embedding_collection = self._get_or_create_collection(
                "embedding_collection",
                "Stores user embeddings"
            )
        return self._embedding_collection
    
    @property
    def public_embedding_collection(self) -> Collection:
        """Get or create public embedding collection."""
        if self._public_embedding_collection is None:
            self.connect()
            self._public_embedding_collection = self._get_or_create_collection(
                "public_embedding_collection",
                "Stores public embeddings"
            )
        return self._public_embedding_collection
    
    def _get_or_create_collection(self, name: str, description: str) -> Collection:
        """Get or create a Milvus collection."""
        if utility.has_collection(name):
            return Collection(name)
        
        schema = CollectionSchema(
            fields=[
                FieldSchema(name="id", dtype=DataType.INT64, is_primary=True),
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=self.embedding_dim),
                FieldSchema(name="metadata", dtype=DataType.VARCHAR, max_length=2048),
            ],
            description=description,
        )
        collection = Collection(name, schema=schema)
        self.logger.info(f"Created Milvus collection: {name}")
        return collection
    
    def insert(self, collection_name: str, data: List) -> dict:
        """Insert vectors into collection."""
        collection = self._get_or_create_collection(collection_name, "")
        return collection.insert(data)
    
    def search(self, collection_name: str, vectors: List, limit: int = 10, **kwargs):
        """Search vectors in collection."""
        collection = self._get_or_create_collection(collection_name, "")
        collection.load()
        return collection.search(vectors, **kwargs)
    
    def query(self, collection_name: str, expr: str = None, output_fields: List[str] = None):
        """Query collection."""
        collection = self._get_or_create_collection(collection_name, "")
        collection.load()
        return collection.query(expr=expr, output_fields=output_fields)


# Singleton access
_milvus_client_instance: Optional[MilvusClient] = None


def get_milvus_client() -> MilvusClient:
    """Get or create the Milvus client singleton."""
    global _milvus_client_instance
    if _milvus_client_instance is None:
        _milvus_client_instance = MilvusClient()
    return _milvus_client_instance


# Backwards compatibility
def connect_milvus():
    """Connect to Milvus."""
    return get_milvus_client().connect()


def create_milvus_collections():
    """Create Milvus collections."""
    client = get_milvus_client()
    return client.embedding_collection, client.public_embedding_collection
