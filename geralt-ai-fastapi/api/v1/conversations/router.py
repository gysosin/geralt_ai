"""
Conversations Router

Complete conversation management endpoints.
Migrated from Flask routes/conversations.py
"""
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from api.deps import get_current_user
from services.conversations.conversation_service import ConversationService, get_conversation_service

logger = logging.getLogger(__name__)

router = APIRouter()


class SearchWithConversationRequest(BaseModel):
    query: str
    conversation_id: Optional[str] = None
    collection_id: Optional[str] = None


# =============================================================================
# Conversation Routes
# =============================================================================

@router.post("/search", response_model=Dict[str, Any])
async def search_document_with_conversation(
    data: SearchWithConversationRequest,
    current_user: str = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
):
    """Search with conversation context."""
    result = await service.search(
        identity=current_user,
        query=data.query,
        collection_id=data.collection_id,
        conversation_id=data.conversation_id
    )
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.get("/", response_model=List[Dict[str, Any]])
async def get_all_conversations(
    current_user: str = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
):
    """Get all conversations for user."""
    result = service.list(current_user)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.get("/by-collection", response_model=List[Dict[str, Any]])
async def get_conversations_by_collection(
    collection_id: str = Query(...),
    current_user: str = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
):
    """Get conversations by collection."""
    result = service.list_by_collection(current_user, collection_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.get("/{conversation_id}", response_model=Dict[str, Any])
async def get_conversation(
    conversation_id: str,
    collection_id: Optional[str] = None,
    current_user: str = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
):
    """Get a specific conversation."""
    result = service.get(current_user, conversation_id, collection_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: str = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
):
    """Delete a conversation."""
    result = service.delete(current_user, conversation_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


@router.get("/search/public")
async def search_public_document(
    query: str = Query(...),
    collection_id: Optional[str] = None,
):
    """Search public documents."""
    raise HTTPException(status_code=501, detail="Public search not implemented yet")
