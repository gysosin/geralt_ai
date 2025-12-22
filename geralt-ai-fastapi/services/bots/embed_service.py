"""
Embed Code Service

Handles bot embed code generation, retrieval, and deletion.
Extracted from bot_management_service.py for single responsibility.
"""
import secrets
from datetime import datetime, timedelta
from typing import Optional

from config import Config
from models.database import tokens_collection, embed_code_collection
from services.bots import BaseService, ServiceResult


class EmbedService(BaseService):
    """
    Service for managing bot embed codes.
    
    Responsibilities:
    - Generate iframe embed codes
    - Retrieve embed codes for a bot
    - Delete/expire embed codes
    """
    
    EXPIRY_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
    
    def __init__(self):
        super().__init__()
        self.tokens_db = tokens_collection
        self.embed_db = embed_code_collection
    
    def generate(
        self,
        bot_token: str,
        tenant_id: str,
        expiry_date_str: Optional[str] = None
    ) -> ServiceResult:
        """
        Generate an embed code for a bot.
        
        Args:
            bot_token: Bot token to generate embed for
            tenant_id: Tenant ID
            expiry_date_str: Optional expiry date (format: YYYY-MM-DD HH:MM:SS)
            
        Returns:
            ServiceResult with embed code and secret token
        """
        try:
            bot_embed_env_url = Config.BOT_EMBED_ENV_URL
            
            if not bot_token or not bot_embed_env_url:
                return ServiceResult.fail(
                    "Bot token and embed environment URL are required", 
                    400
                )
            
            # Verify bot exists
            token_record = self.tokens_db.find_one({
                "bot_token": bot_token,
                "tenant_id": tenant_id
            })
            if not token_record:
                return ServiceResult.fail("Invalid bot token", 403)
            
            # Generate secret token
            secret_token = secrets.token_urlsafe(32)
            
            # Parse expiry date
            if expiry_date_str:
                try:
                    expiry_date = datetime.strptime(expiry_date_str, self.EXPIRY_DATE_FORMAT)
                except ValueError:
                    return ServiceResult.fail(
                        f"Invalid expiry date format. Use '{self.EXPIRY_DATE_FORMAT}'.",
                        400
                    )
            else:
                expiry_date = datetime.utcnow() + timedelta(days=1)
            
            expiry_date_utc = expiry_date.strftime(self.EXPIRY_DATE_FORMAT)
            
            # Construct embed URL
            embed_url = (
                f"{bot_embed_env_url}/embed/conversation?bot_token={bot_token}"
                f"&secret_token={secret_token}&expiry_date={expiry_date_utc}"
            )
            
            # Create iframe embed code
            embed_code = f'''<iframe src="{embed_url}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>'''
            
            # Store embed code
            embed_data = {
                "embed_code": embed_code,
                "secret_token": secret_token,
                "expiry_date": expiry_date_utc,
                "created_at": datetime.utcnow(),
            }
            
            embed_record = self.embed_db.find_one({
                "bot_token": bot_token,
                "tenant_id": tenant_id
            })
            
            if embed_record:
                self.embed_db.update_one(
                    {"bot_token": bot_token, "tenant_id": tenant_id},
                    {"$push": {"embed_codes": embed_data}}
                )
            else:
                self.embed_db.insert_one({
                    "bot_token": bot_token,
                    "tenant_id": tenant_id,
                    "embed_codes": [embed_data],
                })
            
            self.log_operation("generate_embed", bot_token=bot_token, expiry=expiry_date_utc)
            
            return ServiceResult.ok({
                "message": "Embed code generated successfully",
                "embed_code": embed_code,
                "secret_token": secret_token,
                "expiry_date": expiry_date_utc,
            }, 201)
            
        except Exception as e:
            self.logger.error(f"Error generating embed code: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def get(self, bot_token: str) -> ServiceResult:
        """
        Get all embed codes for a bot.
        
        Args:
            bot_token: Bot token
            
        Returns:
            ServiceResult with list of embed codes
        """
        try:
            if not bot_token:
                return ServiceResult.fail("Bot token is required", 400)
            
            embed_record = self.embed_db.find_one({"bot_token": bot_token})
            
            if not embed_record or not embed_record.get("embed_codes"):
                return ServiceResult.fail("No embed codes found for this bot token", 404)
            
            embed_codes = [
                {
                    "embed_code": embed["embed_code"],
                    "secret_token": embed["secret_token"],
                    "expiry_date": embed["expiry_date"],
                }
                for embed in embed_record["embed_codes"]
            ]
            
            return ServiceResult.ok({
                "message": "Embed codes fetched successfully",
                "embed_codes": embed_codes,
            })
            
        except Exception as e:
            self.logger.error(f"Error getting embed codes: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    def delete(self, bot_token: str, secret_token: str) -> ServiceResult:
        """
        Delete an embed code by its secret token.
        
        Args:
            bot_token: Bot token
            secret_token: Secret token of embed to delete
            
        Returns:
            ServiceResult with success/error
        """
        try:
            if not bot_token or not secret_token:
                return ServiceResult.fail("Bot token and secret key are required", 400)
            
            # Verify bot exists
            token_record = self.tokens_db.find_one({"bot_token": bot_token})
            if not token_record:
                return ServiceResult.fail("Invalid bot token", 403)
            
            embed_record = self.embed_db.find_one({"bot_token": bot_token})
            if not embed_record:
                return ServiceResult.fail("No embed code found for this bot", 404)
            
            # Find matching embed code
            matched_embed = None
            for embed in embed_record.get("embed_codes", []):
                if embed.get("secret_token") == secret_token:
                    matched_embed = embed
                    break
            
            if not matched_embed:
                return ServiceResult.fail("Invalid secret key for this bot token", 403)
            
            # Check expiry
            expiry_date = matched_embed.get("expiry_date")
            if expiry_date:
                expiry_dt = datetime.strptime(expiry_date, self.EXPIRY_DATE_FORMAT)
                if expiry_dt < datetime.utcnow():
                    return ServiceResult.fail("Secret key has expired", 410)
            
            # Delete the embed code
            self.embed_db.update_one(
                {"bot_token": bot_token},
                {"$pull": {"embed_codes": {"secret_token": secret_token}}}
            )
            
            self.log_operation("delete_embed", bot_token=bot_token)
            
            return ServiceResult.ok({"message": "Embed code deleted successfully"})
            
        except Exception as e:
            self.logger.error(f"Error deleting embed code: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)


# Singleton instance
_embed_service_instance: Optional[EmbedService] = None


def get_embed_service() -> EmbedService:
    """Get or create the embed code service singleton."""
    global _embed_service_instance
    if _embed_service_instance is None:
        _embed_service_instance = EmbedService()
    return _embed_service_instance
