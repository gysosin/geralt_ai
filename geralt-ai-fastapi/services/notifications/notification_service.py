"""
Notification Service

Unified service for emitting real-time notifications via SocketIO 
and persisting them to MongoDB.
"""
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Dict, Any, List
from uuid import uuid4

from helpers.socketio_instance import socketio
from models.database import db


class NotificationType(str, Enum):
    """Types of notifications."""
    DOCUMENT = "document"       # Document upload, processing, deletion
    COLLECTION = "collection"   # Collection create, delete, share
    CHAT = "chat"              # Chat/conversation events
    BOT = "bot"                # Bot token events
    SYSTEM = "system"          # System-wide announcements
    USER = "user"              # User account events


class NotificationPriority(str, Enum):
    """Notification priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


# MongoDB collection
notifications_collection = db.notifications


class NotificationService:
    """
    Unified notification service.
    
    Responsibilities:
    - Emit real-time notifications via SocketIO
    - Persist notifications to MongoDB
    - Manage notification state (read/unread)
    - Query notification history
    """
    
    _instance: Optional["NotificationService"] = None
    
    # Default TTL for notifications (30 days)
    DEFAULT_EXPIRY_DAYS = 30
    
    def __init__(self):
        """Initialize the notification service."""
        self.logger = logging.getLogger(self.__class__.__name__)
        self._socketio = socketio
        self._collection = notifications_collection
        self._ensure_indexes()
    
    @classmethod
    def get_instance(cls) -> "NotificationService":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def _ensure_indexes(self) -> None:
        """Ensure required indexes exist."""
        try:
            # Index for querying user notifications
            self._collection.create_index("user_id")
            # Index for TTL-based expiration
            self._collection.create_index("expires_at", expireAfterSeconds=0)
            # Compound index for user + read status
            self._collection.create_index([("user_id", 1), ("read", 1)])
        except Exception as e:
            self.logger.warning(f"Failed to create indexes: {e}")
    
    # =========================================================================
    # Core Notification Methods
    # =========================================================================
    
    def notify(
        self,
        user_id: str,
        type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        data: Optional[Dict[str, Any]] = None,
        persist: bool = True,
        expiry_days: Optional[int] = None
    ) -> Optional[str]:
        """
        Send a notification to a specific user.
        
        Args:
            user_id: Target user ID/email
            type: Notification type
            title: Short notification title
            message: Notification message body
            priority: Priority level
            data: Additional metadata
            persist: Whether to save to database
            expiry_days: Custom expiry (default 30 days)
        
        Returns:
            Notification ID if persisted, None otherwise
        """
        notification_id = str(uuid4())
        now = datetime.utcnow()
        
        notification = {
            "_id": notification_id,
            "user_id": user_id,
            "type": type.value,
            "priority": priority.value,
            "title": title,
            "message": message,
            "data": data or {},
            "read": False,
            "created_at": now,
        }
        
        if persist:
            days = expiry_days or self.DEFAULT_EXPIRY_DAYS
            notification["expires_at"] = now + timedelta(days=days)
            try:
                self._collection.insert_one(notification)
                self.logger.debug(f"Persisted notification {notification_id} for {user_id}")
            except Exception as e:
                self.logger.error(f"Failed to persist notification: {e}")
        
        # Emit via SocketIO
        self._emit_notification(user_id, notification)
        
        return notification_id if persist else None
    
    def notify_users(
        self,
        user_ids: List[str],
        type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        data: Optional[Dict[str, Any]] = None,
        persist: bool = True
    ) -> List[str]:
        """
        Send notification to multiple users.
        
        Args:
            user_ids: List of target user IDs
            type: Notification type
            title: Notification title
            message: Notification message
            priority: Priority level
            data: Additional metadata
            persist: Whether to persist
        
        Returns:
            List of notification IDs
        """
        notification_ids = []
        for user_id in user_ids:
            nid = self.notify(
                user_id=user_id,
                type=type,
                title=title,
                message=message,
                priority=priority,
                data=data,
                persist=persist
            )
            if nid:
                notification_ids.append(nid)
        return notification_ids
    
    def broadcast(
        self,
        type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        data: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Broadcast notification to all connected clients.
        
        Note: This does NOT persist - broadcasts are transient.
        
        Args:
            type: Notification type
            title: Notification title
            message: Notification message
            priority: Priority level
            data: Additional metadata
        """
        notification = {
            "id": str(uuid4()),
            "type": type.value,
            "priority": priority.value,
            "title": title,
            "message": message,
            "data": data or {},
            "created_at": datetime.utcnow().isoformat()
        }
        
        try:
            self._socketio.emit("notification_broadcast", notification)
            self.logger.debug(f"Broadcast notification: {title}")
        except Exception as e:
            self.logger.error(f"Failed to broadcast: {e}")
    
    # =========================================================================
    # Helper Notification Methods
    # =========================================================================
    
    def document_uploaded(self, user_id: str, document_name: str, collection_name: str) -> Optional[str]:
        """Notify user that document upload started."""
        return self.notify(
            user_id=user_id,
            type=NotificationType.DOCUMENT,
            title="Document Uploaded",
            message=f'"{document_name}" is being processed in {collection_name}.',
            priority=NotificationPriority.LOW,
            data={"document_name": document_name, "collection_name": collection_name}
        )
    
    def document_processed(self, user_id: str, document_name: str, success: bool = True, error: str = None) -> Optional[str]:
        """Notify user of document processing completion."""
        if success:
            return self.notify(
                user_id=user_id,
                type=NotificationType.DOCUMENT,
                title="Document Ready",
                message=f'"{document_name}" has been processed successfully.',
                priority=NotificationPriority.NORMAL,
                data={"document_name": document_name, "success": True}
            )
        else:
            return self.notify(
                user_id=user_id,
                type=NotificationType.DOCUMENT,
                title="Processing Failed",
                message=f'Failed to process "{document_name}". {error or ""}',
                priority=NotificationPriority.HIGH,
                data={"document_name": document_name, "success": False, "error": error}
            )
    
    def collection_created(self, user_id: str, collection_name: str, collection_id: str) -> Optional[str]:
        """Notify user of collection creation."""
        return self.notify(
            user_id=user_id,
            type=NotificationType.COLLECTION,
            title="Collection Created",
            message=f'Collection "{collection_name}" has been created.',
            priority=NotificationPriority.NORMAL,
            data={"collection_name": collection_name, "collection_id": collection_id}
        )
    
    def collection_deleted(self, user_id: str, collection_name: str) -> Optional[str]:
        """Notify user of collection deletion."""
        return self.notify(
            user_id=user_id,
            type=NotificationType.COLLECTION,
            title="Collection Deleted",
            message=f'Collection "{collection_name}" has been deleted.',
            priority=NotificationPriority.NORMAL,
            data={"collection_name": collection_name}
        )
    
    def collection_shared(self, user_id: str, collection_name: str, shared_by: str) -> Optional[str]:
        """Notify user that a collection was shared with them."""
        return self.notify(
            user_id=user_id,
            type=NotificationType.COLLECTION,
            title="Collection Shared",
            message=f'{shared_by} shared "{collection_name}" with you.',
            priority=NotificationPriority.NORMAL,
            data={"collection_name": collection_name, "shared_by": shared_by}
        )
    
    def bot_created(self, user_id: str, bot_name: str) -> Optional[str]:
        """Notify user of bot creation."""
        return self.notify(
            user_id=user_id,
            type=NotificationType.BOT,
            title="Bot Created",
            message=f'Bot "{bot_name}" has been created.',
            priority=NotificationPriority.NORMAL,
            data={"bot_name": bot_name}
        )
    
    # =========================================================================
    # State Management
    # =========================================================================
    
    def mark_read(self, notification_id: str, user_id: str) -> bool:
        """
        Mark a notification as read.
        
        Args:
            notification_id: Notification ID
            user_id: User ID (for authorization)
        
        Returns:
            True if updated, False otherwise
        """
        try:
            result = self._collection.update_one(
                {"_id": notification_id, "user_id": user_id},
                {"$set": {"read": True, "read_at": datetime.utcnow()}}
            )
            if result.modified_count > 0:
                self._socketio.emit("notification_read", {"id": notification_id}, room=user_id)
                return True
            return False
        except Exception as e:
            self.logger.error(f"Failed to mark notification as read: {e}")
            return False
    
    def mark_all_read(self, user_id: str) -> int:
        """
        Mark all notifications as read for a user.
        
        Args:
            user_id: User ID
        
        Returns:
            Number of notifications updated
        """
        try:
            result = self._collection.update_many(
                {"user_id": user_id, "read": False},
                {"$set": {"read": True, "read_at": datetime.utcnow()}}
            )
            return result.modified_count
        except Exception as e:
            self.logger.error(f"Failed to mark all as read: {e}")
            return 0
    
    def delete_notification(self, notification_id: str, user_id: str) -> bool:
        """
        Delete a notification.
        
        Args:
            notification_id: Notification ID
            user_id: User ID (for authorization)
        
        Returns:
            True if deleted, False otherwise
        """
        try:
            result = self._collection.delete_one(
                {"_id": notification_id, "user_id": user_id}
            )
            if result.deleted_count > 0:
                self._socketio.emit("notification_deleted", {"id": notification_id}, room=user_id)
                return True
            return False
        except Exception as e:
            self.logger.error(f"Failed to delete notification: {e}")
            return False
    
    # =========================================================================
    # Query Methods
    # =========================================================================
    
    def list_for_user(
        self,
        user_id: str,
        limit: int = 50,
        skip: int = 0,
        unread_only: bool = False
    ) -> List[Dict[str, Any]]:
        """
        List notifications for a user.
        
        Args:
            user_id: User ID
            limit: Maximum notifications to return
            skip: Number to skip (for pagination)
            unread_only: Only return unread notifications
        
        Returns:
            List of notification documents
        """
        try:
            query = {"user_id": user_id}
            if unread_only:
                query["read"] = False
            
            cursor = self._collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
            
            notifications = []
            for doc in cursor:
                doc["id"] = doc.pop("_id")
                doc["created_at"] = doc["created_at"].isoformat()
                if "read_at" in doc and doc["read_at"]:
                    doc["read_at"] = doc["read_at"].isoformat()
                notifications.append(doc)
            
            return notifications
        except Exception as e:
            self.logger.error(f"Failed to list notifications: {e}")
            return []
    
    def get_unread_count(self, user_id: str) -> int:
        """
        Get count of unread notifications for a user.
        
        Args:
            user_id: User ID
        
        Returns:
            Unread notification count
        """
        try:
            return self._collection.count_documents({"user_id": user_id, "read": False})
        except Exception as e:
            self.logger.error(f"Failed to count unread: {e}")
            return 0
    
    # =========================================================================
    # Private Methods
    # =========================================================================
    
    def _emit_notification(self, user_id: str, notification: Dict[str, Any]) -> None:
        """Emit notification to user via SocketIO."""
        # Prepare for JSON serialization
        emit_data = {
            "id": notification["_id"],
            "type": notification["type"],
            "priority": notification["priority"],
            "title": notification["title"],
            "message": notification["message"],
            "data": notification["data"],
            "created_at": notification["created_at"].isoformat()
        }
        
        try:
            # Emit to specific user room
            self._socketio.emit("notification", emit_data, room=user_id)
            self.logger.debug(f"Emitted notification to {user_id}: {notification['title']}")
        except Exception as e:
            self.logger.error(f"Failed to emit notification: {e}")


# Singleton access
_notification_service_instance: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    """Get or create the notification service singleton."""
    global _notification_service_instance
    if _notification_service_instance is None:
        _notification_service_instance = NotificationService()
    return _notification_service_instance
