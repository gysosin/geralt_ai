"""
Collections Router

Handles document collection CRUD and document management.
"""
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query, UploadFile, File, Body
from starlette.datastructures import UploadFile as StarletteUploadFile

from api.deps import get_current_user
from api.v1.collections.schemas import (
    CollectionCreate,
    CollectionUpdate,
    CollectionResponse,
    ShareCollectionRequest,
    DocumentListRequest,
    ProcessDocumentRequest,
    DeleteDocumentsRequest,
    RemoveSharedUserRequest,
)
from core.security.jwt import get_current_user, get_current_user_with_claims
from services.collections.collection_service import CollectionService, get_collection_service
from services.collections.document_service import DocumentService, get_document_service
from services.collections.sharing_service import CollectionSharingService, get_sharing_service as get_collection_sharing_service

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Collection Routes
# =============================================================================

@router.post("/", response_model=Dict[str, Any])
async def create_collection(
    data: CollectionCreate,
    # Service expects jwt_data to extract FullName. We pass the full claims.
    user_context: Dict = Depends(get_current_user_with_claims),
    service: CollectionService = Depends(get_collection_service),
):
    """Create a new collection."""
    # user_context from get_current_user_with_claims returns {"username": "...", "claims": {...}}
    # Service expects 'identity' string and optional 'jwt_data' dict.
    
    # We map 'claims' to 'jwt_data' structure expected by service (if it relies on specific keys)
    # Service uses jwt_data.get("FullName")
    
    # In token creation (AuthService), we put "FullName" in additional_claims.
    # So user_context["claims"] should have it.
    
    result = service.create(
        identity=user_context["username"],
        collection_name=data.name,
        tenant_id=data.tenant_id,
        jwt_data=user_context["claims"]
    )
    
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# =============================================================================
# Storage Stats Route
# =============================================================================

@router.get("/stats", response_model=Dict[str, Any])
async def get_storage_stats(
    tenant_id: str = Query(..., description="Tenant ID"),
    user_context: Dict = Depends(get_current_user_with_claims),
):
    """Get storage and vector database statistics with role-based limits."""
    from services.storage_stats_service import get_storage_stats_service
    service = get_storage_stats_service()
    result = service.get_stats(
        tenant_id=tenant_id, 
        identity=user_context["username"],
        jwt_data=user_context.get("claims", {})
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to get stats"))
    return result["data"]


@router.get("/", response_model=List[Dict[str, Any]])
async def list_collections(
    tenant_id: str = Query(..., description="Tenant ID"),
    current_user: str = Depends(get_current_user),
    service: CollectionService = Depends(get_collection_service),
):
    """List user's collections."""
    result = service.list(current_user, tenant_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/{collection_id}", response_model=Dict[str, Any])
async def get_collection(
    collection_id: str,
    current_user: str = Depends(get_current_user),
    service: CollectionService = Depends(get_collection_service),
):
    """Get collection details."""
    result = service.get(current_user, collection_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.put("/", response_model=Dict[str, Any])
async def update_collection(
    data: CollectionUpdate,
    current_user: str = Depends(get_current_user),
    service: CollectionService = Depends(get_collection_service),
):
    """Update a collection."""
    # Assuming update uses the new method I added
    result = service.update(
        identity=current_user,
        collection_id=data.collection_id,
        new_name=data.name,
        tenant_id=data.tenant_id
    )
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# DELETE /documents must come BEFORE /{collection_id} to avoid route conflict
@router.delete("/documents", response_model=Dict[str, Any])
async def delete_documents(
    data: DeleteDocumentsRequest = Body(...),
    current_user: str = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    """Delete multiple documents."""
    result = service.delete(current_user, data.document_ids, data.collection_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.delete("/{collection_id}", response_model=Dict[str, Any])
async def delete_collection(
    collection_id: str,
    current_user: str = Depends(get_current_user),
    service: CollectionService = Depends(get_collection_service),
):
    """Delete a collection."""
    result = service.delete(current_user, collection_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# =============================================================================
# Document Routes
# =============================================================================

@router.post("/upload", response_model=Dict[str, Any])
async def upload_documents(
    request: Request,
    user_context: Dict = Depends(get_current_user_with_claims),
    service: DocumentService = Depends(get_document_service),
):
    """
    Upload documents to a collection.
    Expects multipart/form-data with 'files', 'urls' (list), 'collection_id', 'conversation_id'.
    """
    form = await request.form()
    
    collection_id = form.get("collection_id")
    conversation_id = form.get("conversation_id")
    urls = form.getlist("urls")
    
    # Extract UploadFile objects - check for both FastAPI and Starlette UploadFile
    files = []
    for item in form.getlist("files"):
        if isinstance(item, (UploadFile, StarletteUploadFile)) or type(item).__name__ == 'UploadFile':
            files.append(item)
    
    result = service.upload(
        identity=user_context["username"],
        collection_id=str(collection_id) if collection_id else None,
        files=files,
        urls=[str(u) for u in urls],
        conversation_id=str(conversation_id) if conversation_id else None,
        jwt_data=user_context["claims"]
    )
    
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.post("/process", response_model=Dict[str, Any])
async def process_document(
    request: Request,
    current_user: str = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    """Process an uploaded document."""
    # Expect JSON body with document_id
    try:
        data = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")
        
    document_id = data.get("document_id")
    
    result = service.process(current_user, document_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.post("/documents", response_model=List[Dict[str, Any]])
async def list_documents(
    data: DocumentListRequest,
    user_context: Dict = Depends(get_current_user_with_claims),
    service: DocumentService = Depends(get_document_service),
):
    """List documents in a collection."""
    result = service.list(
        identity=user_context["username"],
        collection_id=data.collection_id,
        unprocessed_only=data.unprocessed_only,
        added_by_only=data.added_by_only,
        jwt_data=user_context["claims"]
    )
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: str = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    """Download a document."""
    result = service.download(current_user, document_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    
    from fastapi.responses import Response
    return Response(
        content=result.data["content"],
        media_type=result.data["content_type"],
        headers={"Content-Disposition": f'attachment; filename="{result.data["filename"]}"'}
    )

@router.get("/documents/{document_id}/status")
async def get_document_status(
    document_id: str,
    current_user: str = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    """Get document processing status."""
    result = service.get_status(current_user, document_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# =============================================================================
# Sharing Routes
# =============================================================================

@router.post("/share", response_model=Dict[str, Any])
async def share_collection(
    data: ShareCollectionRequest,
    current_user: str = Depends(get_current_user),
    service: CollectionSharingService = Depends(get_collection_sharing_service),
):
    """Share collection with another user."""
    result = service.share(current_user, data.collection_id, data.user, data.role)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.get("/{collection_id}/shared-users", response_model=Dict[str, Any])
async def list_shared_users(
    collection_id: str,
    current_user: str = Depends(get_current_user),
    service: CollectionSharingService = Depends(get_collection_sharing_service),
):
    """List users collection is shared with."""
    result = service.list_shared_users(current_user, collection_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.post("/remove-shared-user", response_model=Dict[str, Any])
async def remove_shared_user(
    data: RemoveSharedUserRequest,
    current_user: str = Depends(get_current_user),
    service: CollectionSharingService = Depends(get_collection_sharing_service),
):
    """Remove a shared user."""
    result = service.remove_user(current_user, data.collection_id, data.shared_user)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

