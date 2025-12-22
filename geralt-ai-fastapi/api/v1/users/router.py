"""
Users Router

Complete user management endpoints including profile and tenants.
Migrated from Flask routes/user_management.py
"""
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel

from api.deps import get_current_user
from services.users.profile_service import ProfileService, get_profile_service
from services.users.tenant_service import TenantService, get_tenant_service

logger = logging.getLogger(__name__)

router = APIRouter()


class TenantCreate(BaseModel):
    company: str
    email: str


class ProfileUpdate(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    color_scheme: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    chat_model: Optional[str] = None
    embedding_model: Optional[str] = None


# =============================================================================
# Profile Routes
# =============================================================================

@router.get("/profile", response_model=Dict[str, Any])
async def get_profile(
    current_user: str = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    """Get current user profile."""
    result = service.get(current_user)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.put("/profile", response_model=Dict[str, Any])
async def update_profile(
    request: Request,
    current_user: str = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    """Update user profile."""
    # Handle multipart form data
    form_data = await request.form()
    data_dict = dict(form_data)
    
    profile_picture = None
    if "profile_picture" in data_dict and isinstance(data_dict["profile_picture"], UploadFile):
        profile_picture = data_dict["profile_picture"]
        
    result = service.update(current_user, data_dict, profile_picture)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.delete("/profile", response_model=Dict[str, Any])
async def delete_profile(
    current_user: str = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    """Delete user profile."""
    result = service.delete(current_user)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# =============================================================================
# Tenant Routes
# =============================================================================

@router.get("/tenants", response_model=List[Dict[str, Any]])
async def list_tenants(
    current_user: str = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
):
    """List user's tenants."""
    result = service.list(current_user)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.post("/tenants", response_model=Dict[str, Any])
async def create_tenant(
    data: TenantCreate,
    current_user: str = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
):
    """Create a new tenant."""
    result = service.create(current_user, data.model_dump())
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data
