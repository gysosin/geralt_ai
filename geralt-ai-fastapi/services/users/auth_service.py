"""
Authentication Service

Handles user registration and login.
"""
import datetime
from datetime import timedelta
from typing import Dict, Optional

from passlib.context import CryptContext

from config import Config
from core.security.jwt import create_access_token
from models.database import users_collection
from services.bots import BaseService, ServiceResult

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService(BaseService):
    """
    Service for user authentication.
    
    Responsibilities:
    - User registration
    - User login and JWT generation
    - Password validation
    """
    
    TOKEN_EXPIRY_HOURS = 8
    
    def __init__(self):
        super().__init__()
        self.db = users_collection
    
    def register(
        self,
        username: str,
        email: str,
        password: str,
        firstname: str,
        lastname: str,
        role: str = "user"
    ) -> ServiceResult:
        """
        Register a new user.
        
        Args:
            username: Unique username
            email: Unique email address
            password: Plain text password (will be hashed)
            firstname: User's first name
            lastname: User's last name
            role: User role (default: "user")
            
        Returns:
            ServiceResult with registration status
        """
        try:
            # Check if username or email exists
            existing = self.db.find_one({
                "$or": [{"username": username}, {"email": email}]
            })
            
            if existing:
                return ServiceResult.fail("Username or email already exists", 400)
            
            # Hash password and insert user
            hashed_password = pwd_context.hash(password)
            
            self.db.insert_one({
                "username": username,
                "email": email,
                "password": hashed_password,
                "firstname": firstname,
                "lastname": lastname,
                "role": role,
            })
            
            self.log_operation("register_user", username=username)
            
            return ServiceResult.ok({
                "message": "User registered successfully",
                "UserType": role,
            }, 201)
            
        except Exception as e:
            self.logger.error(f"Error registering user: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def login(self, identifier: str, password: str) -> ServiceResult:
        """
        Authenticate user and generate JWT token.
        
        Args:
            identifier: Username or email
            password: Plain text password
            
        Returns:
            ServiceResult with access token
        """
        try:
            # Find user by username or email
            user = self.db.find_one({
                "$or": [{"username": identifier}, {"email": identifier}]
            })
            
            if not user or not pwd_context.verify(password, user["password"]):
                return ServiceResult.fail("Invalid username/email or password", 401)
            
            # Generate JWT token
            token_payload = {
                "UserName": user["username"],
                "FullName": f"{user['firstname']} {user['lastname']}",
                "UserType": user.get("role", "user"),
                "tenant_id": user.get("tenant_id"), # Added tenant_id to token
            }
            
            access_token = create_access_token(
                data=token_payload,
                expires_delta=timedelta(hours=self.TOKEN_EXPIRY_HOURS)
            )
            
            self.log_operation("login_user", username=user["username"])
            
            return ServiceResult.ok({"access_token": access_token})
            
        except Exception as e:
            self.logger.error(f"Error during login: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def get_user_by_username(self, username: str) -> Optional[Dict]:
        """Get user by username."""
        return self.db.find_one({"username": username})


# Singleton instance
_auth_service_instance: Optional[AuthService] = None


def get_auth_service() -> AuthService:
    """Get or create the auth service singleton."""
    global _auth_service_instance
    if _auth_service_instance is None:
        _auth_service_instance = AuthService()
    return _auth_service_instance
