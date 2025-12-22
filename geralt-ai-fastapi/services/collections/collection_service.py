"""
Collection Service

Handles collection CRUD operations.
Extracted from collections_service.py for single responsibility.
"""
import logging
from datetime import datetime
from uuid import uuid4
from typing import Dict, List, Optional, Any

from models.database import (
    collection_collection,
    document_collection,
    tokens_collection,
    public_collection,
)
from helpers.cache_invalidation import invalidate_collections_cache
from helpers.utils import get_utility_service
from services.collections import BaseService, ServiceResult


class CollectionService(BaseService):
    """
    Service for managing collections.
    
    Responsibilities:
    - Create, list, delete collections
    - Handle public collections
    - Aggregate collection stats
    """
    
    def __init__(self):
        super().__init__()
        self.db = collection_collection
        self.documents_db = document_collection
        self.tokens_db = tokens_collection
        self.public_db = public_collection
    
    # =========================================================================
    # Private Collection Operations
    # =========================================================================
    
    def create(
        self,
        identity: str,
        collection_name: str,
        tenant_id: str,
        public: bool = False,
        jwt_data: Optional[Dict] = None
    ) -> ServiceResult:
        """
        Create a new private collection.
        
        Args:
            identity: User's email/identity
            collection_name: Name for the collection
            tenant_id: Tenant ID
            public: Whether collection is public
            jwt_data: JWT data with user info
            
        Returns:
            ServiceResult with collection_id
        """
        try:
            username = self.extract_username(identity)
            full_name = jwt_data.get("FullName", "") if jwt_data else ""
            
            if not tenant_id:
                return ServiceResult.fail("Tenant ID is required", 400)
            
            if not collection_name:
                return ServiceResult.fail("Collection name is required", 400)
            
            # Check for duplicates
            existing = self.db.find_one({
                "name": {"$regex": f"^{collection_name}$", "$options": "i"},
                "created_by": username,
                "tenant_id": tenant_id,
            })
            if existing:
                return ServiceResult.fail("A collection with the same name already exists", 400)
            
            collection_id = str(uuid4())
            collection_data = {
                "collection_id": collection_id,
                "name": collection_name,
                "public": public,
                "created_by": username,
                "created_at": datetime.utcnow().isoformat(),
                "full_name": full_name,
                "tenant_id": tenant_id,
            }
            
            self.db.insert_one(collection_data)
            invalidate_collections_cache(username)
            self.log_operation("create_collection", username=username, collection_id=collection_id)
            
            return ServiceResult.ok({
                "message": "Collection created successfully",
                "collection_id": collection_id,
            })
            
        except Exception as e:
            self.logger.error(f"Error creating collection: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def list(self, identity: str, tenant_id: str) -> ServiceResult:
        """
        List all collections owned or shared with the user.
        
        Args:
            identity: User's email/identity
            tenant_id: Tenant ID
            
        Returns:
            ServiceResult with list of collections
        """
        try:
            username = self.extract_username(identity)
            filter_deleted = {"deleted": {"$ne": True}}
            
            # Owned collections
            user_collections = list(self.db.find({
                "created_by": username,
                "tenant_id": tenant_id,
                **filter_deleted,
            }))
            
            # Shared collections
            shared_collections = list(self.db.find({
                "shared_with.username": username,
                "tenant_id": tenant_id,
                **filter_deleted,
            }))
            
            result = []
            
            for coll in user_collections:
                result.append(self._process_collection(coll, username, tenant_id, is_owner=True))
            
            for coll in shared_collections:
                result.append(self._process_collection(coll, username, tenant_id, is_owner=False))
            
            return ServiceResult.ok(result)
            
        except Exception as e:
            self.logger.error(f"Error listing collections: {e}")
            return ServiceResult.fail("Error fetching collections", 500)
    
    def get(self, identity: str, collection_id: str) -> ServiceResult:
        """
        Get a single collection by ID.
        
        Args:
            identity: User's email/identity
            collection_id: Collection ID
            
        Returns:
            ServiceResult with collection details
        """
        try:
            username = self.extract_username(identity)
            
            coll = self.db.find_one({"collection_id": collection_id})
            if not coll:
                return ServiceResult.fail("Collection not found", 404)
            
            # Check permission
            is_owner = coll["created_by"] == username
            shared_with = coll.get("shared_with", [])
            is_shared = any(u["username"] == username for u in shared_with)
            
            if not is_owner and not is_shared:
                return ServiceResult.fail("Access denied", 403)
                
            result = self._process_collection(coll, username, coll["tenant_id"], is_owner=is_owner)
            return ServiceResult.ok(result)
            
        except Exception as e:
            self.logger.error(f"Error getting collection: {e}")
            return ServiceResult.fail(str(e), 500)

    def update(
        self,
        identity: str,
        collection_id: str,
        new_name: str,
        tenant_id: str
    ) -> ServiceResult:
        """Update collection name."""
        try:
            username = self.extract_username(identity)
            
            # Find collection
            coll = self.db.find_one({"collection_id": collection_id})
            if not coll:
                return ServiceResult.fail("Collection not found", 404)
                
            # Permission check: Owner or admin
            if coll["created_by"] != username:
                # Check shared
                shared = next((u for u in coll.get("shared_with", []) if u["username"] == username), None)
                if not shared or shared.get("role") != "admin":
                     return ServiceResult.fail("Access denied", 403)
            
            # Check duplicates
            if new_name != coll["name"]:
                existing = self.db.find_one({
                    "name": {"$regex": f"^{new_name}$", "$options": "i"},
                    "created_by": coll["created_by"], # Scope to owner
                    "tenant_id": tenant_id,
                    "collection_id": {"$ne": collection_id}
                })
                if existing:
                    return ServiceResult.fail("Collection name already exists", 409)
            
            self.db.update_one(
                {"collection_id": collection_id},
                {"$set": {"name": new_name}}
            )
            
            invalidate_collections_cache(username)
            self.log_operation("update_collection", username=username, collection_id=collection_id)
            
            return ServiceResult.ok({"message": "Collection updated successfully"})
            
        except Exception as e:
            self.logger.error(f"Error updating collection: {e}")
            return ServiceResult.fail(str(e), 500)

    def delete(self, identity: str, collection_id: str) -> ServiceResult:
        """
        Delete a collection or remove user's access.
        
        Args:
            identity: User's email/identity
            collection_id: Collection to delete
            
        Returns:
            ServiceResult with success/error
        """
        try:
            username = self.extract_username(identity)
            
            coll = self.db.find_one({"collection_id": collection_id})
            if not coll:
                return ServiceResult.fail("Collection not found", 404)
            
            if coll.get("created_by") == username:
                # Owner deletes entire collection
                self.db.delete_one({"collection_id": collection_id})
                invalidate_collections_cache(username)
                self.log_operation("delete_collection", username=username, collection_id=collection_id)
                return ServiceResult.ok({"message": "Collection deleted"})
            else:
                # Remove user's access
                shared_with = coll.get("shared_with", [])
                if any(u["username"] == username for u in shared_with):
                    self.db.update_one(
                        {"collection_id": collection_id},
                        {"$pull": {"shared_with": {"username": username}}}
                    )
                    return ServiceResult.ok({"message": "Removed access to the collection"})
                else:
                    return ServiceResult.fail("Not found or no permission", 404)
                    
        except Exception as e:
            self.logger.error(f"Error deleting collection: {e}")
            return ServiceResult.fail(str(e), 500)
    
    # =========================================================================
    # Public Collection Operations
    # =========================================================================
    
    def create_public(
        self,
        identity: str,
        collection_name: str,
        jwt_data: Optional[Dict] = None
    ) -> ServiceResult:
        """Create a new public collection."""
        try:
            if not collection_name:
                return ServiceResult.fail("Collection name is required", 400)
            
            existing = self.public_db.find_one({
                "name": {"$regex": f"^{collection_name}$", "$options": "i"},
                "public": True,
            })
            if existing:
                return ServiceResult.fail("A public collection with the same name already exists", 400)
            
            collection_id = str(uuid4())
            pub_data = {
                "collection_id": collection_id,
                "name": collection_name,
                "public": True,
                "created_by": identity,
                "created_at": datetime.utcnow().isoformat(),
            }
            
            self.public_db.insert_one(pub_data)
            invalidate_collections_cache("public")
            
            return ServiceResult.ok({
                "message": "Public collection created successfully",
                "collection_id": collection_id,
            })
            
        except Exception as e:
            self.logger.error(f"Error creating public collection: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def list_public(self, identity: str) -> ServiceResult:
        """List all public collections."""
        try:
            pub_cursor = self.public_db.find({"public": True})
            result = [
                {
                    "collection_id": pcoll["collection_id"],
                    "name": pcoll.get("name"),
                    "created_by": pcoll.get("created_by"),
                    "created_at": pcoll.get("created_at"),
                }
                for pcoll in pub_cursor
            ]
            
            if not result:
                return ServiceResult.fail("No public collections found", 404)
            
            return ServiceResult.ok(result)
            
        except Exception as e:
            self.logger.error(f"Error listing public collections: {e}")
            return ServiceResult.fail("Internal Server Error", 500)
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    def _process_collection(
        self,
        coll_data: Dict,
        username: str,
        tenant_id: str,
        is_owner: bool = False
    ) -> Dict:
        """Process a collection for API response."""
        cid = coll_data["collection_id"]
        doc_count, file_types = self._aggregate_doc_counts(cid)
        bot_count, bots_info = self._get_bots_for_collection(cid, tenant_id)
        
        shared_with = coll_data.get("shared_with", [])
        user_role = None
        if not is_owner:
            shared_user = next((u for u in shared_with if u["username"] == username), {})
            user_role = shared_user.get("role", "read-only")
        
        return {
            "collection_id": cid,
            "collection_name": coll_data["name"],
            "public": coll_data.get("public", False),
            "created_by": coll_data["created_by"],
            "created_at": coll_data.get("created_at"),
            "document_count": doc_count,
            "file_types": file_types,
            "shared_with": shared_with,
            "is_owner": is_owner,
            "user_role": None if is_owner else user_role,
            "bots": bots_info,
            "bot_count": bot_count,
            "full_name": coll_data.get("full_name", ""),
        }
    
    def _aggregate_doc_counts(self, collection_id: str) -> tuple:
        """Aggregate document and file type counts."""
        try:
            docs_cursor = self.documents_db.aggregate([
                {"$match": {"collection_id": collection_id}},
                {"$group": {"_id": "$file_name", "file_name": {"$first": "$file_name"}}}
            ])
            distinct_docs = list(docs_cursor)
            doc_count = len(distinct_docs)
            
            file_type_counts = {}
            for dd in distinct_docs:
                fname = dd.get("file_name", "")
                if fname:
                    ext = fname.split(".")[-1].lower()
                    ftype = get_utility_service().get_resource_type(ext)
                    file_type_counts[ftype] = file_type_counts.get(ftype, 0) + 1
            
            return doc_count, file_type_counts
        except Exception as e:
            logging.error(f"Error in doc aggregation: {e}")
            return 0, {}
    
    def _get_bots_for_collection(self, collection_id: str, tenant_id: str) -> tuple:
        """Get bots using this collection."""
        bot_count = self.tokens_db.count_documents({
            "collection_ids": collection_id,
            "tenant_id": tenant_id
        })
        
        bot_info = []
        if bot_count > 0:
            tokens = self.tokens_db.find({
                "collection_ids": collection_id,
                "tenant_id": tenant_id
            })
            for t in tokens:
                bot_info.append({
                    "bot_name": t["bot_name"],
                    "bot_token": t["bot_token"],
                    "bot_id": str(t["_id"]),
                })
        
        return bot_count, bot_info


# Singleton instance
_collection_service_instance: Optional[CollectionService] = None


def get_collection_service() -> CollectionService:
    """Get or create the collection service singleton."""
    global _collection_service_instance
    if _collection_service_instance is None:
        _collection_service_instance = CollectionService()
    return _collection_service_instance
