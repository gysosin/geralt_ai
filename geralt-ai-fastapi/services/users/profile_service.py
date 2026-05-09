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
    ALLOWED_IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg"}
    IMAGE_CONTENT_TYPES_BY_EXTENSION = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
    }
    MAX_PROFILE_PICTURE_SIZE = 5 * 1024 * 1024
    
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
        if "." not in filename:
            return ServiceResult.fail(
                "Invalid image format. Allowed: png, jpg, jpeg",
                400
            )

        ext = filename.rsplit(".", 1)[-1].lower()
        
        if ext not in self.ALLOWED_IMAGE_EXTENSIONS:
            return ServiceResult.fail(
                "Invalid image format. Allowed: png, jpg, jpeg",
                400
            )

        content_type = (getattr(file, "content_type", "") or "").split(";")[0].strip().lower()
        if content_type and content_type not in self.ALLOWED_IMAGE_CONTENT_TYPES:
            return ServiceResult.fail(
                "Invalid image content type. Allowed: image/png, image/jpeg",
                400
            )
        if content_type and content_type != self.IMAGE_CONTENT_TYPES_BY_EXTENSION[ext]:
            return ServiceResult.fail(
                f"Invalid image content type for .{ext} file",
                400
            )
        
        new_filename = f"{uuid4()}.{ext}"
        file_path = f"{username}/profile_pictures/{new_filename}"
        stream = getattr(file, "file", file)
        
        stream.seek(0, os.SEEK_END)
        file_size = stream.tell()
        stream.seek(0)

        if file_size <= 0:
            return ServiceResult.fail("Profile picture cannot be empty", 400)
        if file_size > self.MAX_PROFILE_PICTURE_SIZE:
            return ServiceResult.fail("Profile picture is too large", 413)

        header = stream.read(16)
        stream.seek(0)
        if not self._matches_image_signature(ext, header):
            return ServiceResult.fail("Invalid image content", 400)
        
        self.storage.put_object(
            Config.BUCKET_NAME,
            file_path,
            stream,
            length=file_size
        )
        
        return ServiceResult.ok(file_path)

    def _matches_image_signature(self, extension: str, header: bytes) -> bool:
        """Validate the uploaded image header against the requested extension."""
        if extension == "png":
            return header.startswith(b"\x89PNG\r\n\x1a\n")
        if extension in {"jpg", "jpeg"}:
            return header.startswith(b"\xff\xd8\xff")
        return False


# Singleton instance
_profile_service_instance: Optional[ProfileService] = None


def get_profile_service() -> ProfileService:
    """Get or create the profile service singleton."""
    global _profile_service_instance
    if _profile_service_instance is None:
        _profile_service_instance = ProfileService()
    return _profile_service_instance
