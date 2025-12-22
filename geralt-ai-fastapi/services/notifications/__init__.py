"""
Notification Service Package

Provides unified notification service for real-time and persistent notifications.
"""
from services.notifications.notification_service import (
    NotificationService,
    NotificationType,
    NotificationPriority,
    get_notification_service,
)

__all__ = [
    "NotificationService",
    "NotificationType",
    "NotificationPriority",
    "get_notification_service",
]
