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
        self.user = Config.MILVUS_USER
        self.password = Config.MILVUS_PASSWORD
        self.token = Config.MILVUS_TOKEN
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
            connect_args = {
                "host": self.host, 
                "port": self.port
            }
            if self.user and self.password:
                connect_args["user"] = self.user
                connect_args["password"] = self.password
            if self.token:
                connect_args["token"] = self.token
                
            connections.connect(**connect_args)
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
        
        # Schema Definition (Milvus 2.6+ Optimized)
        schema = CollectionSchema(
            fields=[
                FieldSchema(name="id", dtype=DataType.INT64, is_primary=True),
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=self.embedding_dim),
                # Optimization: Use JSON type for rich metadata filtering
                FieldSchema(name="metadata", dtype=DataType.JSON, nullable=True),
            ],
            description=description,
            enable_dynamic_field=True # Optimization: Enable dynamic schema
        )
        
        collection = Collection(name, schema=schema)
        
        # Create Index for Vector Field
        index_params = {
            "metric_type": "COSINE",
            "index_type": "HNSW",
            "params": {"M": 16, "efConstruction": 200}
        }
        collection.create_index(field_name="embedding", index_params=index_params)
        
        # Optimization: Create Scalar Index for JSON metadata (Generic Inverted Index)
        # Note: Milvus 2.6 automatically indexes JSON paths if configured, 
        # but a general index on the field helps.
        try:
             collection.create_index(field_name="metadata", index_name="metadata_index")
        except:
             pass # Might fail if empty or specific index type needed, usually auto-handled
             
        self.logger.info(f"Created Milvus collection: {name} (JSON+Dynamic Enabled)")
        return collection
    
    def insert(self, collection_name: str, data: List) -> dict:
        """Insert vectors into collection."""
        collection = self._get_or_create_collection(collection_name, "")
        return collection.insert(data)
    
    def search(self, collection_name: str, vectors: List, limit: int = 10, **kwargs):
        """Search vectors in collection."""
        collection = self._get_or_create_collection(collection_name, "")
        collection.load()
        
        search_params = {
            "metric_type": "COSINE", 
            "params": {"nprobe": 10}
        }
        
        return collection.search(
            data=vectors, 
            anns_field="embedding", 
            param=search_params, 
            limit=limit, 
            **kwargs
        )
    
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
