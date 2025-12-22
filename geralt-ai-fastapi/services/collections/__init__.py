"""
Collections Service Package

OOP refactored services for collection and document management.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from datetime import datetime
import logging

from pydantic import BaseModel


class ServiceResult(BaseModel):
    """Standardized service response wrapper."""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    status_code: int = 200
    
    @classmethod
    def ok(cls, data: Any = None, status_code: int = 200) -> "ServiceResult":
        return cls(success=True, data=data, status_code=status_code)
    
    @classmethod
    def fail(cls, error: str, status_code: int = 400) -> "ServiceResult":
        return cls(success=False, error=error, status_code=status_code)


class BaseService(ABC):
    """Abstract base class for all services."""
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @staticmethod
    def extract_username(identity: str) -> str:
        return identity.split("@")[0] if "@" in identity else identity
    
    def log_operation(self, operation: str, **kwargs) -> None:
        self.logger.info(f"{operation}: {kwargs}")


# Service getters
def get_collection_service():
    """Get the collection service."""
    from services.collections.collection_service import get_collection_service as _get
    return _get()

def get_document_service():
    """Get the document service."""
    from services.collections.document_service import get_document_service as _get
    return _get()

def get_sharing_service():
    """Get the collection sharing service."""
    from services.collections.sharing_service import get_sharing_service as _get
    return _get()

# Import classes for direct usage in type hinting or tests
from services.collections.collection_service import CollectionService
from services.collections.document_service import DocumentService
from services.collections.sharing_service import CollectionSharingService


__all__ = [
    "ServiceResult",
    "BaseService",
    "get_collection_service",
    "get_document_service",
    "get_sharing_service",
    "CollectionService",
    "DocumentService",
    "CollectionSharingService",
]
