"""
Collection Processing Tasks

Celery tasks for collection deletion.
"""
import logging

from core.tasks import celery_app
from core.tasks.document_tasks import background_delete_document_task
from models.database import document_collection, collection_collection, tokens_collection
from helpers.socketio_instance import socketio
from helpers.cache_invalidation import invalidate_collections_cache


class CollectionDeleter:
    """
    Handles collection deletion operations.
    
    Responsibilities:
    - Delete all documents in collection
    - Remove collection entry
    - Update token references
    """
    
    def __init__(self, collection_id: str, username: str):
        self.collection_id = collection_id
        self.username = username
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def delete(self) -> bool:
        """Delete the collection and all its documents."""
        try:
            self._emit("Deletion initiated", 0)
            
            # Find all documents in collection
            docs = list(document_collection.find(
                {
                    "collection_id": self.collection_id,
                    "$or": [{"type": "document"}, {"type": {"$exists": False}}],
                },
                {"_id": 1}
            ))
            
            doc_ids = [d["_id"] for d in docs]
            total_docs = len(doc_ids)
            
            if total_docs == 0:
                self._delete_collection_entry()
                self._emit("No documents found. Deletion complete.", 100)
                return True
            
            self._emit(f"Found {total_docs} documents to delete", 10)
            
            # Delete each document
            progress_step = 80 / total_docs
            current_progress = 10
            
            for idx, doc_id in enumerate(doc_ids, start=1):
                socketio.emit("deletion_update", {
                    "document_id": doc_id,
                    "status": "Deletion started",
                    "progress": 0
                })
                
                # Queue document deletion
                background_delete_document_task.delay(doc_id, self.username)
                
                current_progress += progress_step
                self._emit(
                    f"Deleting documents ({idx}/{total_docs})",
                    min(int(current_progress), 90)
                )
            
            # Delete collection entry
            self._delete_collection_entry()
            self._emit("Collection deletion completed", 100)
            return True
            
        except Exception as e:
            self.logger.error(f"Error deleting collection: {e}")
            socketio.emit("collection_deletion_error", {
                "collection_id": self.collection_id,
                "error": str(e)
            })
            return False
    
    def _delete_collection_entry(self):
        """Delete the collection entry from MongoDB."""
        try:
            collection_collection.delete_one({"collection_id": self.collection_id})
            invalidate_collections_cache(self.username)
            
            # Update token references
            tokens_collection.update_many(
                {"created_by": self.username},
                {"$pull": {"collection_ids": self.collection_id}}
            )
        except Exception as e:
            self.logger.error(f"Error deleting collection entry: {e}")
    
    def _emit(self, status: str, progress: int):
        """Emit collection deletion status."""
        socketio.emit("collection_deletion_update", {
            "collection_id": self.collection_id,
            "status": status,
            "progress": progress,
        })


# Celery task wrapper
@celery_app.task
def background_delete_collection_task(collection_id, username):
    """Celery task for collection deletion."""
    deleter = CollectionDeleter(collection_id, username)
    return deleter.delete()
