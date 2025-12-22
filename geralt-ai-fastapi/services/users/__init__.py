"""
Users Service Package

OOP refactored services for user authentication and profile management.
"""
from services.bots import ServiceResult, BaseService


def get_auth_service():
    """Get the authentication service."""
    from services.users.auth_service import get_auth_service as _get
    return _get()


def get_profile_service():
    """Get the user profile service."""
    from services.users.profile_service import get_profile_service as _get
    return _get()


def get_microsoft_auth_service():
    """Get the Microsoft SSO service."""
    from services.users.microsoft_auth_service import get_microsoft_auth_service as _get
    return _get()


__all__ = [
    "ServiceResult",
    "BaseService",
    "get_auth_service",
    "get_profile_service",
    "get_microsoft_auth_service",
]
