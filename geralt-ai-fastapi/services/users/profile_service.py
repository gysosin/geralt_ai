"""
User Profile Service

Handles user profile CRUD operations.
"""
import os
import io
import base64
from uuid import uuid4
from typing import Dict, Optional, Any

from passlib.context import CryptContext

from config import Config
from clients import minio_client
from models.database import users_collection
from services.bots import BaseService, ServiceResult
from helpers.utils import get_utility_service

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class ProfileService(BaseService):
    """
    Service for user profile management.
    
    Responsibilities:
    - Get user profile
    - Update user profile
    - Delete user profile
    - Manage profile pictures
    """
    
    ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg"}
    
    def __init__(self):
        super().__init__()
        self.db = users_collection
        self.storage = minio_client
    
    def get(self, identity: str) -> ServiceResult:
        """
        Get user profile.
        
        Args:
            identity: User's identity (email)
            
        Returns:
            ServiceResult with user profile data
        """
        try:
            username = self.extract_username(identity)
            
            user = self.db.find_one({"username": username}, {"_id": 0})
            if not user:
                return ServiceResult.fail("User not found", 404)
            
            # Fetch profile picture if exists
            profile_picture_base64 = None
            profile_picture_path = user.get("profile_picture_file_path")
            
            if profile_picture_path:
                try:
                    data = self.storage.get_object(Config.BUCKET_NAME, profile_picture_path)
                    file_stream = io.BytesIO(data.read())
                    data.close()
                    profile_picture_base64 = base64.b64encode(file_stream.getvalue()).decode("utf-8")
                except Exception as e:
                    self.logger.error(f"Failed to fetch profile picture: {e}")
            
            return ServiceResult.ok({
                "username": user["username"],
                "email": user["email"],
                "firstname": user["firstname"],
                "lastname": user["lastname"],
                "role": user.get("role", "user"),
                "color_scheme": user.get("color_scheme", "bright"),
                "language": user.get("language", "English"),
                "timezone": user.get("timezone", "UTC+0"),
                "chat_model": user.get("chat_model", "Mistral"),
                "embedding_model": user.get("embedding_model", "Mistral"),
                "api_key": user.get("api_key"),
                "profile_picture_base64": profile_picture_base64,
            })
            
        except Exception as e:
            self.logger.error(f"Error getting profile: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def update(
        self,
        identity: str,
        data: Dict[str, Any],
        profile_picture_file=None
    ) -> ServiceResult:
        """
        Update user profile.
        
        Args:
            identity: User's identity (email)
            data: Fields to update
            profile_picture_file: Optional profile picture file
            
        Returns:
            ServiceResult with update status
        """
        try:
            username = self.extract_username(identity)
            
            updated_fields = {}
            
            # Update basic fields
            for field in ["firstname", "lastname", "color_scheme", "language", 
                          "timezone", "chat_model", "embedding_model"]:
                if data.get(field):
                    updated_fields[field] = data[field]
            
            # Handle profile picture upload
            if profile_picture_file and profile_picture_file.filename:
                result = self._upload_profile_picture(username, profile_picture_file)
                if result.success:
                    updated_fields["profile_picture_file_path"] = result.data
                else:
                    return result
            
            # Handle password update
            if data.get("password"):
                updated_fields["password"] = pwd_context.hash(data["password"])
            
            if not updated_fields:
                return ServiceResult.fail("No data provided to update", 400)
            
            result = self.db.update_one(
                {"username": username},
                {"$set": updated_fields}
            )
            
            if result.modified_count > 0:
                self.log_operation("update_profile", username=username)
                return ServiceResult.ok({"message": "User profile updated successfully"})
            else:
                return ServiceResult.fail("No changes made or user not found", 404)
                
        except Exception as e:
            self.logger.error(f"Error updating profile: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def delete(self, identity: str) -> ServiceResult:
        """
        Delete user profile.
        
        Args:
            identity: User's identity
            
        Returns:
            ServiceResult with deletion status
        """
        try:
            username = self.extract_username(identity)
            
            result = self.db.delete_one({"username": username})
            
            if result.deleted_count > 0:
                self.log_operation("delete_profile", username=username)
                return ServiceResult.ok({"message": "User deleted"})
            
            return ServiceResult.fail("User not found", 404)
            
        except Exception as e:
            self.logger.error(f"Error deleting profile: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def _upload_profile_picture(self, username: str, file) -> ServiceResult:
        """Upload profile picture to MinIO."""
        filename = get_utility_service().secure_filename(file.filename)
        ext = filename.rsplit(".", 1)[-1].lower()
        
        if ext not in self.ALLOWED_IMAGE_EXTENSIONS:
            return ServiceResult.fail(
                "Invalid image format. Allowed: png, jpg, jpeg",
                400
            )
        
        new_filename = f"{uuid4()}.{ext}"
        file_path = f"{username}/profile_pictures/{new_filename}"
        
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        self.storage.put_object(
            Config.BUCKET_NAME,
            file_path,
            file,
            length=file_size
        )
        
        return ServiceResult.ok(file_path)


# Singleton instance
_profile_service_instance: Optional[ProfileService] = None


def get_profile_service() -> ProfileService:
    """Get or create the profile service singleton."""
    global _profile_service_instance
    if _profile_service_instance is None:
        _profile_service_instance = ProfileService()
    return _profile_service_instance
