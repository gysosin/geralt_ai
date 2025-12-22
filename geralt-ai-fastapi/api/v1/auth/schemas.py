"""
Authentication Schemas

Pydantic models for auth request/response validation.
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Login request body."""
    email: EmailStr
    password: str = Field(min_length=1)


class RegisterRequest(BaseModel):
    """Registration request body."""
    username: str
    email: EmailStr
    password: str = Field(min_length=6)
    firstname: str
    lastname: str
    tenant_id: Optional[str] = None


class TokenResponse(BaseModel):
    """JWT token response."""
    token: str
    token_type: str = "bearer"
    expires_in: int


class UserInfo(BaseModel):
    """User information response."""
    email: str
    username: Optional[str] = None
    tenant_id: Optional[str] = None
    role: Optional[str] = None


class AuthResponse(BaseModel):
    """Authentication response."""
    message: str
    status: int = 200
    token: Optional[str] = None
    user: Optional[UserInfo] = None
