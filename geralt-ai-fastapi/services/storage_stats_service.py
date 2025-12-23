"""
Storage Stats Service

Provides storage and vector database statistics with role-based limits.
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from config import Config
from models.database import document_collection


# Storage limits by role (in bytes)
STORAGE_LIMITS = {
    "admin": 50 * 1024 * 1024 * 1024,  # 50 GB for admins
    "user": 1 * 1024 * 1024 * 1024,    # 1 GB for regular users
    "default": 1 * 1024 * 1024 * 1024,  # 1 GB default
}


class StorageStatsService:
    """
    Service for aggregating storage and vector statistics.
    
    Provides:
    - MinIO storage usage
    - Vector index statistics
    - Document counts by type
    - Role-based storage limits
    """
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def get_stats(
        self, 
        tenant_id: str, 
        identity: str,
        jwt_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Get storage statistics for a tenant/user.
        
        Args:
            tenant_id: Tenant ID
            identity: User identity (username)
            jwt_data: JWT claims containing user role
        
        Returns:
            Dict with storage, vector, and document stats
        """
        try:
            # Determine user role from JWT claims
            user_role = self._get_user_role(jwt_data)
            is_admin = user_role == "admin"
            
            # Get document stats from MongoDB
            doc_stats = self._get_document_stats(tenant_id, identity, is_admin)
            
            # Get storage stats (file sizes) with role-based limits
            storage_stats = self._get_storage_stats(tenant_id, identity, user_role, is_admin)
            
            # Get vector index stats
            vector_stats = self._get_vector_stats()
            
            return {
                "success": True,
                "data": {
                    "storage": storage_stats,
                    "vectors": vector_stats,
                    "documents": doc_stats,
                    "user_role": user_role,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        except Exception as e:
            self.logger.error(f"Failed to get storage stats: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _get_user_role(self, jwt_data: Optional[Dict]) -> str:
        """Extract user role from JWT claims."""
        if not jwt_data:
            return "default"
        
        # Check various possible role field names
        role = jwt_data.get("role") or jwt_data.get("Role") or jwt_data.get("user_role")
        
        if role and role.lower() == "admin":
            return "admin"
        
        return "user"
    
    def _get_document_stats(
        self, 
        tenant_id: str, 
        identity: str,
        is_admin: bool
    ) -> Dict[str, Any]:
        """Aggregate document counts by type and status."""
        # Admin sees all documents in tenant, user sees only their own
        if is_admin:
            match_query = {"tenant_id": tenant_id}
        else:
            match_query = {"added_by": identity}
        
        pipeline = [
            {"$match": match_query},
            {
                "$group": {
                    "_id": None,
                    "total_documents": {"$sum": 1},
                    "processed_documents": {
                        "$sum": {"$cond": [{"$eq": ["$processed", True]}, 1, 0]}
                    },
                    "pending_documents": {
                        "$sum": {"$cond": [{"$eq": ["$processed", False]}, 1, 0]}
                    },
                    "by_type": {
                        "$push": "$resource_type"
                    }
                }
            }
        ]
        
        try:
            result = list(document_collection.aggregate(pipeline))
            if result:
                data = result[0]
                # Count document types
                type_counts = {}
                for doc_type in data.get("by_type", []):
                    if doc_type:
                        type_counts[doc_type] = type_counts.get(doc_type, 0) + 1
                
                return {
                    "total": data.get("total_documents", 0),
                    "processed": data.get("processed_documents", 0),
                    "pending": data.get("pending_documents", 0),
                    "by_type": type_counts
                }
        except Exception as e:
            self.logger.error(f"Failed to get document stats: {e}")
        
        return {"total": 0, "processed": 0, "pending": 0, "by_type": {}}
    
    def _get_storage_stats(
        self, 
        tenant_id: str, 
        identity: str, 
        user_role: str,
        is_admin: bool
    ) -> Dict[str, Any]:
        """Calculate storage usage from document file sizes with role-based limits."""
        # Admin sees all storage in tenant, user sees only their own
        if is_admin:
            match_query = {"tenant_id": tenant_id}
        else:
            match_query = {"added_by": identity}
        
        pipeline = [
            {"$match": match_query},
            {
                "$group": {
                    "_id": None,
                    "total_size_bytes": {
                        "$sum": {"$toDouble": {"$ifNull": ["$file_size", "0"]}}
                    },
                    "file_count": {"$sum": 1}
                }
            }
        ]
        
        # Get storage limit based on role
        limit_bytes = STORAGE_LIMITS.get(user_role, STORAGE_LIMITS["default"])
        
        try:
            result = list(document_collection.aggregate(pipeline))
            if result:
                data = result[0]
                total_bytes = data.get("total_size_bytes", 0)
                
                # Calculate percentage (cap at 100%)
                usage_percent = min(round((total_bytes / limit_bytes) * 100, 2), 100.0)
                
                return {
                    "used_bytes": int(total_bytes),
                    "used_formatted": self._format_bytes(total_bytes),
                    "limit_bytes": limit_bytes,
                    "limit_formatted": self._format_bytes(limit_bytes),
                    "usage_percent": usage_percent,
                    "file_count": data.get("file_count", 0),
                    "is_over_limit": total_bytes >= limit_bytes
                }
        except Exception as e:
            self.logger.error(f"Failed to get storage stats: {e}")
        
        return {
            "used_bytes": 0,
            "used_formatted": "0 B",
            "limit_bytes": limit_bytes,
            "limit_formatted": self._format_bytes(limit_bytes),
            "usage_percent": 0,
            "file_count": 0,
            "is_over_limit": False
        }
    
    def _get_vector_stats(self) -> Dict[str, Any]:
        """Get vector database statistics from Elasticsearch and Milvus."""
        total_vectors = 0
        collections_info = []
        index_status = "unavailable"
        
        # Try Elasticsearch first (primary vector store)
        try:
            from core.clients.elasticsearch_client import get_elasticsearch_client
            
            es_client = get_elasticsearch_client()
            if es_client and es_client.client:
                # Count documents in embedding index
                try:
                    result = es_client.client.count(index="embeddings")
                    es_count = result.get("count", 0)
                    if es_count > 0:
                        total_vectors += es_count
                        collections_info.append({
                            "name": "elasticsearch_embeddings",
                            "count": es_count
                        })
                        index_status = "active"
                except Exception:
                    # Try alternative index names
                    for idx_name in ["embedding_index", "geralt_embeddings", "documents"]:
                        try:
                            result = es_client.client.count(index=idx_name)
                            es_count = result.get("count", 0)
                            if es_count > 0:
                                total_vectors += es_count
                                collections_info.append({
                                    "name": f"es_{idx_name}",
                                    "count": es_count
                                })
                                index_status = "active"
                                break
                        except Exception:
                            pass
        except Exception as e:
            self.logger.warning(f"Could not get Elasticsearch vector stats: {e}")
        
        # Try Milvus as secondary vector store
        try:
            from pymilvus import utility
            from core.clients.milvus_client import get_milvus_client
            
            client = get_milvus_client()
            client.connect()
            
            # Suppress pymilvus internal error logging to prevent console spam
            import logging as pymilvus_logging
            pymilvus_logger = pymilvus_logging.getLogger("pymilvus")
            original_level = pymilvus_logger.level
            pymilvus_logger.setLevel(pymilvus_logging.CRITICAL)
            
            try:
                for collection_name in ["embedding_collection", "public_embedding_collection"]:
                    try:
                        if utility.has_collection(collection_name):
                            from pymilvus import Collection, MilvusException
                            coll = Collection(collection_name)
                            try:
                                # Only attempt to load if we think there's data, but explicit load is needed for num_entities accuracy?
                                # Actually, num_entities might be available without load if we just want count?
                                # No, usually need load for searching, but query count might work.
                                # However, 'coll.num_entities' property often needs recent flush or load.
                                # Safest is to try load, and catch the index not found error.
                                coll.load()
                                num_entities = coll.num_entities
                                if num_entities > 0:
                                    total_vectors += num_entities
                                    collections_info.append({
                                        "name": f"milvus_{collection_name}",
                                        "count": num_entities
                                    })
                                    index_status = "active"
                            except MilvusException as me:
                                 # Ignore index not found, treated as empty/inactive
                                 if me.code == 700 or "index not found" in me.message:
                                     pass
                                 else:
                                     raise me
                    except Exception:
                        pass
            finally:
                # Restore original log level
                pymilvus_logger.setLevel(original_level)
        except Exception as e:
            self.logger.warning(f"Could not get Milvus vector stats: {e}")
        
        return {
            "total_vectors": total_vectors,
            "total_formatted": self._format_number(total_vectors),
            "collections": collections_info,
            "index_status": index_status
        }
    
    def _get_minio_storage_stats(self) -> Dict[str, Any]:
        """Get MinIO storage statistics (optional, for admin overview)."""
        try:
            from core.clients.minio_client import get_minio_client
            
            client = get_minio_client()
            bucket_name = client.bucket_name
            
            # List all objects in bucket and sum sizes
            total_size = 0
            object_count = 0
            
            objects = client.client.list_objects(bucket_name, recursive=True)
            for obj in objects:
                total_size += obj.size
                object_count += 1
            
            return {
                "bucket_name": bucket_name,
                "total_size_bytes": total_size,
                "total_size_formatted": self._format_bytes(total_size),
                "object_count": object_count,
                "status": "connected"
            }
        except Exception as e:
            self.logger.warning(f"Could not get MinIO stats: {e}")
            return {
                "bucket_name": "unknown",
                "total_size_bytes": 0,
                "total_size_formatted": "0 B",
                "object_count": 0,
                "status": "unavailable"
            }
    
    def _format_bytes(self, bytes_val: float) -> str:
        """Format bytes to human readable string."""
        if bytes_val < 1024:
            return f"{int(bytes_val)} B"
        elif bytes_val < 1024 * 1024:
            return f"{bytes_val / 1024:.1f} KB"
        elif bytes_val < 1024 * 1024 * 1024:
            return f"{bytes_val / (1024 * 1024):.1f} MB"
        else:
            return f"{bytes_val / (1024 * 1024 * 1024):.2f} GB"
    
    def _format_number(self, num: int) -> str:
        """Format number with K/M suffix."""
        if num < 1000:
            return str(num)
        elif num < 1000000:
            return f"{num / 1000:.1f}K"
        else:
            return f"{num / 1000000:.1f}M"


# Singleton
_storage_stats_service: Optional[StorageStatsService] = None


def get_storage_stats_service() -> StorageStatsService:
    """Get or create storage stats service singleton."""
    global _storage_stats_service
    if _storage_stats_service is None:
        _storage_stats_service = StorageStatsService()
    return _storage_stats_service
