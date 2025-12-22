"""
Document Service

Handles document upload, processing, and management.
Extracted from collections_service.py for single responsibility.
"""
import os
import logging
from datetime import datetime
from uuid import uuid4
from typing import Dict, List, Optional, Any

from config import Config
from clients import minio_client
from core.tasks import (
    background_delete_document_task,
    background_process_document,
)
from models.database import (
    collection_collection,
    document_collection,
)
from helpers.utils import get_utility_service
from helpers.socketio_instance import socketio
from services.collections import BaseService, ServiceResult


class DocumentService(BaseService):
    """
    Service for managing documents within collections.
    
    Responsibilities:
    - Upload files and URLs
    - Process documents (trigger Celery tasks)
    - List and delete documents
    - Track document status
    """
    
    def __init__(self):
        super().__init__()
        self.db = document_collection
        self.collections_db = collection_collection
        self.storage = minio_client
    
    # =========================================================================
    # Upload Operations
    # =========================================================================
    
    def upload(
        self,
        identity: str,
        collection_id: str,
        files: List = None,
        urls: List[str] = None,
        conversation_id: Optional[str] = None,
        jwt_data: Optional[Dict] = None
    ) -> ServiceResult:
        """
        Upload files and/or URLs to a collection.
        
        Args:
            identity: User's email/identity
            collection_id: Target collection
            files: List of file objects
            urls: List of URLs
            conversation_id: Optional conversation context
            jwt_data: JWT data with user info
            
        Returns:
            ServiceResult with upload results
        """
        try:
            username = self.extract_username(identity)
            full_name = jwt_data.get("FullName", "") if jwt_data else ""
            
            if not collection_id:
                return ServiceResult.fail("Collection ID is required", 400)
            
            # Verify collection access
            coll = self.collections_db.find_one({"collection_id": collection_id})
            if not coll:
                return ServiceResult.fail("Collection not found or access denied", 403)
            
            # Check user role
            if not self._has_upload_permission(coll, username):
                return ServiceResult.fail("Access denied", 403)
            
            if not files and not urls:
                return ServiceResult.fail("No files or URLs provided", 400)
            
            results = []
            success = True
            
            # Handle file uploads
            if files:
                for f in files:
                    result, ok = self._upload_file(
                        f, username, full_name, collection_id, conversation_id
                    )
                    results.append(result)
                    if not ok:
                        success = False
            
            # Handle URL uploads
            if urls:
                for url in urls:
                    result, ok = self._upload_url(
                        url, username, full_name, collection_id, conversation_id
                    )
                    results.append(result)
                    if not ok:
                        success = False
            
            return ServiceResult.ok(
                {"results": results},
                status_code=200 if success else 207  # 207 = partial success
            )
            
        except Exception as e:
            self.logger.error(f"Error uploading documents: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def _upload_file(
        self,
        file,
        username: str,
        full_name: str,
        collection_id: str,
        conversation_id: Optional[str]
    ) -> tuple:
        """Upload a single file."""
        original_filename = get_utility_service().secure_filename(file.filename)
        
        # Check for duplicates (exclude 'deleting' status - allow re-upload if delete is in progress)
        existing = self.db.find_one({
            "file_name": original_filename,
            "added_by": username,
            "collection_id": collection_id,
            "type": "document",
            "status": {"$in": ["uploaded", "processing", "processed"]},
        })
        
        if existing:
            status = existing.get("status")
            if status == "deleting":
                return {"message": f"Document '{original_filename}' is being deleted.", "status": "deleting"}, False
            else:
                return {"message": f"Document '{original_filename}' already uploaded.", "status": "duplicate"}, False
        
        doc_id = str(uuid4())
        upload_time = datetime.utcnow()
        file_path = f"{username}/{collection_id}/{doc_id}/{original_filename}"
        
        # Get file size and content using the underlying file object
        try:
            # Access the SpooledTemporaryFile directly
            underlying_file = file.file
            underlying_file.seek(0, 2)  # Seek to end (2 = SEEK_END)
            size = underlying_file.tell()
            underlying_file.seek(0)  # Reset to beginning
        except Exception as e:
            self.logger.error(f"Error getting file size: {e}")
            # Fallback: read content to get size
            content = file.file.read()
            size = len(content)
            file.file.seek(0)
        
        self.storage.put_object(Config.BUCKET_NAME, file_path, file.file, length=size)
        
        self.db.insert_one({
            "_id": doc_id,
            "type": "document",
            "file_name": original_filename,
            "guid_file_name": original_filename,
            "file_path": file_path,
            "added_by": username,
            "full_name": full_name,
            "collection_id": collection_id,
            "upload_time": upload_time,
            "status": "uploaded",
            "processed": False,
            "file_size": size,
            "is_processing": False,
            "conversation_id": conversation_id,
        })
        
        self.log_operation("upload_file", username=username, document_id=doc_id)
        
        return {
            "message": f"Document {original_filename} uploaded successfully",
            "document_id": doc_id,
            "upload_time": upload_time.isoformat(),
        }, True
    
    def _upload_url(
        self,
        url: str,
        username: str,
        full_name: str,
        collection_id: str,
        conversation_id: Optional[str]
    ) -> tuple:
        """Upload a single URL."""
        if not get_utility_service().is_valid_url(url):
            return {"error": f"Invalid URL: {url}"}, False
        
        normalized = get_utility_service().normalize_url(url)
        
        # Get document name from URL
        if "youtube.com" in normalized or "youtu.be" in normalized:
            original_filename = get_utility_service().get_youtube_video_title(normalized) or "youtube_video"
        else:
            original_filename = get_utility_service().get_document_name_from_url(normalized)
        
        if not original_filename:
            return {
                "message": f"Invalid URL or no name extracted: {url}",
                "status": "skipped",
            }, False
        
        if not (original_filename.endswith(".html") or original_filename.endswith(".srt")):
            original_filename += ".html"
        
        # Check for duplicates (exclude 'deleting' status - allow re-upload if delete is in progress)
        existing = self.db.find_one({
            "url": normalized,
            "added_by": username,
            "collection_id": collection_id,
            "type": "document",
            "status": {"$in": ["uploaded", "processing", "processed"]},
        })
        
        if existing:
            status = existing.get("status")
            if status == "deleting":
                return {"message": f"URL '{url}' is currently deleting.", "status": "deleting"}, False
            else:
                return {"message": f"URL '{url}' has already been uploaded.", "status": "duplicate"}, False
        
        doc_id = str(uuid4())
        upload_time = datetime.utcnow()
        
        self.db.insert_one({
            "_id": doc_id,
            "type": "document",
            "file_name": original_filename,
            "guid_file_name": original_filename,
            "url": normalized,
            "added_by": username,
            "full_name": full_name,
            "collection_id": collection_id,
            "upload_time": upload_time,
            "status": "uploaded",
            "processed": False,
            "is_processing": False,
            "conversation_id": conversation_id,
        })
        
        self.log_operation("upload_url", username=username, document_id=doc_id)
        
        return {
            "message": f"URL '{url}' uploaded successfully",
            "document_id": doc_id,
            "upload_time": upload_time.isoformat(),
        }, True
    
    # =========================================================================
    # Processing Operations
    # =========================================================================
    
    def download(self, identity: str, document_id: str) -> ServiceResult:
        """
        Download a document file.
        
        Args:
            identity: User's identity
            document_id: Document ID
            
        Returns:
            ServiceResult with file content and content type
        """
        try:
            username = self.extract_username(identity)
            
            doc = self.db.find_one({"_id": document_id})
            if not doc:
                return ServiceResult.fail("Document not found", 404)
            
            # Permission check - similar to process, check if user has access to collection
            coll = self.collections_db.find_one({"collection_id": doc["collection_id"]})
            if not coll:
                return ServiceResult.fail("Collection not found", 404)
            
            # Check if user has access to collection (owner or shared)
            is_owner = coll["created_by"] == username
            is_shared = any(u["username"] == username for u in coll.get("shared_with", []))
            
            if not is_owner and not is_shared:
                return ServiceResult.fail("Access denied", 403)
                
            file_path = doc.get("file_path")
            if not file_path:
                 return ServiceResult.fail("File path not found", 404)
                 
            try:
                # Use minio client to get object
                response = self.storage.get_object(Config.BUCKET_NAME, file_path)
                return ServiceResult.ok({
                    "content": response.read(),
                    "content_type": response.headers.get("Content-Type", "application/octet-stream"),
                    "filename": doc.get("file_name", "document")
                })
            except Exception as e:
                self.logger.error(f"Error downloading file from storage: {e}")
                return ServiceResult.fail("Error retrieving file from storage", 500)
                
        except Exception as e:
            self.logger.error(f"Error downloading document: {e}")
            return ServiceResult.fail(str(e), 500)

    def process(self, identity: str, document_id: str) -> ServiceResult:
        """
        Initiate background processing of a document.
        
        Args:
            identity: User's email/identity
            document_id: Document to process
            
        Returns:
            ServiceResult with processing status
        """
        try:
            username = self.extract_username(identity)
            
            if not document_id:
                return ServiceResult.fail("Document ID is required", 400)
            
            doc = self.db.find_one({"_id": document_id})
            if not doc:
                return ServiceResult.fail("Document not found", 404)
            
            # Permission check
            if not self._has_process_permission(doc, username):
                return ServiceResult.fail("Access denied", 403)
            
            if doc.get("status") == "processed":
                return ServiceResult.fail("Document is already processed", 400)
            
            # Update status
            self.db.update_one(
                {"_id": document_id},
                {"$set": {
                    "is_processing": True,
                    "status": "processing",
                    "processed": False,
                    "latest_status": "Processing initiated",
                    "progress": 0,
                }}
            )
            
            self._emit_status(document_id, "Processing initiated", 0)
            
            # Trigger Celery task
            background_process_document.delay(document_id)
            
            self.log_operation("process_document", username=username, document_id=document_id)
            
            return ServiceResult.ok({
                "message": f"Document '{doc.get('file_name', '')}' is processing."
            })
            
        except Exception as e:
            self.logger.error(f"Error processing document: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def get_status(self, identity: str, document_id: str) -> ServiceResult:
        """Get document processing status."""
        try:
            username = self.extract_username(identity)
            
            doc = self.db.find_one({"_id": document_id})
            if not doc:
                return ServiceResult.fail("Document not found", 404)
            
            if doc["added_by"] != username:
                return ServiceResult.fail("Access denied", 403)
            
            return ServiceResult.ok({
                "document_id": document_id,
                "status": doc.get("latest_status", "Processing started"),
                "progress": doc.get("progress", 0),
                "timeline": doc.get("timeline", []),
                "total_processing_time": doc.get("total_processing_time", 0),
            })
            
        except Exception as e:
            self.logger.error(f"Error getting document status: {e}")
            return ServiceResult.fail(str(e), 500)
    
    # =========================================================================
    # List and Delete Operations
    # =========================================================================
    
    def list(
        self,
        identity: str,
        collection_id: str,
        unprocessed_only: bool = False,
        added_by_only: bool = False,
        jwt_data: Optional[Dict] = None
    ) -> ServiceResult:
        """
        List documents in a collection.
        
        Args:
            identity: User's email/identity
            collection_id: Collection to list documents from
            unprocessed_only: Filter to unprocessed documents
            added_by_only: Filter to documents added by user
            jwt_data: JWT data with user info
            
        Returns:
            ServiceResult with list of documents
        """
        try:
            username = self.extract_username(identity)
            full_name = jwt_data.get("FullName", "") if jwt_data else ""
            
            # Verify collection access
            coll = self.collections_db.find_one({
                "collection_id": collection_id,
                "$or": [
                    {"created_by": username},
                    {"shared_with.username": username},
                ],
            })
            if not coll:
                return ServiceResult.fail("Collection not found or access denied", 403)
            
            # Determine user role
            is_owner = coll["created_by"] == username
            user_role = "owner" if is_owner else self._get_user_role(coll, username)
            
            if user_role is None:
                return ServiceResult.fail("Access denied", 403)
            
            # Build query
            query = {
                "collection_id": collection_id,
                "type": {"$ne": "unknown"},
                "status": {"$ne": "deleting"},
            }
            if added_by_only:
                query["added_by"] = username
            if unprocessed_only:
                query["processed"] = False
            
            docs = list(self.db.find(query))
            
            # Process results
            unique_names = set()
            result = []
            
            for doc in docs:
                fname = doc.get("file_name")
                if not fname or fname in unique_names:
                    continue
                unique_names.add(fname)
                
                result.append(self._serialize_document(doc, user_role, is_owner, full_name))
            
            result.sort(key=lambda x: x["upload_time"] or "", reverse=True)
            return ServiceResult.ok(result)
            
        except Exception as e:
            self.logger.error(f"Error listing documents: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def delete(
        self,
        identity: str,
        document_ids: List[str],
        collection_id: str
    ) -> ServiceResult:
        """
        Delete multiple documents.
        
        Args:
            identity: User's email/identity
            document_ids: List of document IDs to delete
            collection_id: Collection containing documents
            
        Returns:
            ServiceResult with deletion results
        """
        try:
            username = self.extract_username(identity)
            
            if not document_ids:
                return ServiceResult.fail("No document IDs provided", 400)
            
            # Verify collection access
            coll = self.collections_db.find_one({"collection_id": collection_id})
            if not coll:
                return ServiceResult.fail("Collection not found", 404)
            
            is_owner = coll["created_by"] == username
            user_role = "owner" if is_owner else self._get_user_role(coll, username)
            
            results = []
            for doc_id in document_ids:
                doc = self.db.find_one({"_id": doc_id})
                if not doc:
                    results.append({"document_id": doc_id, "error": "Not found"})
                    continue
                
                # Permission check
                can_delete = (
                    is_owner or 
                    user_role in ["admin"] or 
                    (user_role == "contributor" and doc["added_by"] == username)
                )
                
                if not can_delete:
                    results.append({"document_id": doc_id, "error": "Access denied"})
                    continue
                
                # Mark as deleting and trigger background task
                self.db.update_one(
                    {"_id": doc_id},
                    {"$set": {"status": "deleting"}}
                )
                background_delete_document_task.delay(doc_id)
                results.append({"document_id": doc_id, "status": "deleting"})
            
            self.log_operation("delete_documents", username=username, count=len(document_ids))
            
            return ServiceResult.ok({"results": results})
            
        except Exception as e:
            self.logger.error(f"Error deleting documents: {e}")
            return ServiceResult.fail(str(e), 500)
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    def _has_upload_permission(self, coll: Dict, username: str) -> bool:
        """Check if user has upload permission."""
        if coll["created_by"] == username:
            return True
        
        shared_info = next(
            (u for u in coll.get("shared_with", []) if u["username"] == username),
            None
        )
        return shared_info is not None and shared_info.get("role") in ["admin", "contributor"]
    
    def _has_process_permission(self, doc: Dict, username: str) -> bool:
        """Check if user has process permission."""
        if doc["added_by"] == username:
            return True
        
        coll = self.collections_db.find_one({"collection_id": doc["collection_id"]})
        if not coll:
            return False
        
        shared_info = next(
            (u for u in coll.get("shared_with", []) if u["username"] == username),
            None
        )
        return shared_info is not None and shared_info.get("role") in ["admin", "contributor"]
    
    def _get_user_role(self, coll: Dict, username: str) -> Optional[str]:
        """Get user's role in a collection."""
        for sh in coll.get("shared_with", []):
            if sh.get("username") == username:
                return sh.get("role", "read-only")
        return None
    
    def _serialize_document(
        self,
        doc: Dict,
        user_role: str,
        is_owner: bool,
        full_name: str
    ) -> Dict:
        """Serialize a document for API response."""
        fname = doc.get("file_name", "")
        base_name = os.path.splitext(fname)[0]
        ext = fname.split(".")[-1].lower()
        
        return {
            "document_id": str(doc["_id"]),
            "file_name": base_name,
            "original_file_name": fname,
            "guid_file_name": doc.get("guid_file_name", fname),
            "added_by": doc.get("added_by"),
            "full_name": doc.get("full_name", full_name),
            "upload_time": doc["upload_time"].isoformat() if doc.get("upload_time") else None,
            "file_size": doc.get("file_size", "determining"),
            "processed": doc.get("processed", False),
            "is_processing": doc.get("is_processing", False),
            "user_role": user_role,
            "is_owner": is_owner,
            "type": doc.get("type", "document"),
            "resource_type": get_utility_service().get_resource_type(ext),
            "url": doc.get("url"),
            "latest_status": doc.get("latest_status", "Not started"),
            "progress": doc.get("progress", 0),
            "status": doc.get("status", "uploaded"),
            "error_message": doc.get("error_message", ""),
        }
    
    def _emit_status(self, document_id: str, status: str, progress: int, error: str = None):
        """Emit status via SocketIO."""
        data = {"document_id": document_id, "status": status, "progress": progress}
        if error:
            data["error"] = error
        socketio.emit("processing_update", data)


# Singleton instance
_document_service_instance: Optional[DocumentService] = None


def get_document_service() -> DocumentService:
    """Get or create the document service singleton."""
    global _document_service_instance
    if _document_service_instance is None:
        _document_service_instance = DocumentService()
    return _document_service_instance
