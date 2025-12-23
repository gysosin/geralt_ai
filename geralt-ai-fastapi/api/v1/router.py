"""
API v1 Router

Main router that aggregates all v1 endpoint routers.
"""
from fastapi import APIRouter

from api.v1.auth.router import router as auth_router
from api.v1.bots.router import router as bots_router
from api.v1.collections.router import router as collections_router
from api.v1.conversations.router import router as conversations_router
from api.v1.users.router import router as users_router
from api.v1.notifications.router import router as notifications_router

api_router = APIRouter()

# Include all sub-routers
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(bots_router, prefix="/bots", tags=["Bots"])
api_router.include_router(collections_router, prefix="/collections", tags=["Collections"])
api_router.include_router(conversations_router, prefix="/conversations", tags=["Conversations"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])

