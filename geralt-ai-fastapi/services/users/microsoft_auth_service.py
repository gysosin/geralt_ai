"""
Microsoft SSO Service

Handles Microsoft Azure AD authentication.
"""
from typing import Dict, Optional
from datetime import timedelta

from msal import ConfidentialClientApplication

from config import Config
from core.security.jwt import create_access_token
from models.database import users_collection
from services.bots import BaseService, ServiceResult


class MicrosoftAuthService(BaseService):
    """
    Service for Microsoft Azure AD SSO.
    
    Responsibilities:
    - Generate Microsoft auth URL
    - Acquire tokens by authorization code
    - Create/update user from SSO claims
    """
    
    def __init__(self):
        super().__init__()
        self.db = users_collection
        self.msal_app = ConfidentialClientApplication(
            Config.AZURE_CLIENT_ID,
            authority=f"https://login.microsoftonline.com/{Config.AZURE_TENANT_ID}",
            client_credential=Config.AZURE_CLIENT_SECRET,
        )
    
    def get_auth_url(self, redirect_uri: str) -> ServiceResult:
        """
        Get Microsoft authorization URL.
        
        Args:
            redirect_uri: Callback URL
            
        Returns:
            ServiceResult with auth URL
        """
        try:
            auth_url = self.msal_app.get_authorization_request_url(
                Config.SCOPE,
                redirect_uri=redirect_uri
            )
            return ServiceResult.ok({"auth_url": auth_url})
        except Exception as e:
            self.logger.error(f"Error getting auth URL: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def acquire_token(self, code: str, redirect_uri: str) -> ServiceResult:
        """
        Acquire token by authorization code and create/update user.
        
        Args:
            code: Authorization code from Microsoft
            redirect_uri: Callback URL
            
        Returns:
            ServiceResult with JWT token
        """
        try:
            result = self.msal_app.acquire_token_by_authorization_code(
                code,
                scopes=Config.SCOPE,
                redirect_uri=redirect_uri,
            )
            
            if "error" in result:
                return ServiceResult.fail(f"Authorization failed: {result.get('error_description')}", 401)
            
            user_info = result.get("id_token_claims")
            if not user_info:
                return ServiceResult.fail("User info not found", 401)
            
            # Extract user details
            email = user_info.get("preferred_username")
            fullname = user_info.get("name", "")
            firstname, lastname = fullname.split(" ", 1) if " " in fullname else (fullname, "")
            username = email.split("@")[0]
            
            # Find or create user
            user = self.db.find_one({"email": email})
            if not user:
                self.db.insert_one({
                    "username": username,
                    "email": email,
                    "password": "",  # No password for SSO users
                    "firstname": firstname,
                    "lastname": lastname,
                    "role": "user",
                })
                user = self.db.find_one({"email": email})
                self.log_operation("sso_register", username=username)
            else:
                self.log_operation("sso_login", username=username)
            
            # Generate JWT token
            token_payload = {
                "UserName": user["username"],
                "FullName": f"{user['firstname']} {user['lastname']}",
                "UserType": user.get("role", "user"),
                "tenant_id": user.get("tenant_id"),
            }
            
            access_token = create_access_token(
                data=token_payload,
                expires_delta=timedelta(hours=8)
            )
            
            return ServiceResult.ok({"token": access_token})
            
        except Exception as e:
            self.logger.error(f"Error acquiring token: {e}")
            return ServiceResult.fail(str(e), 500)


# Singleton instance
_microsoft_auth_service_instance: Optional[MicrosoftAuthService] = None


def get_microsoft_auth_service() -> MicrosoftAuthService:
    """Get or create the Microsoft auth service singleton."""
    global _microsoft_auth_service_instance
    if _microsoft_auth_service_instance is None:
        _microsoft_auth_service_instance = MicrosoftAuthService()
    return _microsoft_auth_service_instance
