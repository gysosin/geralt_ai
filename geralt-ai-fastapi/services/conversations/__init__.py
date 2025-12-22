"""
Conversations Service Package

OOP refactored services for conversation management.
"""
from services.bots import ServiceResult, BaseService


def get_conversation_service():
    """Get the conversation service."""
    from services.conversations.conversation_service import get_conversation_service as _get
    return _get()


__all__ = ["ServiceResult", "BaseService", "get_conversation_service"]
