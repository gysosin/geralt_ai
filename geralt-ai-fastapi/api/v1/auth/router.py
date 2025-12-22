"""
Authentication Router

Handles user authentication, registration, and Microsoft OAuth.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from api.v1.auth.schemas import (
    LoginRequest,
    RegisterRequest,
    AuthResponse,
    UserInfo,
)
from core.security.jwt import get_current_user_with_claims
from core.config import settings
from services.users.auth_service import AuthService, get_auth_service
from services.users.microsoft_auth_service import MicrosoftAuthService, get_microsoft_auth_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/register", response_model=AuthResponse)
async def register(
    request: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Register a new user.
    """
    result = auth_service.register(
        username=request.username,
        email=request.email,
        password=request.password,
        firstname=request.firstname,
        lastname=request.lastname,
        role="user"
    )
    
    if not result.success:
        raise HTTPException(
            status_code=result.status_code,
            detail=result.error or "Registration failed"
        )
    
    return AuthResponse(
        message=result.data.get("message", "User registered successfully"),
        status=result.status_code,
        user=UserInfo(
            email=request.email,
            username=request.username,
            role="user"
        )
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Login with email/username and password.
    """
    result = auth_service.login(
        identifier=request.email,  # Schema calls it email, but service supports username too
        password=request.password
    )
    
    if not result.success:
        raise HTTPException(
            status_code=result.status_code,
            detail=result.error or "Login failed"
        )
    
    # We might want to fetch user details to return them, or just the token
    # For now, following schema
    return AuthResponse(
        message="Login successful",
        status=200,
        token=result.data.get("access_token")
    )


@router.get("/login/microsoft")
async def microsoft_login(
    request: Request,
    ms_service: MicrosoftAuthService = Depends(get_microsoft_auth_service)
):
    """
    Redirect to Microsoft OAuth login.
    """
    # Construct callback URL dynamically or from settings
    redirect_uri = str(request.url_for("microsoft_callback"))
    
    # Ensure scheme is https in production if behind proxy
    if "localhost" not in redirect_uri and redirect_uri.startswith("http:"):
        redirect_uri = redirect_uri.replace("http:", "https:")

    result = ms_service.get_auth_url(redirect_uri=redirect_uri)
    
    if not result.success:
        raise HTTPException(
            status_code=result.status_code,
            detail=result.error
        )
        
    return RedirectResponse(url=result.data["auth_url"])


@router.get("/callback", name="microsoft_callback")
async def microsoft_callback(
    code: str,
    request: Request,
    ms_service: MicrosoftAuthService = Depends(get_microsoft_auth_service)
):
    """
    Handle Microsoft OAuth callback.
    """
    redirect_uri = str(request.url_for("microsoft_callback"))
    
    if "localhost" not in redirect_uri and redirect_uri.startswith("http:"):
        redirect_uri = redirect_uri.replace("http:", "https:")
        
    result = ms_service.acquire_token(code=code, redirect_uri=redirect_uri)
    
    if not result.success:
        raise HTTPException(
            status_code=result.status_code,
            detail=result.error
        )
    
    # Redirect to frontend with token
    frontend_url = f"{settings.BOT_EMBED_URL}/auth/callback?token={result.data['token']}"
    return RedirectResponse(url=frontend_url)


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: dict = Depends(get_current_user_with_claims)):
    """
    Get current authenticated user details.
    """
    return UserInfo(
        username=current_user["username"],
        email=current_user["claims"].get("email", ""), # Might be missing if not in token
        tenant_id=current_user.get("tenant_id"),
        role=current_user.get("role")
    )
