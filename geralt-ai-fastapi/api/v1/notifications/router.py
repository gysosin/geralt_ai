"""
Notifications API Router

Endpoints for managing user notifications.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.v1.notifications.schemas import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
    MarkReadResponse,
    DeleteResponse,
)
from core.security.jwt import get_current_user
from services.notifications import get_notification_service

router = APIRouter()


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(default=50, ge=1, le=100, description="Maximum notifications to return"),
    skip: int = Query(default=0, ge=0, description="Number of notifications to skip"),
    unread_only: bool = Query(default=False, description="Only return unread notifications"),
    current_user: str = Depends(get_current_user),
):
    """
    List notifications for the current user.
    
    Returns paginated list of notifications with unread count.
    Ordered by creation date (newest first).
    """
    service = get_notification_service()
    
    notifications = service.list_for_user(
        user_id=current_user,
        limit=limit,
        skip=skip,
        unread_only=unread_only
    )
    
    unread_count = service.get_unread_count(current_user)
    
    return NotificationListResponse(
        notifications=notifications,
        total=len(notifications),
        unread_count=unread_count
    )


@router.get("/unread", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: str = Depends(get_current_user),
):
    """
    Get the count of unread notifications.
    
    Lightweight endpoint for updating notification badges.
    """
    service = get_notification_service()
    count = service.get_unread_count(current_user)
    return UnreadCountResponse(count=count)


@router.put("/{notification_id}/read", response_model=MarkReadResponse)
async def mark_notification_read(
    notification_id: str,
    current_user: str = Depends(get_current_user),
):
    """
    Mark a single notification as read.
    
    Args:
        notification_id: ID of the notification to mark as read
    """
    service = get_notification_service()
    success = service.mark_read(notification_id, current_user)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Notification not found or already read"
        )
    
    return MarkReadResponse(success=True, marked_count=1)


@router.put("/read-all", response_model=MarkReadResponse)
async def mark_all_notifications_read(
    current_user: str = Depends(get_current_user),
):
    """
    Mark all notifications as read for the current user.
    """
    service = get_notification_service()
    marked_count = service.mark_all_read(current_user)
    
    return MarkReadResponse(success=True, marked_count=marked_count)


@router.delete("/{notification_id}", response_model=DeleteResponse)
async def delete_notification(
    notification_id: str,
    current_user: str = Depends(get_current_user),
):
    """
    Delete a notification.
    
    Args:
        notification_id: ID of the notification to delete
    """
    service = get_notification_service()
    deleted = service.delete_notification(notification_id, current_user)
    
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )
    
    return DeleteResponse(success=True, deleted=True)
