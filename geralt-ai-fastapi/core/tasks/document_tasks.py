"""
Document Processing Tasks

Celery tasks for document processing and deletion.
"""
import os
import json
import tempfile
import logging
import numpy as np
from datetime import datetime

from core.tasks import celery_app
from config import Config
from models.database import document_collection
from clients import minio_client, es_client

from core.extraction.factory import ExtractorFactory
from core.ai.factory import AIProviderFactory
from helpers.status_updates import emit_status, update_document_status, _finalize_error
from helpers.socketio_instance import socketio
from helpers.utils import get_utility_service


class DocumentProcessor:
    """
    Handles document processing operations.
    
    Responsibilities:
    - Extract content from files/URLs
    - Store chunks and embeddings
    - Update processing status
    """
    
    STEP_MESSAGES = [
        "1/7: Starting the process in the background",
        "2/7: Downloading content from the provided URL or storage",
        "3/7: Extracting content from the file",
        "4/7: Saving the extracted content",
        "5/7: Creating data embeddings",
        "6/7: Storing the generated embeddings",
        "7/7: Process is complete, all done!",
    ]
    
    def __init__(self, document_id: str):
        self.document_id = document_id
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def process(self) -> bool:
        """Process the document."""
        try:
            doc = document_collection.find_one({"_id": self.document_id})
            if not doc:
                self.logger.error(f"Document {self.document_id} not found")
                return False
            
            self._emit_progress(0, 0)
            
            file_path = doc.get("file_path")
            file_name = doc.get("file_name", "")
            url = doc.get("url", "")
            collection_id = doc["collection_id"]
            username = doc["added_by"]
            conversation_id = doc.get("conversation_id")
            
            # Step 2: Download/Prep
            self._emit_progress(1, 10)
            extracted = []
            
            if file_path:
                extracted = self._process_file(doc, file_path, file_name)
            elif url:
                extracted = self._process_url(doc, url)
            else:
                self._handle_error("No file_path or url found", "Missing source", 10)
                return False
            
            if not extracted:
                # If extraction failed but didn't raise exception (returned empty)
                # Ensure we handled error inside or handle here
                if not doc.get("error_message"): # Check if error wasn't already logged
                     self._handle_error(f"No content extracted from {file_name or url}", "No extracted content", 30)
                return False

            # Step 4-6: Store chunks & Embed
            self._emit_progress(3, 50)
            try:
                self._embed_and_store(
                    self.document_id, extracted, collection_id
                )
            except Exception as e:
                self._handle_error(f"Unable to store chunks: {e}", "Error storing data", 60)
                return False
            
            self._finalize_success()
            return True
            
        except Exception as e:
            self._handle_error(str(e), "Unexpected error", 70)
            return False
    
    def _process_file(self, doc, file_path, file_name):
        """Process a file-based document."""
        try:
            minio_response = minio_client.get_object(Config.BUCKET_NAME, file_path)
        except Exception as e:
            self._handle_error(f"Unable to retrieve file: {e}", "Error retrieving file", 10)
            return []
        
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        local_path = None
        try:
            for chunk in minio_response.stream(1024 * 1024):
                temp_file.write(chunk)
            temp_file.flush()
            local_path = temp_file.name
        finally:
            temp_file.close()
        
        # Step 3: Extract
        self._emit_progress(2, 30)
        file_ext = file_name.split(".")[-1].lower()
        try:
            extractor = ExtractorFactory.get_extractor(file_ext)
            # Pass local_path. ExtractorFactory implementations handle paths.
            extracted = extractor.extract(local_path)
            return extracted
        except Exception as e:
            self._handle_error(f"Extraction error: {e}", "Extraction error", 30)
            return []
        finally:
            if local_path and os.path.exists(local_path):
                os.remove(local_path)
    
    def _process_url(self, doc, url):
        """Process a URL-based document."""
        self._emit_progress(2, 30)
        try:
            if "youtube.com" in url or "youtu.be" in url:
                extractor = ExtractorFactory.get_extractor("youtube")
            else:
                extractor = ExtractorFactory.get_extractor("web")
            
            extracted = extractor.extract(url)
            return extracted
        except Exception as e:
            self._handle_error(f"URL extraction error: {e}", "URL extraction error", 30)
            return []

    def _embed_and_store(self, document_id: str, extracted_chunks: list, collection_id: str):
        """Splits text and indexes chunk embeddings in Elasticsearch."""
        CHUNK_INSERT_BATCH = 50
        EMBEDDING_BATCH_SIZE = 5
        MAX_CHARS_PER_CHUNK = 5000

        reshaped_chunks = []
        for item in extracted_chunks:
            text = item.get("content", "")
            meta = item.get("metadata", {})
            if len(text) > MAX_CHARS_PER_CHUNK:
                subs = get_utility_service().split_text_into_subchunks(
                    text, max_chars=MAX_CHARS_PER_CHUNK, overlap=0
                )
                for st in subs:
                    reshaped_chunks.append({"content": st, "metadata": meta})
            else:
                reshaped_chunks.append(item)

        if not reshaped_chunks:
            return

        total_chunks = len(reshaped_chunks)
        embedded_count = 0
        partial_batch = []
        
        # Get embedder
        embedder = AIProviderFactory.get_embedding_provider()

        async def flush_embedding_batch(batch):
            nonlocal embedded_count
            if not batch:
                return
            texts = [b["content"] for b in batch]
            
            # Since we are running in an async function (called via asyncio.run),
            # we can directly await the async method.
            vectors = await embedder.embed_batch(texts)
            
            if len(vectors) != len(batch):
                raise Exception("Mismatch in embedding count vs. text batch size")
                
            for i, chunk_item in enumerate(batch):
                chunk_index = embedded_count + i
                chunk_id = f"{document_id}_chunk_{chunk_index}"
                es_doc = {
                    "document_id": document_id,
                    "content": chunk_item["content"],
                    "embedding": vectors[i], # List[float]
                    "metadata": json.dumps(chunk_item.get("metadata", {})),
                    "chunk_id": chunk_id,
                    "collection_id": collection_id,
                }
                es_client.index(index=Config.ELASTIC_INDEX, body=es_doc)
            embedded_count += len(batch)

        for chunk_item in reshaped_chunks:
            partial_batch.append(chunk_item)
            if len(partial_batch) >= EMBEDDING_BATCH_SIZE:
                import asyncio
                # Run async flush synchronously
                asyncio.run(flush_embedding_batch(partial_batch)) # Simplified for sync task
                
                partial_batch.clear()
                prog = 30 + int((embedded_count / total_chunks) * 70)
                self._emit_progress(5, prog)

        if partial_batch:
            import asyncio
            asyncio.run(flush_embedding_batch(partial_batch))

        self._emit_progress(6, 100)

    def _emit_progress(self, step: int, progress: int):
        """Emit progress update."""
        if step < len(self.STEP_MESSAGES):
             msg = self.STEP_MESSAGES[step]
        else:
             msg = "Processing..."
        emit_status(self.document_id, msg, progress)
        update_document_status(self.document_id, msg, progress)
    
    def _handle_error(self, error: str, status: str, progress: int):
        """Handle processing error."""
        _finalize_error(self.document_id, error, status, progress)
    
    def _finalize_success(self):
        """Finalize successful processing."""
        self._emit_progress(6, 90)
        document_collection.update_one(
            {"_id": self.document_id},
            {"$set": {
                "status": "processed",
                "processed_time": datetime.utcnow(),
                "is_processing": False,
                "processed": True,
                "latest_status": "Processing completed",
                "progress": 100,
            }}
        )
        emit_status(self.document_id, "Processing completed", 100)
        update_document_status(self.document_id, "Processing completed", 100)


