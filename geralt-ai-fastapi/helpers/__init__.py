"""
Helpers Package

OOP-refactored utility services and helper functions.
"""
from helpers.cache_invalidation import (
    CacheInvalidationService,
    get_cache_service,
    # Backwards compatible functions
    invalidate_collections_cache,
    invalidate_cache_for_private_documents,
    invalidate_cache_for_conversation,
    invalidate_cache_for_conversations_by_collection,
    invalidate_cache_for_conversations_by_user,
    invalidate_cache_for_search_with_collection_id,
    invalidate_cache_for_all_conversations,
    invalidate_cache_for_private_documents_by_username,
)

from helpers.status_updates import (
    StatusUpdateService,
    get_status_service,
    # Backwards compatible functions
    emit_status,
    update_document_status,
    _finalize_error,
)

from helpers.utils import (
    UtilityService,
    get_utility_service,
)


__all__ = [
    # OOP Classes
    "CacheInvalidationService",
    "StatusUpdateService",
    "UtilityService",
    # Service getters
    "get_cache_service",
    "get_status_service",
    "get_utility_service",
    # Backwards compatible cache functions
    "invalidate_collections_cache",
    "invalidate_cache_for_private_documents",
    "invalidate_cache_for_conversation",
    "invalidate_cache_for_conversations_by_collection",
    "invalidate_cache_for_conversations_by_user",
    "invalidate_cache_for_search_with_collection_id",
    "invalidate_cache_for_all_conversations",
    "invalidate_cache_for_private_documents_by_username",
    # Backwards compatible status functions
    "emit_status",
    "update_document_status",
    "_finalize_error",
]
