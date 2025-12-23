"""
Notifications API Schemas

Pydantic models for notification endpoints.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field


class NotificationType(str, Enum):
    """Notification types."""
    DOCUMENT = "document"
    COLLECTION = "collection"
    CHAT = "chat"
    BOT = "bot"
    SYSTEM = "system"
    USER = "user"


class NotificationPriority(str, Enum):
    """Notification priorities."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationResponse(BaseModel):
    """Notification response model."""
    id: str
    type: NotificationType
    priority: NotificationPriority
    title: str
    message: str
    data: Dict[str, Any] = Field(default_factory=dict)
    read: bool = False
    created_at: str
    read_at: Optional[str] = None


class NotificationListResponse(BaseModel):
    """Response for listing notifications."""
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    """Response for unread count."""
    count: int


class MarkReadResponse(BaseModel):
    """Response for mark as read operations."""
    success: bool
    marked_count: int = 0


class DeleteResponse(BaseModel):
    """Response for delete operations."""
    success: bool
    deleted: bool = False