class DocumentDeleter:
    """
    Handles document deletion operations.
    
    Responsibilities:
    - Delete from MongoDB
    - Delete from MinIO
    - Delete from Elasticsearch
    """
    
    def __init__(self, document_id: str, username: str = None):
        self.document_id = document_id
        self.username = username
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def delete(self) -> bool:
        """Delete the document from all systems."""
        try:
            doc = document_collection.find_one({"_id": self.document_id})
            if not doc:
                self._emit("Document not found", 100)
                return False
            
            # 1. Delete from MongoDB
            self._emit("Deleting from MongoDB", 20)
            document_collection.delete_one({"_id": self.document_id})
            self._emit("Deleted from MongoDB", 40)
            
            # 2. Delete chunks (if any logical chunk store exists in Mongo, else skip)
            # Original code did delete_many on document_collection? 
            # Ah, maybe chunks were in document_collection too? 
            # If so, they are deleted by id or doc_id. 
            # The original code: result = document_collection.delete_many({"document_id": self.document_id})
            # This implies chunks MIGHT be in mongo. I will keep it.
            document_collection.delete_many({"document_id": self.document_id})
            
            # 3. Delete from MinIO
            file_path = doc.get("file_path")
            if file_path:
                try:
                    minio_client.remove_object(Config.BUCKET_NAME, file_path)
                    self._emit("Deleted file from MinIO", 60)
                except Exception as e:
                    self.logger.error(f"Error deleting from MinIO: {e}")
            
            # 4. Delete from Elasticsearch
            try:
                # Use document_id.keyword since the field is text with keyword subfield
                es_client.delete_by_query(
                    index=Config.ELASTIC_INDEX,
                    body={"query": {"term": {"document_id.keyword": self.document_id}}},
                    refresh=True
                )
                self._emit("Removed embeddings from Elasticsearch", 80)
            except Exception as e:
                self.logger.error(f"Error deleting from ES: {e}")
            
            self._emit("Deletion completed", 100)
            return True
            
        except Exception as e:
            self.logger.error(f"Error during deletion: {e}")
            self._emit("Error during deletion", 100, error=str(e))
            return False
    
    def _emit(self, status: str, progress: int, error: str = None):
        """Emit deletion status."""
        data = {"document_id": self.document_id, "status": status, "progress": progress}
        if error:
            data["error"] = error
        socketio.emit("deletion_update", data)


# Celery task wrappers
@celery_app.task
def background_process_document(document_id):
    """Celery task for document processing."""
    processor = DocumentProcessor(document_id)
    return processor.process()


@celery_app.task
def background_delete_document_task(document_id, username=None):
    """Celery task for document deletion."""
    deleter = DocumentDeleter(document_id, username)
    return deleter.delete()