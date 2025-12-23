"""
Bot Token Service

Handles all bot token CRUD operations with proper OOP patterns.
Extracted from bot_management_service.py for single responsibility.
"""
import os
import io
import json
import uuid
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus, unquote
import requests

from helpers.utils import get_utility_service
from config import Config
from clients import minio_client, redis_client
from models.database import (
    tokens_collection,
    collection_collection,
    conversation_collection,
)
from services.bots import BaseService, ServiceResult, CRUDMixin


class BotTokenService(BaseService, CRUDMixin):
    """
    Service for managing bot tokens.
    
    Responsibilities:
    - Create, read, update, delete bot tokens
    - Handle bot icons (upload, proxy, delete)
    - Validate bot configurations
    
    Usage:
        service = BotTokenService()
        result = service.create(identity, form_data, files)
        if result.success:
            return result.data, result.status_code
        else:
            return {"error": result.error}, result.status_code
    """
    
    ALLOWED_ICON_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
    VALID_ACTION_TYPES = {"open_url", "open_in_iframe", "send_message"}
    
    DEFAULT_PROMPT = (
        "You are a helpful assistant that only provides answers based on the provided data. "
        "According to the following context, answer the user's query accurately."
    )
    
    def __init__(self):
        super().__init__()
        self.db = tokens_collection
        self.collections_db = collection_collection
        self.conversations_db = conversation_collection
        self.storage = minio_client
        self.cache = redis_client
    
    # =========================================================================
    # CRUD Operations
    # =========================================================================
    
    def create(
        self,
        identity: str,
        form_data: Dict[str, Any],
        files: Optional[Dict] = None
    ) -> ServiceResult:
        """
        Create a new bot token.
        
        Args:
            identity: User's email/identity
            form_data: Form data with bot configuration
            files: Optional file uploads (icon)
            
        Returns:
            ServiceResult with bot_token on success
        """
        try:
            username = self.extract_username(identity)
            
            # Validate required fields
            tenant_id = form_data.get("tenant_id")
            if not tenant_id:
                return ServiceResult.fail("Tenant ID is required", 400)
            
            bot_name = form_data.get("bot_name")
            if not bot_name:
                return ServiceResult.fail("Bot name is required", 400)
            
            collection_ids = form_data.getlist("collection_ids") if hasattr(form_data, 'getlist') else form_data.get("collection_ids", [])
            
            # Ensure collection_ids is a list (handle single value or string input)
            if isinstance(collection_ids, str):
                collection_ids = [collection_ids]
                
            if not collection_ids:
                return ServiceResult.fail("At least one collection ID is required", 400)
            
            # Check for duplicate bot name
            if self._bot_name_exists(bot_name, username, tenant_id):
                return ServiceResult.fail("Bot name already exists for this user in this tenant", 409)
            
            # Validate collection access
            validation = self._validate_collection_access(collection_ids, username)
            if not validation.success:
                return validation
            
            # Parse and validate UI actions
            ui_actions_result = self._parse_ui_actions(form_data.get("ui_actions", ""))
            if not ui_actions_result.success:
                return ui_actions_result
            ui_actions = ui_actions_result.data or []
            
            # Parse and validate welcome buttons
            welcome_buttons_result = self._parse_welcome_buttons(form_data.get("welcome_buttons", ""))
            if not welcome_buttons_result.success:
                return welcome_buttons_result
            welcome_buttons = welcome_buttons_result.data or []
            
            # Handle icon upload
            icon_url = None
            icon_file_path = None
            if files and "icon" in files:
                icon_result = self._upload_icon(files["icon"], username)
                if icon_result.success and icon_result.data:
                    icon_file_path = icon_result.data["file_path"]
            
            # Generate bot token
            bot_token = f"geraltai-{secrets.token_hex(10)}"
            
            if icon_file_path:
                icon_url = f"{Config.API_ENDPOINT}/bot/get_icon/{bot_token}"
            
            # Build bot data
            prompt = form_data.get("prompt", "").strip() or self.DEFAULT_PROMPT
            
            bot_data = {
                "bot_token": bot_token,
                "tenant_id": tenant_id,
                "bot_name": bot_name,
                "created_by": username,
                "collection_ids": collection_ids,
                "prompt": prompt,
                "description": form_data.get("description", "").strip(),
                "welcome_message": form_data.get("welcome_message", "").strip(),
                "welcome_buttons": welcome_buttons,
                "icon_url": icon_url,
                "icon_file_path": icon_file_path,
                "created_at": datetime.utcnow(),
                "ui_actions": ui_actions,
                "bot_bg_color": form_data.get("bot_bg_color", "").strip(),
                "bot_font_color": form_data.get("bot_font_color", "").strip(),
                "bot_active_color": form_data.get("bot_active_color", "").strip(),
            }
            
            self.db.insert_one(bot_data)
            self.log_operation("create_bot", username=username, bot_token=bot_token)
            
            return ServiceResult.ok({
                "message": "Bot token generated successfully.",
                "bot_token": bot_token,
                "icon_url": icon_url,
                "welcome_message": bot_data["welcome_message"],
                "welcome_buttons": welcome_buttons,
            }, 201)
            
        except Exception as e:
            self.logger.error(f"Error creating bot: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def get(self, identity: str, bot_token: str, tenant_id: Optional[str] = None) -> ServiceResult:
        """
        Get bot token details.
        
        Args:
            identity: User's email/identity
            bot_token: The bot token to retrieve
            tenant_id: Optional tenant filter
            
        Returns:
            ServiceResult with bot details
        """
        try:
            self.logger.info(f"Getting bot: {bot_token}, tenant: {tenant_id}")
            
            # Allow looking up by bot_token OR _id
            query = {"bot_token": bot_token}
            
            # Fallback: If it looks like an ObjectId, try querying by _id
            if len(bot_token) == 24 and all(c in "0123456789abcdefABCDEF" for c in bot_token):
                try:
                    from bson.objectid import ObjectId
                    query = {"_id": ObjectId(bot_token)}
                    self.logger.info(f"Token looks like ObjectId, switching query to _id: {bot_token}")
                except Exception:
                    pass # Keep original query if conversion fails

            if tenant_id:
                query["tenant_id"] = tenant_id
            
            bot = self.db.find_one(query)
            if not bot:
                self.logger.warning(f"Bot not found with query: {query}")
                return ServiceResult.fail("Bot not found or access denied", 404)
            
            # Serialize for response
            bot["_id"] = str(bot["_id"])
            if "created_at" in bot:
                bot["created_at"] = self.serialize_datetime(bot["created_at"])
            
            # Generate presigned URL for icon
            if bot.get("icon_file_path"):
                bot["icon_url"] = self._get_icon_url(bot["icon_file_path"])
            
            return ServiceResult.ok(bot)
            
        except Exception as e:
            self.logger.error(f"Error getting bot: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def list(self, identity: str, tenant_id: str) -> ServiceResult:
        """
        List all bot tokens for a user in a tenant.
        
        Args:
            identity: User's email/identity
            tenant_id: Tenant to list bots for
            
        Returns:
            ServiceResult with list of bots
        """
        try:
            username = self.extract_username(identity)
            
            # Bots created by user
            user_bots = list(self.db.find({
                "created_by": username,
                "tenant_id": tenant_id
            }))
            
            # Bots shared with user
            shared_bots = list(self.db.find({
                "tenant_id": tenant_id,
                "shared_with": {
                    "$elemMatch": {
                        "username": {"$regex": f"^{username}$", "$options": "i"}
                    }
                }
            }))
            
            # Deduplicate
            all_bots = user_bots + shared_bots
            unique_bots = {str(bot["_id"]): bot for bot in all_bots}.values()
            
            token_list = []
            for bot in unique_bots:
                bot_data = self._serialize_bot(bot, username)
                token_list.append(bot_data)
            
            return ServiceResult.ok({
                "message": "Bot tokens retrieved successfully." if token_list else "No bots found.",
                "tokens": token_list,
            })
            
        except Exception as e:
            self.logger.error(f"Error listing bots: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def update(
        self,
        identity: str,
        bot_token: str,
        form_data: Dict[str, Any],
        files: Optional[Dict] = None
    ) -> ServiceResult:
        """
        Update a bot token.
        
        Args:
            identity: User's email/identity
            bot_token: The bot token to update
            form_data: Form data with updated configuration
            files: Optional file uploads (icon)
            
        Returns:
            ServiceResult with success message
        """
        try:
            username = self.extract_username(identity)
            
            tenant_id = form_data.get("tenant_id")
            if not tenant_id:
                return ServiceResult.fail("Tenant ID is required", 400)
            
            bot = self.db.find_one({"bot_token": bot_token, "tenant_id": tenant_id})
            if not bot:
                return ServiceResult.fail("Bot not found or access denied", 404)
            
            # Determine user role
            is_owner = bot.get("created_by") == username
            user_role = self._get_user_role(bot, username)
            
            if user_role == "read-only":
                return ServiceResult.fail("You do not have permission to update the bot.", 403)
            
            # Build update based on role
            if is_owner or user_role == "admin":
                update_result = self._build_owner_update(bot, form_data, files, username, tenant_id)
            elif user_role == "contributor":
                update_result = self._build_contributor_update(bot, form_data, username)
            else:
                return ServiceResult.fail("You do not have permission to update the bot.", 403)
            
            if not update_result.success:
                return update_result
            
            update_data = update_result.data
            if update_data:
                self.db.update_one(
                    {"bot_token": bot_token, "tenant_id": tenant_id},
                    {"$set": update_data}
                )
                self.log_operation("update_bot", username=username, bot_token=bot_token)
            
            return ServiceResult.ok({"message": "Bot updated successfully"})
            
        except Exception as e:
            self.logger.error(f"Error updating bot: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def delete(self, identity: str, bot_token: str) -> ServiceResult:
        """
        Delete a bot token and all associated resources.
        
        Args:
            identity: User's email/identity
            bot_token: The bot token to delete
            
        Returns:
            ServiceResult with success message
        """
        try:
            username = self.extract_username(identity)
            
            bot = self.db.find_one({"bot_token": bot_token})
            if not bot:
                return ServiceResult.fail("Bot not found or access denied", 404)
            
            if bot["created_by"] != username:
                return ServiceResult.fail("Only the owner can delete the bot.", 403)
            
            # Delete icon from storage
            if bot.get("icon_file_path"):
                try:
                    self.storage.remove_object(Config.BUCKET_NAME, bot["icon_file_path"])
                except Exception as e:
                    self.logger.warning(f"Failed to delete icon: {e}")
            
            # Delete bot record
            result = self.db.delete_one({"bot_token": bot_token})
            if result.deleted_count == 0:
                return ServiceResult.fail("Bot not found or access denied", 404)
            
            # Delete conversations from MongoDB
            conv_result = self.conversations_db.delete_many({"bot_token": bot_token})
            self.logger.info(f"Deleted {conv_result.deleted_count} conversations from MongoDB")
            
            # Delete conversations from Redis
            redis_keys = self.cache.keys(f"conversation:{bot_token}:*")
            if redis_keys:
                for key in redis_keys:
                    self.cache.delete(key)
                self.logger.info(f"Deleted {len(redis_keys)} conversations from Redis")
            
            self.log_operation("delete_bot", username=username, bot_token=bot_token)
            
            return ServiceResult.ok({
                "message": "Bot, associated resources, and conversations deleted successfully"
            })
            
        except Exception as e:
            self.logger.error(f"Error deleting bot: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    # =========================================================================
    # Icon Operations
    # =========================================================================
    
    def get_icon(self, identity: str, bot_token: str) -> ServiceResult:
        """Retrieve bot icon from storage."""
        try:
            bot = self.db.find_one({"bot_token": bot_token})
            if not bot or not bot.get("icon_file_path"):
                return ServiceResult.fail("Icon not found", 404)
            
            icon_path = bot["icon_file_path"]
            response = self.storage.get_object(Config.BUCKET_NAME, icon_path)
            
            return ServiceResult.ok({
                "content": response.read(),
                "content_type": "image/png"  # Default, should detect from path
            })
            
        except Exception as e:
            self.logger.error(f"Error getting icon: {e}")
            return ServiceResult.fail(f"Failed to retrieve icon: {str(e)}", 500)
    
    def proxy_icon(self, encoded_url: str) -> ServiceResult:
        """Proxy an icon from a presigned URL."""
        try:
            pre_signed_url = unquote(encoded_url)
            response = requests.get(pre_signed_url)
            
            if response.status_code != 200:
                return ServiceResult.fail("Failed to retrieve image from MinIO.", 500)
            
            return ServiceResult.ok({
                "content": response.content,
                "content_type": response.headers.get("Content-Type", "image/png")
            })
            
        except Exception as e:
            self.logger.error(f"Error proxying icon: {e}")
            return ServiceResult.fail(f"Failed to proxy icon: {str(e)}", 500)
    
    def proxy_file(self, url: str, filename: str) -> ServiceResult:
        """Proxy a file download from a presigned URL."""
        try:
            decoded_url = unquote(url)
            response = requests.get(decoded_url)
            
            if response.status_code != 200:
                return ServiceResult.fail("Failed to retrieve file.", 500)
            
            return ServiceResult.ok({
                "content": response.content,
                "content_type": response.headers.get("Content-Type", "application/octet-stream"),
                "filename": filename
            })
            
        except Exception as e:
            self.logger.error(f"Error proxying file: {e}")
            return ServiceResult.fail(f"Failed to proxy file: {str(e)}", 500)

    # =========================================================================
    # Private Helper Methods
    # =========================================================================
    
    def _bot_name_exists(self, bot_name: str, username: str, tenant_id: str) -> bool:
        """Check if a bot name already exists for this user in this tenant."""
        existing = self.db.find_one({
            "bot_name": bot_name,
            "created_by": username,
            "tenant_id": tenant_id,
        })
        return existing is not None
    
    def _validate_collection_access(self, collection_ids: List[str], username: str) -> ServiceResult:
        """Validate that user has access to all specified collections."""
        for cid in collection_ids:
            # Use case-insensitive matching for username, consistent with other queries
            collection = self.collections_db.find_one({
                "collection_id": cid,
                "$or": [
                    {"created_by": {"$regex": f"^{username}$", "$options": "i"}},
                    {"shared_with": {"$elemMatch": {"username": {"$regex": f"^{username}$", "$options": "i"}}}},
                ],
            })
            if not collection:
                return ServiceResult.fail(f"Collection is invalid or access denied", 403)
        return ServiceResult.ok()
    
    def _parse_ui_actions(self, ui_actions_str: str) -> ServiceResult:
        """Parse and validate UI actions JSON."""
        if not ui_actions_str or not ui_actions_str.strip():
            return ServiceResult.ok([])
        
        try:
            actions = json.loads(ui_actions_str)
            validated = []
            
            for action in actions:
                action.pop("action_id", None)
                
                if not all(k in action for k in ("name", "action_type", "trigger_phrases")):
                    return ServiceResult.fail(
                        "Each UI action must have 'name', 'action_type', and 'trigger_phrases'.",
                        400
                    )
                
                if action["action_type"] not in self.VALID_ACTION_TYPES:
                    return ServiceResult.fail(
                        f"Invalid action_type '{action['action_type']}' in UI actions.",
                        400
                    )
                
                if action["action_type"] in {"open_url", "open_in_iframe"} and not action.get("action_url"):
                    return ServiceResult.fail(
                        f"'action_url' is required for action_type '{action['action_type']}'.",
                        400
                    )
                
                if action["action_type"] == "send_message" and not action.get("message"):
                    return ServiceResult.fail(
                        "'message' is required for action_type 'send_message'.",
                        400
                    )
                
                action["action_id"] = str(uuid.uuid4())
                validated.append(action)
            
            return ServiceResult.ok(validated)
            
        except json.JSONDecodeError:
            return ServiceResult.fail("Invalid format for ui_actions", 400)
    
    def _parse_welcome_buttons(self, buttons_str: str) -> ServiceResult:
        """Parse and validate welcome buttons JSON."""
        if not buttons_str or not buttons_str.strip():
            return ServiceResult.ok([])
        
        try:
            buttons = json.loads(buttons_str)
            validated = []
            
            for button in buttons:
                button.pop("button_id", None)
                
                if not all(k in button for k in ("text", "action_type")):
                    return ServiceResult.fail(
                        "Each welcome button must have 'text' and 'action_type'.",
                        400
                    )
                
                if button["action_type"] not in self.VALID_ACTION_TYPES:
                    return ServiceResult.fail(
                        f"Invalid action_type '{button['action_type']}' in welcome buttons.",
                        400
                    )
                
                if button["action_type"] in {"open_url", "open_in_iframe"} and not button.get("action_url"):
                    return ServiceResult.fail(
                        f"'action_url' is required for action_type '{button['action_type']}' in welcome buttons.",
                        400
                    )
                
                if button["action_type"] == "send_message" and not button.get("message"):
                    return ServiceResult.fail(
                        "'message' is required for action_type 'send_message' in welcome buttons.",
                        400
                    )
                
                button["button_id"] = str(uuid.uuid4())
                validated.append(button)
            
            return ServiceResult.ok(validated)
            
        except json.JSONDecodeError:
            return ServiceResult.fail("Invalid format for welcome_buttons", 400)
    
    def _upload_icon(self, icon_file, username: str) -> ServiceResult:
        """Upload an icon file to storage."""
        if not icon_file or icon_file.filename == "":
            return ServiceResult.ok(None)
        
        filename = get_utility_service().secure_filename(icon_file.filename)
        if "." not in filename:
            return ServiceResult.fail("Invalid image format.", 400)
        
        extension = filename.rsplit(".", 1)[1].lower()
        if extension not in self.ALLOWED_ICON_EXTENSIONS:
            return ServiceResult.fail(
                f"Invalid image format. Allowed: {', '.join(self.ALLOWED_ICON_EXTENSIONS)}",
                400
            )
        
        icon_filename = f"{uuid.uuid4()}.{extension}"
        file_path = f"{username}/bot_icons/{icon_filename}"
        
        icon_file.seek(0, os.SEEK_END)
        file_size = icon_file.tell()
        icon_file.seek(0)
        
        self.storage.put_object(
            Config.BUCKET_NAME,
            file_path,
            icon_file,
            length=file_size
        )
        
        return ServiceResult.ok({"file_path": file_path})
    
    def _get_icon_url(self, icon_file_path: str) -> str:
        """Generate a proxied icon URL."""
        try:
            pre_signed_url = self.storage.presigned_get_object(
                Config.BUCKET_NAME,
                icon_file_path,
                expires=timedelta(hours=24),
            )
            encoded_url = quote_plus(pre_signed_url)
            return f"{Config.BASE_API_URL}/bot_management/proxy-icon?url={encoded_url}"
        except Exception:
            return ""
    
    def _get_user_role(self, bot: Dict, username: str) -> str:
        """Determine user's role for a bot."""
        if bot.get("created_by") == username:
            return "owner"
        
        shared_with = bot.get("shared_with", [])
        for user in shared_with:
            if user["username"].lower() == username.lower():
                return user.get("role", "read-only")
        
        return "read-only"
    
    def _serialize_bot(self, bot: Dict, username: str) -> Dict:
        """Serialize a bot document for API response."""
        bot["_id"] = str(bot["_id"])
        if "created_at" in bot:
            bot["created_at"] = self.serialize_datetime(bot["created_at"])
        
        is_owner = bot["created_by"] == username
        user_role = self._get_user_role(bot, username)
        
        bot["is_owner"] = is_owner
        bot["user_role"] = user_role
        
        if bot.get("icon_file_path"):
            bot["icon_url"] = self._get_icon_url(bot["icon_file_path"])
        else:
            bot["icon_url"] = ""
            
        # Calculate stats
        bot_token = bot.get("bot_token")
        chat_count = self.conversations_db.count_documents({"bot_token": bot_token})
        self.logger.info(f"Calculating stats for bot {bot_token}: found {chat_count} chats")
        
        bot["stats"] = {
            "chats": chat_count,
            "rating": 5.0 # Default/placeholder
        }
        
        return bot
    
    def _build_owner_update(
        self,
        bot: Dict,
        form_data: Dict,
        files: Optional[Dict],
        username: str,
        tenant_id: str
    ) -> ServiceResult:
        """Build update data for owner/admin role."""
        update_data = {}
        
        # Simple fields
        simple_fields = [
            "bot_name", "prompt", "description", "welcome_message",
            "bot_bg_color", "bot_font_color", "bot_active_color",
        ]
        
        for field in simple_fields:
            new_val = form_data.get(field)
            if new_val is not None and self._is_field_changed(bot, field, new_val):
                if field == "bot_name":
                    existing = self.db.find_one({
                        "bot_name": new_val,
                        "tenant_id": tenant_id,
                        "created_by": bot["created_by"],
                        "bot_token": {"$ne": bot["bot_token"]}
                    })
                    if existing:
                        return ServiceResult.fail("Bot name already exists for this user", 409)
                update_data[field] = new_val
        
        # Collection IDs
        new_collection_ids = form_data.getlist("collection_ids") if hasattr(form_data, 'getlist') else form_data.get("collection_ids")
        
        # Ensure list
        if isinstance(new_collection_ids, str):
            new_collection_ids = [new_collection_ids]
            
        if new_collection_ids:
            for cid in new_collection_ids:
                coll = self.collections_db.find_one({
                    "collection_id": cid,
                    "tenant_id": tenant_id
                })
                if not coll:
                    return ServiceResult.fail("Collection ID is invalid or access denied", 403)
            update_data["collection_ids"] = new_collection_ids
        
        # UI actions
        new_ui_actions = form_data.get("ui_actions")
        if new_ui_actions and self._is_field_changed(bot, "ui_actions", new_ui_actions):
            result = self._parse_ui_actions(new_ui_actions)
            if not result.success:
                return result
            update_data["ui_actions"] = result.data
        
        # Welcome buttons
        new_buttons = form_data.get("welcome_buttons")
        if new_buttons and self._is_field_changed(bot, "welcome_buttons", new_buttons):
            result = self._parse_welcome_buttons(new_buttons)
            if not result.success:
                return result
            update_data["welcome_buttons"] = result.data
        
        # Icon update
        if files and "icon" in files:
            icon_file = files["icon"]
            if icon_file and icon_file.filename != "":
                icon_result = self._upload_icon(icon_file, username)
                if not icon_result.success:
                    return icon_result
                
                if icon_result.data:
                    # Delete old icon
                    old_path = bot.get("icon_file_path")
                    if old_path:
                        try:
                            self.storage.remove_object(Config.BUCKET_NAME, old_path)
                        except Exception as e:
                            self.logger.warning(f"Failed to delete old icon: {e}")
                    
                    update_data["icon_file_path"] = icon_result.data["file_path"]
        
        return ServiceResult.ok(update_data)
    
    def _build_contributor_update(
        self,
        bot: Dict,
        form_data: Dict,
        username: str
    ) -> ServiceResult:
        """Build update data for contributor role."""
        update_data = {}
        
        # Contributors can only modify collection_ids they added
        allowed_keys = {"tenant_id", "bot_token", "collection_ids"}
        form_keys = set(form_data.keys()) if hasattr(form_data, 'keys') else set()
        
        for key in form_keys - allowed_keys:
            new_val = form_data.get(key, "")
            if self._is_field_changed(bot, key, new_val):
                return ServiceResult.fail(f"Contributors cannot modify '{key}'.", 403)
        
        # Handle collection_ids
        new_collection_ids = form_data.getlist("collection_ids") if hasattr(form_data, 'getlist') else form_data.get("collection_ids")
        
        # Ensure list
        if isinstance(new_collection_ids, str):
            new_collection_ids = [new_collection_ids]

        if new_collection_ids:
            current = set(bot.get("collection_ids", []))
            new_set = set(new_collection_ids)
            contributor_added = set(bot.get("contributor_added_collections", []))
            
            to_add = new_set - current
            to_remove = current - new_set
            
            # Validate additions
            for cid in to_add:
                coll = self.collections_db.find_one({
                    "collection_id": cid,
                    "$or": [
                        {"created_by": username},
                        {"shared_with": {"$elemMatch": {"username": username}}},
                    ],
                })
                if not coll:
                    return ServiceResult.fail("Collection ID is invalid or access denied", 403)
            
            # Validate removals
            invalid_removals = [cid for cid in to_remove if cid not in contributor_added]
            if invalid_removals:
                return ServiceResult.fail(
                    "You cannot remove collections you did not add.",
                    403
                )
            
            valid_removals = [cid for cid in to_remove if cid in contributor_added]
            
            new_contrib = contributor_added.union(to_add).difference(valid_removals)
            update_data["contributor_added_collections"] = list(new_contrib)
            
            final_collections = current.union(to_add).difference(valid_removals)
            update_data["collection_ids"] = list(final_collections)
        
        return ServiceResult.ok(update_data)
    
    def _is_field_changed(self, bot: Dict, field: str, new_val: Any) -> bool:
        """Check if a field value has changed."""
        old_val = bot.get(field)
        
        if not old_val and not new_val:
            return False
        
        # JSON comparison for complex types
        if isinstance(old_val, (dict, list)) or (
            new_val and isinstance(new_val, str) and new_val.strip().startswith(("{", "["))
        ):
            try:
                old_json = old_val if isinstance(old_val, (dict, list)) else json.loads(str(old_val))
                new_json = json.loads(new_val) if isinstance(new_val, str) else new_val
                return old_json != new_json
            except Exception:
                pass
        
        return str(old_val) != str(new_val)


# Singleton instance for dependency injection
_token_service_instance: Optional[BotTokenService] = None


def get_token_service() -> BotTokenService:
    """Get or create the bot token service singleton."""
    global _token_service_instance
    if _token_service_instance is None:
        _token_service_instance = BotTokenService()
    return _token_service_instance
