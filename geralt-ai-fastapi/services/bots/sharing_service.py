"""
Bot Sharing Service

Handles bot sharing, role management, and access control.
Extracted from bot_management_service.py for single responsibility.
"""
from typing import Dict, List, Optional

from models.database import tokens_collection
from services.bots import BaseService, ServiceResult


class BotSharingService(BaseService):
    """
    Service for managing bot sharing and user roles.
    
    Responsibilities:
    - Share bots with other users
    - Update shared user roles
    - Remove shared users
    - View shared users list
    """
    
    ALLOWED_ROLES = {"admin", "read-only", "contributor"}
    
    def __init__(self):
        super().__init__()
        self.db = tokens_collection
    
    def share_bot(
        self,
        identity: str,
        bot_token: str,
        shared_user: str,
        role: str = "read-only"
    ) -> ServiceResult:
        """
        Share a bot with another user.
        
        Args:
            identity: Current user's identity
            bot_token: Bot to share
            shared_user: Username to share with
            role: Role to assign (admin, read-only, contributor)
            
        Returns:
            ServiceResult with success/error
        """
        try:
            if role not in self.ALLOWED_ROLES:
                return ServiceResult.fail(
                    f"Invalid role. Must be one of: {', '.join(self.ALLOWED_ROLES)}", 
                    400
                )
            
            username = self.extract_username(identity)
            bot = self.db.find_one({"bot_token": bot_token})
            
            if not bot:
                return ServiceResult.fail("Bot not found or access denied", 404)
            
            # Check if already shared
            shared_with = bot.get("shared_with", [])
            if any(u["username"].lower() == shared_user.lower() for u in shared_with):
                return ServiceResult.fail("User is already shared with this bot", 400)
            
            result = self.db.update_one(
                {"bot_token": bot_token},
                {"$push": {"shared_with": {"username": shared_user, "role": role}}}
            )
            
            if result.modified_count == 0:
                return ServiceResult.fail("Failed to update bot shared list", 500)
            
            self.log_operation("share_bot", 
                               sharer=username, 
                               bot_token=bot_token, 
                               shared_with=shared_user,
                               role=role)
            
            return ServiceResult.ok({
                "message": f"Bot shared with {shared_user} as {role}."
            })
            
        except Exception as e:
            self.logger.error(f"Error sharing bot: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def update_role(
        self,
        identity: str,
        bot_token: str,
        shared_user: str,
        new_role: str,
        tenant_id: str
    ) -> ServiceResult:
        """
        Update a shared user's role.
        
        Args:
            identity: Current user's identity
            bot_token: Bot token
            shared_user: User whose role to update
            new_role: New role to assign
            tenant_id: Tenant ID
            
        Returns:
            ServiceResult with success/error
        """
        try:
            if new_role not in self.ALLOWED_ROLES:
                return ServiceResult.fail(
                    f"Invalid role. Must be one of: {', '.join(self.ALLOWED_ROLES)}", 
                    400
                )
            
            username = self.extract_username(identity)
            bot = self.db.find_one({"bot_token": bot_token, "tenant_id": tenant_id})
            
            if not bot:
                return ServiceResult.fail("Bot not found or access denied", 404)
            
            # Only owner can update roles
            if bot.get("created_by") != username:
                return ServiceResult.fail("Only the owner can update shared user roles.", 403)
            
            # Check if shared user exists
            shared_with = bot.get("shared_with", [])
            user_found = any(u["username"].lower() == shared_user.lower() for u in shared_with)
            
            if not user_found:
                return ServiceResult.fail("User is not shared with this bot.", 404)
            
            result = self.db.update_one(
                {
                    "bot_token": bot_token,
                    "shared_with.username": {"$regex": f"^{shared_user}$", "$options": "i"}
                },
                {"$set": {"shared_with.$.role": new_role}}
            )
            
            if result.modified_count == 0:
                return ServiceResult.fail("Failed to update shared user role.", 500)
            
            self.log_operation("update_role",
                               updater=username,
                               bot_token=bot_token,
                               shared_user=shared_user,
                               new_role=new_role)
            
            return ServiceResult.ok({
                "message": f"Updated {shared_user}'s role to {new_role}."
            })
            
        except Exception as e:
            self.logger.error(f"Error updating role: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def remove_user(
        self,
        identity: str,
        bot_token: str,
        shared_user: str
    ) -> ServiceResult:
        """
        Remove a shared user from a bot.
        
        Args:
            identity: Current user's identity
            bot_token: Bot token
            shared_user: User to remove
            
        Returns:
            ServiceResult with success/error
        """
        try:
            username = self.extract_username(identity)
            bot = self.db.find_one({"bot_token": bot_token})
            
            if not bot:
                return ServiceResult.fail("Bot not found or access denied", 404)
            
            # Owner or the shared user themselves can remove
            is_owner = bot.get("created_by") == username
            is_self = shared_user.lower() == username.lower()
            
            if not is_owner and not is_self:
                return ServiceResult.fail(
                    "Only the owner or the shared user can remove sharing.", 
                    403
                )
            
            result = self.db.update_one(
                {"bot_token": bot_token},
                {"$pull": {"shared_with": {"username": {"$regex": f"^{shared_user}$", "$options": "i"}}}}
            )
            
            if result.modified_count == 0:
                return ServiceResult.fail("User not found in shared list or failed to remove.", 404)
            
            self.log_operation("remove_shared_user",
                               remover=username,
                               bot_token=bot_token,
                               removed_user=shared_user)
            
            return ServiceResult.ok({
                "message": f"Removed {shared_user} from bot sharing."
            })
            
        except Exception as e:
            self.logger.error(f"Error removing shared user: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def list_shared_users(
        self,
        identity: str,
        bot_token: str,
        tenant_id: str
    ) -> ServiceResult:
        """
        List all users a bot is shared with.
        
        Args:
            identity: Current user's identity
            bot_token: Bot token
            tenant_id: Tenant ID
            
        Returns:
            ServiceResult with list of shared users
        """
        try:
            username = self.extract_username(identity)
            bot = self.db.find_one({"bot_token": bot_token, "tenant_id": tenant_id})
            
            if not bot:
                return ServiceResult.fail("Bot not found or access denied", 404)
            
            # Verify user has access
            is_owner = bot.get("created_by") == username
            is_shared = any(
                u["username"].lower() == username.lower() 
                for u in bot.get("shared_with", [])
            )
            
            if not is_owner and not is_shared:
                return ServiceResult.fail("Access denied", 403)
            
            shared_with = bot.get("shared_with", [])
            
            return ServiceResult.ok({
                "shared_with": shared_with,
                "owner": bot.get("created_by")
            })
            
        except Exception as e:
            self.logger.error(f"Error listing shared users: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)


# Singleton instance
_sharing_service_instance: Optional[BotSharingService] = None


def get_sharing_service() -> BotSharingService:
    """Get or create the bot sharing service singleton."""
    global _sharing_service_instance
    if _sharing_service_instance is None:
        _sharing_service_instance = BotSharingService()
    return _sharing_service_instance
