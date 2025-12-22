"""
Bot Schemas

Pydantic models for bot management request/response validation.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class BotTokenCreate(BaseModel):
    """Request to create a new bot token."""
    name: str = Field(min_length=1)
    tenant_id: str
    collection_ids: List[str] = Field(default_factory=list)
    prompt: Optional[str] = None
    theme: Optional[str] = None
    description: Optional[str] = None
    ui_actions: Optional[List[dict]] = None


class BotTokenUpdate(BaseModel):
    """Request to update a bot token."""
    bot_token: str
    tenant_id: str
    name: Optional[str] = None
    collection_ids: Optional[List[str]] = None
    prompt: Optional[str] = None
    theme: Optional[str] = None
    description: Optional[str] = None
    ui_actions: Optional[List[dict]] = None


class BotTokenResponse(BaseModel):
    """Bot token response."""
    bot_token: str
    name: str
    created_at: Optional[datetime] = None
    collection_ids: List[str] = Field(default_factory=list)
    theme: Optional[str] = None
    description: Optional[str] = None
    
    model_config = {"from_attributes": True}


class BotTokenDelete(BaseModel):
    """Request to delete a bot token."""
    bot_token: str
    tenant_id: str


class ShareBotRequest(BaseModel):
    """Request to share a bot with another user."""
    bot_token: str
    user: str
    role: str = "read-only"
    tenant_id: Optional[str] = None


class SearchRequest(BaseModel):
    """RAG search request."""
    query: str = Field(min_length=1)
    bot_token: Optional[str] = None
    conversation_id: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=20)


class SearchResponse(BaseModel):
    """RAG search response."""
    answer: str
    sources: List[dict] = Field(default_factory=list)
    conversation_id: Optional[str] = None
    suggestions: Optional[List[str]] = None


class EmbedCodeCreate(BaseModel):
    """Request to create embed code."""
    bot_token: str
    tenant_id: str
    expiry_date: Optional[str] = None


class EmbedCodeResponse(BaseModel):
    """Embed code response."""
    embed_code: str
    secret_key: str
    expires_at: Optional[datetime] = None
