"""
Base Service Classes

Abstract base classes and common utilities for all service modules.
Provides consistent patterns for dependency injection, error handling, and logging.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple, TypeVar, Generic
from datetime import datetime
import logging

from pydantic import BaseModel


T = TypeVar('T')


class ServiceResult(BaseModel, Generic[T]):
    """
    Standardized service response wrapper.
    
    Usage:
        return ServiceResult(success=True, data={"bot_token": "..."})
        return ServiceResult(success=False, error="Not found", status_code=404)
    """
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    status_code: int = 200
    
    @classmethod
    def ok(cls, data: Any = None, status_code: int = 200) -> "ServiceResult":
        """Create a success result."""
        return cls(success=True, data=data, status_code=status_code)
    
    @classmethod
    def fail(cls, error: str, status_code: int = 400) -> "ServiceResult":
        """Create a failure result."""
        return cls(success=False, error=error, status_code=status_code)


class BaseService(ABC):
    """
    Abstract base class for all services.
    
    Provides:
    - Consistent logging
    - Common utility methods
    - Dependency injection pattern
    
    Usage:
        class BotTokenService(BaseService):
            def __init__(self, db: Database, storage: MinioClient):
                super().__init__()
                self.db = db
                self.storage = storage
    """
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @staticmethod
    def extract_username(identity: str) -> str:
        """Extract username from email identity."""
        return identity.split("@")[0] if "@" in identity else identity
    
    @staticmethod
    def serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
        """Convert datetime to ISO format string."""
        return dt.isoformat() if dt else None
    
    def log_operation(self, operation: str, **kwargs) -> None:
        """Log a service operation with context."""
        self.logger.info(f"{operation}: {kwargs}")


class CRUDMixin:
    """
    Mixin providing standard CRUD method signatures.
    Subclasses implement specific database operations.
    """
    
    @abstractmethod
    def create(self, identity: str, data: Dict[str, Any]) -> ServiceResult:
        """Create a new resource."""
        pass
    
    @abstractmethod
    def get(self, identity: str, resource_id: str) -> ServiceResult:
        """Retrieve a resource by ID."""
        pass
    
    @abstractmethod
    def list(self, identity: str, **filters) -> ServiceResult:
        """List resources with optional filters."""
        pass
    
    @abstractmethod
    def update(self, identity: str, resource_id: str, data: Dict[str, Any]) -> ServiceResult:
        """Update a resource."""
        pass
    
    @abstractmethod
    def delete(self, identity: str, resource_id: str) -> ServiceResult:
        """Delete a resource."""
        pass


# ============================================================================
# Service Getters (imported from individual modules)
# ============================================================================

def get_token_service():
    """Get the bot token service."""
    from services.bots.token_service import get_token_service as _get
    return _get()

def get_sharing_service():
    """Get the bot sharing service."""
    from services.bots.sharing_service import get_sharing_service as _get
    return _get()

def get_embed_service():
    """Get the embed code service."""
    from services.bots.embed_service import get_embed_service as _get
    return _get()

def get_template_service():
    """Get the template service."""
    from services.bots.template_service import get_template_service as _get
    return _get()

def get_search_service():
    """Get the bot search service."""
    from services.bots.search_service import get_search_service as _get
    return _get()

def get_quiz_service():
    """Get the quiz service."""
    from services.bots.quiz_service import get_quiz_service as _get
    return _get()

def get_analytics_service():
    """Get the analytics service."""
    from services.bots.analytics_service import get_analytics_service as _get
    return _get()

# Import classes for direct usage
from services.bots.token_service import BotTokenService
from services.bots.sharing_service import BotSharingService
from services.bots.search_service import BotSearchService
from services.bots.template_service import TemplateService
from services.bots.embed_service import EmbedService
from services.bots.quiz_service import QuizService
from services.bots.analytics_service import AnalyticsService


__all__ = [
    # Base classes
    "ServiceResult",
    "BaseService",
    "CRUDMixin",
    # Service classes
    "BotTokenService",
    "BotSharingService",
    "BotSearchService",
    "TemplateService",
    "EmbedService",
    "QuizService",
    "AnalyticsService",
    # Service getters
    "get_token_service",
    "get_sharing_service",
    "get_embed_service",
    "get_template_service",
    "get_search_service",
    "get_quiz_service",
    "get_analytics_service",
]
