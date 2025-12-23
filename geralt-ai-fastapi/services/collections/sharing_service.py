"""
Collection Sharing Service

Handles collection sharing and access control.
Extracted from collections_service.py for single responsibility.
"""
from typing import Dict, List, Optional

from models.database import collection_collection
from helpers.cache_invalidation import invalidate_collections_cache
from services.collections import BaseService, ServiceResult
from services.notifications import get_notification_service


class CollectionSharingService(BaseService):
    """
    Service for managing collection sharing.
    
    Responsibilities:
    - Share collections with users
    - Update shared user roles
    - Remove shared users
    """
    
    ALLOWED_ROLES = {"admin", "read-only", "contributor"}
    
    def __init__(self):
        super().__init__()
        self.db = collection_collection
    
    def list_shared_users(
        self,
        identity: str,
        collection_id: str
    ) -> ServiceResult:
        """
        List users a collection is shared with.
        
        Args:
            identity: Current user's identity
            collection_id: Collection ID
            
        Returns:
            ServiceResult with list of shared users
        """
        try:
            username = self.extract_username(identity)
            
            coll = self.db.find_one({"collection_id": collection_id})
            if not coll:
                return ServiceResult.fail("Collection not found", 404)
            
            # Check permission (Owner or shared user can see list?)
            # Usually owner or admin. Let's allow any member to see who else is in?
            is_owner = coll.get("created_by") == username
            shared_with = coll.get("shared_with", [])
            is_member = any(u["username"] == username for u in shared_with)
            
            if not is_owner and not is_member:
                return ServiceResult.fail("Access denied", 403)
                
            return ServiceResult.ok({"shared_users": shared_with})
            
        except Exception as e:
            self.logger.error(f"Error listing shared users: {e}")
            return ServiceResult.fail(str(e), 500)

    def share(
        self,
        identity: str,
        collection_id: str,
        shared_user: str,
        role: str = "read-only"
    ) -> ServiceResult:
        """
        Share a collection with another user.
        
        Args:
            identity: Current user's identity
            collection_id: Collection to share
            shared_user: Username to share with
            role: Role to assign
            
        Returns:
            ServiceResult with success/error
        """
        try:
            username = self.extract_username(identity)
            
            if role not in self.ALLOWED_ROLES:
                return ServiceResult.fail(
                    f"Invalid role. Must be one of: {', '.join(self.ALLOWED_ROLES)}",
                    400
                )
            
            coll = self.db.find_one({"collection_id": collection_id})
            if not coll:
                return ServiceResult.fail("Collection not found", 404)
            
            # Only owner can share
            if coll.get("created_by") != username:
                return ServiceResult.fail("Only the owner can share the collection.", 403)
            
            # Check if already shared
            shared_with = coll.get("shared_with", [])
            if any(u["username"].lower() == shared_user.lower() for u in shared_with):
                return ServiceResult.fail("User is already shared with this collection", 400)
            
            self.db.update_one(
                {"collection_id": collection_id},
                {"$push": {"shared_with": {"username": shared_user, "role": role}}}
            )
            
            invalidate_collections_cache(shared_user)
            self.log_operation("share_collection",
                               sharer=username,
                               collection_id=collection_id,
                               shared_with=shared_user,
                               role=role)
            
            # Send notification to shared user
            try:
                notification_service = get_notification_service()
                notification_service.collection_shared(
                    user_id=shared_user,
                    collection_name=coll.get("name", "Collection"),
                    shared_by=username
                )
            except Exception as ne:
                self.logger.warning(f"Failed to send share notification: {ne}")
            
            return ServiceResult.ok({
                "message": f"Collection shared with {shared_user} as {role}."
            })
            
        except Exception as e:
            self.logger.error(f"Error sharing collection: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def update_role(
        self,
        identity: str,
        collection_id: str,
        shared_user: str,
        new_role: str
    ) -> ServiceResult:
        """Update a shared user's role."""
        try:
            username = self.extract_username(identity)
            
            if new_role not in self.ALLOWED_ROLES:
                return ServiceResult.fail(
                    f"Invalid role. Must be one of: {', '.join(self.ALLOWED_ROLES)}",
                    400
                )
            
            coll = self.db.find_one({"collection_id": collection_id})
            if not coll:
                return ServiceResult.fail("Collection not found", 404)
            
            if coll.get("created_by") != username:
                return ServiceResult.fail("Only the owner can update roles.", 403)
            
            result = self.db.update_one(
                {
                    "collection_id": collection_id,
                    "shared_with.username": {"$regex": f"^{shared_user}$", "$options": "i"}
                },
                {"$set": {"shared_with.$.role": new_role}}
            )
            
            if result.modified_count == 0:
                return ServiceResult.fail("User not found in shared list.", 404)
            
            invalidate_collections_cache(shared_user)
            self.log_operation("update_collection_role",
                               updater=username,
                               collection_id=collection_id,
                               shared_user=shared_user,
                               new_role=new_role)
            
            return ServiceResult.ok({
                "message": f"Updated {shared_user}'s role to {new_role}."
            })
            
        except Exception as e:
            self.logger.error(f"Error updating role: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def remove_user(
        self,
        identity: str,
        collection_id: str,
        shared_user: str
    ) -> ServiceResult:
        """Remove a shared user from a collection."""
        try:
            username = self.extract_username(identity)
            
            coll = self.db.find_one({"collection_id": collection_id})
            if not coll:
                return ServiceResult.fail("Collection not found", 404)
            
            is_owner = coll.get("created_by") == username
            is_self = shared_user.lower() == username.lower()
            
            if not is_owner and not is_self:
                return ServiceResult.fail(
                    "Only the owner or the shared user can remove sharing.",
                    403
                )
            
            result = self.db.update_one(
                {"collection_id": collection_id},
                {"$pull": {"shared_with": {"username": {"$regex": f"^{shared_user}$", "$options": "i"}}}}
            )
            
            if result.modified_count == 0:
                return ServiceResult.fail("User not found in shared list.", 404)
            
            invalidate_collections_cache(shared_user)
            self.log_operation("remove_collection_user",
                               remover=username,
                               collection_id=collection_id,
                               removed_user=shared_user)
            
            return ServiceResult.ok({
                "message": f"Removed {shared_user} from collection sharing."
            })
            
        except Exception as e:
            self.logger.error(f"Error removing shared user: {e}")
            return ServiceResult.fail(str(e), 500)


# Singleton instance
_sharing_service_instance: Optional[CollectionSharingService] = None


def get_sharing_service() -> CollectionSharingService:
    """Get or create the collection sharing service singleton."""
    global _sharing_service_instance
    if _sharing_service_instance is None:
        _sharing_service_instance = CollectionSharingService()
    return _sharing_service_instance
