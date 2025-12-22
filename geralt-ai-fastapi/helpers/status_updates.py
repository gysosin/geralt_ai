"""
Status Update Service

OOP-based service for emitting status updates via SocketIO and updating document status.
"""
import logging
from typing import Optional

from helpers.socketio_instance import socketio
from models.database import document_collection


class StatusUpdateService:
    """
    Service for managing document processing status updates.
    
    Provides methods to:
    - Emit real-time status updates via SocketIO
    - Update document status in the database
    - Handle error finalization
    """
    
    _instance: Optional["StatusUpdateService"] = None
    
    def __init__(self):
        """Initialize the status update service."""
        self.logger = logging.getLogger(self.__class__.__name__)
        self._socketio = socketio
        self._document_collection = document_collection
    
    @classmethod
    def get_instance(cls) -> "StatusUpdateService":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    # =========================================================================
    # SocketIO Status Emission
    # =========================================================================
    
    def emit_status(
        self,
        document_id: str,
        status: str,
        progress: int,
        error: Optional[str] = None
    ) -> None:
        """
        Emit a processing status update via SocketIO.
        
        Args:
            document_id: The document ID being processed
            status: Status message
            progress: Progress percentage (0-100)
            error: Optional error message
        """
        data = {
            "document_id": document_id,
            "status": status,
            "progress": progress
        }
        if error:
            data["error"] = error
        
        try:
            self._socketio.emit("processing_update", data)
            self.logger.debug(f"Emitted status for {document_id}: {status} ({progress}%)")
        except Exception as e:
            self.logger.error(f"Failed to emit status for {document_id}: {e}")
    
    # =========================================================================
    # Database Status Updates
    # =========================================================================
    
    def update_document_status(
        self,
        document_id: str,
        status: str,
        progress: int,
        error_message: Optional[str] = None
    ) -> bool:
        """
        Update document processing status in the database.
        
        Args:
            document_id: The document ID
            status: Status message
            progress: Progress percentage (0-100)
            error_message: Optional error message
            
        Returns:
            True if update was successful, False otherwise
        """
        update_data = {
            "latest_status": status,
            "progress": progress
        }
        
        if error_message:
            update_data["error_message"] = error_message
            update_data["status"] = "error"
            update_data["is_processing"] = False
        
        try:
            result = self._document_collection.update_one(
                {"_id": document_id},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            self.logger.error(f"Failed to update document status for {document_id}: {e}")
            return False
    
    # =========================================================================
    # Composite Operations
    # =========================================================================
    
    def update_and_emit(
        self,
        document_id: str,
        status: str,
        progress: int,
        error: Optional[str] = None
    ) -> None:
        """
        Update document status and emit via SocketIO.
        
        Args:
            document_id: The document ID
            status: Status message
            progress: Progress percentage (0-100)
            error: Optional error message
        """
        self.emit_status(document_id, status, progress, error)
        self.update_document_status(document_id, status, progress, error)
    
    def finalize_error(
        self,
        document_id: str,
        error_message: str,
        final_status: str = "Processing failed",
        progress: int = 0
    ) -> None:
        """
        Finalize a document with an error status.
        
        Args:
            document_id: The document ID
            error_message: Error message describing the failure
            final_status: Final status message
            progress: Final progress value (usually 0 or 100)
        """
        self.logger.error(f"Doc {document_id} error: {error_message}")
        self.emit_status(document_id, final_status, progress, error=error_message)
        self.update_document_status(document_id, final_status, progress, error_message=error_message)
        
        # Also update the document status and processing flag
        try:
            self._document_collection.update_one(
                {"_id": document_id},
                {"$set": {"is_processing": False, "status": "error"}}
            )
        except Exception as e:
            self.logger.error(f"Failed to finalize error for {document_id}: {e}")
    
    def complete_processing(
        self,
        document_id: str,
        status: str = "Processing completed"
    ) -> None:
        """
        Mark a document as successfully processed.
        
        Args:
            document_id: The document ID
            status: Completion status message
        """
        self.emit_status(document_id, status, 100)
        self.update_document_status(document_id, status, 100)
        
        try:
            self._document_collection.update_one(
                {"_id": document_id},
                {"$set": {"is_processing": False, "status": "completed"}}
            )
        except Exception as e:
            self.logger.error(f"Failed to complete processing for {document_id}: {e}")


# Singleton access
_status_service_instance: Optional[StatusUpdateService] = None


def get_status_service() -> StatusUpdateService:
    """Get or create the status update service singleton."""
    global _status_service_instance
    if _status_service_instance is None:
        _status_service_instance = StatusUpdateService()
    return _status_service_instance


# =============================================================================
# Backwards Compatibility Functions
# =============================================================================

def emit_status(document_id: str, status: str, progress: int, error: Optional[str] = None):
    """Backwards compatible: Emit status update."""
    get_status_service().emit_status(document_id, status, progress, error)


def update_document_status(
    document_id: str,
    status: str,
    progress: int,
    error_message: Optional[str] = None
):
    """Backwards compatible: Update document status."""
    get_status_service().update_document_status(document_id, status, progress, error_message)


def _finalize_error(doc_id: str, err_msg: str, final_status: str, progress: int):
    """Backwards compatible: Finalize error."""
    get_status_service().finalize_error(doc_id, err_msg, final_status, progress)
