"""
Bot Template Service

Handles bot template management (create, list, apply).
Extracted from bot_management_service.py for single responsibility.
"""
import os
import uuid
import base64
from datetime import datetime
from typing import Dict, Optional, Any

from helpers.utils import get_utility_service
from config import Config
from clients import minio_client
from models.database import templates_collection
from services.bots import BaseService, ServiceResult


class TemplateService(BaseService):
    """
    Service for managing bot templates.
    
    Responsibilities:
    - Create new templates
    - List available templates
    - Apply templates to create bots
    """
    
    ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
    
    def __init__(self):
        super().__init__()
        self.db = templates_collection
        self.storage = minio_client
    
    def create(
        self,
        identity: str,
        data: Dict[str, Any],
        image
    ) -> ServiceResult:
        """
        Create a new bot template.
        
        Args:
            identity: Creator's identity
            data: Template data (name, prompt, description)
            image: Template preview image
            
        Returns:
            ServiceResult with created template info
        """
        try:
            template_name = data.get("template_name")
            prompt = data.get("prompt", "").strip()
            description = data.get("description", "").strip()
            
            # Validate required fields
            if not template_name or not prompt:
                return ServiceResult.fail("Template name and prompt are required", 400)
            
            if not image:
                return ServiceResult.fail("Template image is required", 400)
            
            # Check for duplicate
            if self.db.find_one({"template_name": template_name}):
                return ServiceResult.fail("Template already exists", 409)
            
            # Validate and upload image
            filename = get_utility_service().secure_filename(image.filename)
            if "." not in filename:
                return ServiceResult.fail("Invalid image format", 400)
            
            file_extension = filename.rsplit(".", 1)[1].lower()
            if file_extension not in self.ALLOWED_IMAGE_EXTENSIONS:
                return ServiceResult.fail(
                    f"Invalid image format. Allowed: {', '.join(self.ALLOWED_IMAGE_EXTENSIONS)}",
                    400
                )
            
            # Upload to storage
            icon_filename = f"{uuid.uuid4()}.{file_extension}"
            icon_file_path = f"templates/{icon_filename}"
            
            image.seek(0, os.SEEK_END)
            file_size = image.tell()
            image.seek(0)
            
            self.storage.put_object(
                Config.BUCKET_NAME,
                icon_file_path,
                image,
                length=file_size
            )
            
            image_url = f"{Config.MINIO_ENDPOINT}/{Config.BUCKET_NAME}/{icon_file_path}"
            
            # Create template record
            new_template = {
                "template_name": template_name,
                "prompt": prompt,
                "description": description,
                "image_url": image_url,
                "image_file_path": icon_file_path,
                "created_by": identity,
                "created_at": datetime.utcnow(),
            }
            
            self.db.insert_one(new_template)
            self.log_operation("create_template", template_name=template_name, creator=identity)
            
            return ServiceResult.ok({
                "message": "Template created successfully",
                "template_name": template_name,
                "prompt": prompt,
                "description": description,
                "image_url": image_url,
            }, 201)
            
        except Exception as e:
            self.logger.error(f"Error creating template: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def list(self, include_images: bool = True) -> ServiceResult:
        """
        List all available templates.
        
        Args:
            include_images: Whether to include base64 encoded images
            
        Returns:
            ServiceResult with list of templates
        """
        try:
            templates = list(self.db.find({}, {"_id": 0}))
            
            if not templates:
                return ServiceResult.ok({
                    "message": "No templates found",
                    "templates": []
                })
            
            # Fetch images if requested
            if include_images:
                for template in templates:
                    image_path = template.get("image_file_path") or template.get("image_url", "").split("/")[-1]
                    if image_path:
                        try:
                            if not image_path.startswith("templates/"):
                                image_path = f"templates/{image_path}"
                            
                            response = self.storage.get_object(Config.BUCKET_NAME, image_path)
                            image_data = response.read()
                            template["image_base64"] = base64.b64encode(image_data).decode("utf-8")
                        except Exception:
                            template["image_base64"] = None
                    else:
                        template["image_base64"] = None
            
            return ServiceResult.ok({
                "message": "Templates retrieved successfully",
                "templates": templates,
            })
            
        except Exception as e:
            self.logger.error(f"Error listing templates: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def get(self, template_name: str) -> ServiceResult:
        """
        Get a specific template by name.
        
        Args:
            template_name: Template name to retrieve
            
        Returns:
            ServiceResult with template details
        """
        try:
            template = self.db.find_one({"template_name": template_name}, {"_id": 0})
            
            if not template:
                return ServiceResult.fail("Template not found", 404)
            
            return ServiceResult.ok(template)
            
        except Exception as e:
            self.logger.error(f"Error getting template: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def delete(self, identity: str, template_name: str) -> ServiceResult:
        """
        Delete a template.
        
        Args:
            identity: User's identity
            template_name: Template to delete
            
        Returns:
            ServiceResult with success/error
        """
        try:
            template = self.db.find_one({"template_name": template_name})
            
            if not template:
                return ServiceResult.fail("Template not found", 404)
            
            # Only creator can delete
            if template.get("created_by") != identity:
                return ServiceResult.fail("Only the creator can delete this template", 403)
            
            # Delete image from storage
            image_path = template.get("image_file_path")
            if image_path:
                try:
                    self.storage.remove_object(Config.BUCKET_NAME, image_path)
                except Exception as e:
                    self.logger.warning(f"Failed to delete template image: {e}")
            
            # Delete template record
            self.db.delete_one({"template_name": template_name})
            self.log_operation("delete_template", template_name=template_name, deleter=identity)
            
            return ServiceResult.ok({"message": "Template deleted successfully"})
            
        except Exception as e:
            self.logger.error(f"Error deleting template: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)


# Singleton instance
_template_service_instance: Optional[TemplateService] = None


def get_template_service() -> TemplateService:
    """Get or create the template service singleton."""
    global _template_service_instance
    if _template_service_instance is None:
        _template_service_instance = TemplateService()
    return _template_service_instance
