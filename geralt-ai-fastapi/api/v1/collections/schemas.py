"""
Collections Schemas

Pydantic models for document collections.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class CollectionCreate(BaseModel):
    """Request to create a collection."""
    name: str = Field(min_length=1)
    description: Optional[str] = None
    tenant_id: str


class CollectionUpdate(BaseModel):
    """Request to update a collection."""
    collection_id: str
    tenant_id: str
    name: Optional[str] = None
    description: Optional[str] = None


class CollectionResponse(BaseModel):
    """Collection response."""
    collection_id: str
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    document_count: int = 0
    
    model_config = {"from_attributes": True}


class ShareCollectionRequest(BaseModel):
    """Request to share a collection."""
    collection_id: str
    user: str
    role: str = "read-only"


class DocumentUploadResponse(BaseModel):
    """Document upload response."""
    document_id: str
    filename: str
    status: str = "uploaded"


class ProcessDocumentRequest(BaseModel):
    """Request to process a document."""
    document_id: str
    collection_id: str


class DocumentListRequest(BaseModel):
    """Request to list documents."""
    collection_id: str
    unprocessed_only: bool = False
    added_by_only: bool = False


class DeleteDocumentsRequest(BaseModel):
    """Request to delete documents."""
    collection_id: str
    document_ids: List[str]


class RemoveSharedUserRequest(BaseModel):
    """Request to remove a shared user."""
    collection_id: str
    shared_user: str
