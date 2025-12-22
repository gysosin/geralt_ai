"""
Core Tasks Package

OOP-based Celery task handlers.
"""
import logging

from celery import Celery
from config import Config


# Build Redis broker URL
if Config.REDIS_PASSWORD:
    redis_url = f"redis://:{Config.REDIS_PASSWORD}@{Config.REDIS_HOST}:{Config.REDIS_PORT}/0"
else:
    redis_url = f"redis://{Config.REDIS_HOST}:{Config.REDIS_PORT}/0"

# Configure Celery
celery_app = Celery("celery_tasks", broker=redis_url)
celery_app.conf.task_always_eager = False


def get_celery_app():
    """Get the Celery app instance."""
    return celery_app


# Import tasks to register them
from core.tasks.document_tasks import (
    background_process_document,
    background_delete_document_task,
)
from core.tasks.collection_tasks import background_delete_collection_task


__all__ = [
    "celery_app",
    "get_celery_app",
    "background_process_document",
    "background_delete_document_task",
    "background_delete_collection_task",
]
