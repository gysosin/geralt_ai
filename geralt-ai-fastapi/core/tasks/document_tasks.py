"""
Document Processing Tasks

Celery tasks for document processing and deletion.
Provides robust logging and error handling throughout the processing pipeline.
"""
import os
import json
import tempfile
import logging
import traceback
import numpy as np
from datetime import datetime
from typing import List, Dict, Optional

from core.tasks import celery_app
from config import Config
from models.database import document_collection
from clients import minio_client
from core.clients.elasticsearch_client import get_sync_elasticsearch_client

from core.extraction.factory import ExtractorFactory
from core.ai.factory import AIProviderFactory
from helpers.status_updates import emit_status, update_document_status, _finalize_error
from helpers.socketio_instance import socketio
from helpers.utils import get_utility_service
from services.notifications import get_notification_service, NotificationType, NotificationPriority

logger = logging.getLogger(__name__)


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
        self.logger = logging.getLogger(f"{self.__class__.__name__}[{document_id[:8]}]")

    def process(self) -> bool:
        """Process the document."""
        self.logger.info(f"Starting document processing for {self.document_id}")

        try:
            doc = document_collection.find_one({"_id": self.document_id})
            if not doc:
                self.logger.error(f"Document {self.document_id} not found in database")
                return False

            self._emit_progress(0, 0)  # Start: 0%

            file_path = doc.get("file_path")
            file_name = doc.get("file_name", "")
            url = doc.get("url", "")
            collection_id = doc["collection_id"]

            self.logger.info(f"Document: {file_name or url}, Collection: {collection_id}")

            # Step 1: Fetching document
            self._emit_progress(1, 5)
            extracted = []

            if file_path:
                self.logger.info(f"Processing file: {file_path}")
                extracted = self._process_file(doc, file_path, file_name)
            elif url:
                self.logger.info(f"Processing URL: {url}")
                extracted = self._process_url(doc, url)
            else:
                self._handle_error("No file_path or url found", "Missing source", 10)
                return False

            if not extracted:
                # Check if error was already logged
                doc_check = document_collection.find_one({"_id": self.document_id})
                if not doc_check.get("error_message"):
                    self._handle_error(
                        f"No content extracted from {file_name or url}",
                        "No extracted content",
                        30
                    )
                return False

            self.logger.info(f"Extraction complete: {len(extracted)} chunks extracted")

            # Step 4-6: Store chunks & Embed
            self._emit_progress(3, 30)

            try:
                # Cleanup existing data for idempotency
                self.logger.info("Cleaning up existing data for reprocessing")
                self._cleanup_existing(self.document_id)

                self.logger.info("Starting embedding and storage")
                self._embed_and_store(self.document_id, extracted, collection_id)

            except Exception as e:
                self.logger.error(f"Embed/store failed: {e}", exc_info=True)
                self._handle_error(f"Unable to store chunks: {e}", "Error storing data", 60)
                return False

            self._finalize_success()
            return True

        except Exception as e:
            self.logger.error(f"Unexpected error during processing: {e}", exc_info=True)
            self._handle_error(str(e), "Unexpected error", 70)
            return False

    def _process_file(self, doc: Dict, file_path: str, file_name: str) -> List[Dict]:
        """Process a file-based document."""
        self.logger.info(f"Fetching file from MinIO: {file_path}")

        try:
            minio_response = minio_client.get_object(Config.BUCKET_NAME, file_path)
        except Exception as e:
            self.logger.error(f"MinIO fetch failed: {e}", exc_info=True)
            self._handle_error(f"Unable to retrieve file: {e}", "Error retrieving file", 10)
            return []

        temp_file = tempfile.NamedTemporaryFile(delete=False)
        local_path = None

        try:
            # Download file
            bytes_downloaded = 0
            for chunk in minio_response.stream(1024 * 1024):
                temp_file.write(chunk)
                bytes_downloaded += len(chunk)
            temp_file.flush()
            local_path = temp_file.name

            self.logger.info(f"Downloaded {bytes_downloaded / 1024:.1f} KB to {local_path}")

        finally:
            temp_file.close()

        # Step 3: Extract
        self._emit_progress(2, 15)
        file_ext = file_name.split(".")[-1].lower()
        self.logger.info(f"File extension: {file_ext}")

        try:
            # Check if we should convert to PDF first
            from core.extraction.converters import UniversalExtractor

            if UniversalExtractor.should_convert(file_ext):
                self.logger.info(f"Converting {file_ext} to PDF for universal processing")

                with open(local_path, 'rb') as f:
                    pdf_bytes = UniversalExtractor.extract_via_pdf(f.read(), file_ext)

                if pdf_bytes:
                    from core.extraction.documents import PDFExtractor
                    pdf_extractor = PDFExtractor()
                    extracted = pdf_extractor.extract(pdf_bytes)
                    self.logger.info(f"Converted and extracted {len(extracted)} blocks from {file_ext}")
                    return extracted
                else:
                    self.logger.warning(f"PDF conversion failed for {file_ext}, using native extractor")

            # Use native extractor
            self.logger.info(f"Using native extractor for {file_ext}")
            extractor = ExtractorFactory.get_extractor(file_ext)
            extracted = extractor.extract(local_path)

            self.logger.info(f"Native extraction complete: {len(extracted)} chunks")
            return extracted

        except ValueError as e:
            # Expected extraction errors
            self.logger.error(f"Extraction error: {e}")
            self._handle_error(f"Extraction error: {e}", "Extraction error", 30)
            return []

        except Exception as e:
            # Unexpected errors
            self.logger.error(f"Unexpected extraction error: {e}", exc_info=True)
            self._handle_error(f"Extraction error: {e}", "Extraction error", 30)
            return []

        finally:
            if local_path and os.path.exists(local_path):
                try:
                    os.remove(local_path)
                    self.logger.debug(f"Cleaned up temp file: {local_path}")
                except Exception as cleanup_err:
                    self.logger.warning(f"Failed to cleanup temp file: {cleanup_err}")

    def _process_url(self, doc: Dict, url: str) -> List[Dict]:
        """Process a URL-based document."""
        self._emit_progress(2, 15)

        try:
            if "youtube.com" in url or "youtu.be" in url:
                self.logger.info("Detected YouTube URL, using YouTube extractor")
                extractor = ExtractorFactory.get_extractor("youtube")
            else:
                self.logger.info("Using web extractor")
                extractor = ExtractorFactory.get_extractor("web")

            extracted = extractor.extract(url)
            self.logger.info(f"URL extraction complete: {len(extracted)} chunks")
            return extracted

        except Exception as e:
            self.logger.error(f"URL extraction error: {e}", exc_info=True)
            self._handle_error(f"URL extraction error: {e}", "URL extraction error", 30)
            return []

    def _cleanup_existing(self, document_id: str) -> None:
        """Delete existing chunks from ES and Milvus before reprocessing."""
        self.logger.info(f"Cleaning up existing data for doc {document_id}")

        # 1. Delete from Elasticsearch
        try:
            # Use sync delete_by_query
            sync_es = get_sync_elasticsearch_client()
            sync_es.delete_by_query(
                query={"query": {"term": {"document_id.keyword": document_id}}},
                index=Config.ELASTIC_INDEX
            )
            self.logger.info("Elasticsearch cleanup complete")
        except Exception as e:
            self.logger.warning(f"ES cleanup failed (might be empty): {e}")

        # 2. Delete from Milvus
        try:
            from core.clients.milvus_client import get_milvus_client
            milvus_client = get_milvus_client()
            milvus_client.connect()
            coll = milvus_client.embedding_collection
            coll.load()

            expr = f"metadata['document_id'] == '{document_id}'"
            coll.delete(expr)
            self.logger.info("Milvus cleanup complete")
        except Exception as e:
            self.logger.warning(f"Milvus cleanup failed: {e}")

    def _embed_and_store(
        self,
        document_id: str,
        extracted_chunks: List[Dict],
        collection_id: str
    ) -> None:
        """
        Hierarchical Storage Strategy:
        1. Split into Parent and Child chunks.
        2. Store Parent chunks (Text + Metadata) in Elasticsearch for Context & Keyword search.
        3. Store Child chunks (Vector + Metadata) in Milvus for Semantic search.
        """
        import io

        self.logger.info(f"Processing {len(extracted_chunks)} extracted chunks")

        # Handle page images (snapshots)
        page_image_map = {}

        # First pass: Identify and upload images
        for item in extracted_chunks:
            img_bytes = item.pop("_page_image_bytes", None)
            page_num = item.get("metadata", {}).get("page_number", 0)

            if img_bytes:
                try:
                    snapshot_path = f"documents/{document_id}/snapshots/page_{page_num}.png"

                    minio_client.put_object(
                        Config.BUCKET_NAME,
                        snapshot_path,
                        io.BytesIO(img_bytes),
                        len(img_bytes),
                        content_type="image/png"
                    )

                    page_image_map[page_num] = snapshot_path
                    self.logger.debug(f"Uploaded page {page_num} snapshot")
                except Exception as e:
                    self.logger.warning(f"Failed to upload page snapshot: {e}")

        if page_image_map:
            self.logger.info(f"Uploaded {len(page_image_map)} page snapshots")

        # Second pass: Assign page_image to chunks
        for item in extracted_chunks:
            page_num = item.get("metadata", {}).get("page_number", 0)
            if page_num in page_image_map:
                if "metadata" not in item:
                    item["metadata"] = {}
                item["metadata"]["page_image"] = page_image_map[page_num]

        # Inject metadata
        for item in extracted_chunks:
            if "metadata" not in item:
                item["metadata"] = {}
            item["metadata"]["document_id"] = document_id
            item["metadata"]["collection_id"] = collection_id

        from core.rag.chunker import HierarchicalChunker

        chunker = HierarchicalChunker()
        parents, children = chunker.chunk_documents(extracted_chunks)

        self.logger.info(f"Chunked into {len(parents)} parents and {len(children)} children")

        total_steps = len(parents) + len(children)
        processed_steps = 0

        # Store Parents in Elasticsearch
        self.logger.info("Storing parent chunks in Elasticsearch")
        es_success = 0
        es_errors = 0

        for parent in parents:
            try:
                meta_dict = parent.metadata.model_dump()

                es_doc = {
                    "document_id": document_id,
                    "content": parent.content,
                    "metadata": json.dumps(meta_dict),
                    "chunk_id": parent.chunk_id,
                    "collection_id": collection_id,
                    "chunk_type": "parent"
                }

                sync_es = get_sync_elasticsearch_client()
                sync_es.index_document(es_doc, index=Config.ELASTIC_INDEX)
                es_success += 1

            except Exception as e:
                es_errors += 1
                self.logger.error(f"Failed to index parent chunk {parent.chunk_id}: {e}")

            processed_steps += 1

        self.logger.info(f"ES indexing: {es_success} success, {es_errors} errors")

        # Store Children in Milvus
        self.logger.info("Storing child chunks in Milvus")

        embedder = AIProviderFactory.get_embedding_provider()
        milvus_client_instance = None

        try:
            from core.clients.milvus_client import get_milvus_client
            milvus_client_instance = get_milvus_client()
            milvus_client_instance.connect()
        except Exception as e:
            self.logger.error(f"Milvus connection failed: {e}")
            # Continue without vector storage
            self._emit_progress(6, 100)
            return

        # Batch embed children
        BATCH_SIZE = 20
        total_children = len(children)
        milvus_success = 0
        milvus_errors = 0

        for i in range(0, total_children, BATCH_SIZE):
            batch = children[i:i+BATCH_SIZE]
            texts = [c.content for c in batch]
            batch_num = (i // BATCH_SIZE) + 1
            total_batches = (total_children + BATCH_SIZE - 1) // BATCH_SIZE

            self.logger.debug(f"Processing batch {batch_num}/{total_batches}")

            try:
                # Embed batch - use asyncio.run since embedder is async
                import asyncio
                vectors = asyncio.run(embedder.embed_batch(texts))

                milvus_ids = []
                milvus_embeddings = []
                milvus_metadata = []

                for j, child in enumerate(batch):
                    m_id = abs(hash(child.chunk_id)) % (2**63 - 1)

                    milvus_ids.append(m_id)
                    milvus_embeddings.append(vectors[j])

                    meta_dict = child.metadata.model_dump()

                    # Flatten 'extra' fields
                    if "extra" in meta_dict and isinstance(meta_dict["extra"], dict):
                        extra_data = meta_dict.pop("extra")
                        meta_dict.update(extra_data)

                    meta_dict["content_preview"] = child.content[:500]
                    milvus_metadata.append(meta_dict)

                # Insert batch into Milvus
                from pymilvus import Collection, utility
                collection_name = "embedding_collection"

                if not utility.has_collection(collection_name):
                    milvus_client_instance._get_or_create_collection(
                        collection_name, "Document embeddings"
                    )

                coll = Collection(collection_name)
                coll.insert([milvus_ids, milvus_embeddings, milvus_metadata])
                milvus_success += len(batch)

            except Exception as e:
                milvus_errors += len(batch)
                self.logger.error(f"Failed to process batch {batch_num}: {e}")

            processed_steps += len(batch)

            # Progress update
            prog = 30 + int((processed_steps / total_steps) * 70)
            self._emit_progress(5, min(prog, 99))

        self.logger.info(f"Milvus indexing: {milvus_success} success, {milvus_errors} errors")
        self._emit_progress(6, 100)

    def _emit_progress(self, step: int, progress: int) -> None:
        """Emit progress update."""
        if step < len(self.STEP_MESSAGES):
            msg = self.STEP_MESSAGES[step]
        else:
            msg = "Processing..."

        self.logger.debug(f"Progress: Step {step} - {progress}% - {msg}")
        emit_status(self.document_id, msg, progress)
        update_document_status(self.document_id, msg, progress)

    def _handle_error(self, error: str, status: str, progress: int) -> None:
        """Handle processing error."""
        self.logger.error(f"Processing error: {status} - {error}")
        _finalize_error(self.document_id, error, status, progress)

        # Send error notification
        try:
            doc = document_collection.find_one({"_id": self.document_id})
            if doc:
                notification_service = get_notification_service()
                notification_service.document_processed(
                    user_id=doc.get("added_by", ""),
                    document_name=doc.get("file_name", "Document"),
                    success=False,
                    error=status
                )
        except Exception as e:
            self.logger.warning(f"Failed to send error notification: {e}")

    def _finalize_success(self) -> None:
        """Finalize successful processing."""
        self.logger.info(f"Document processing completed successfully for {self.document_id}")

        self._emit_progress(6, 90)

        doc = document_collection.find_one({"_id": self.document_id})

        # Run structured extraction (non-blocking)
        self._run_structured_extraction(doc)

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

        # Send notification
        if doc:
            try:
                notification_service = get_notification_service()
                notification_service.document_processed(
                    user_id=doc.get("added_by", ""),
                    document_name=doc.get("file_name", "Document"),
                    success=True
                )
            except Exception as e:
                self.logger.warning(f"Failed to send notification: {e}")

    def _run_structured_extraction(self, doc: Dict) -> None:
        """
        Run structured extraction on the document content.

        This extracts structured data (entities, amounts, dates, etc.) and stores
        in MongoDB for aggregation queries. Non-blocking - failures are logged but
        don't affect document processing status.
        """
        if not doc:
            return

        try:
            import asyncio
            from core.extraction.structured_extractor import get_structured_extractor
            from models.database import extraction_collection

            self.logger.info("Starting structured extraction")

            # Get content from Elasticsearch (parent chunks)
            sync_es = get_sync_elasticsearch_client()

            # Fetch all parent chunks for this document
            result = sync_es.client.search(
                index=Config.ELASTIC_INDEX,
                body={
                    "query": {
                        "bool": {
                            "must": [
                                {"term": {"document_id.keyword": self.document_id}},
                                {"term": {"chunk_type.keyword": "parent"}}
                            ]
                        }
                    },
                    "size": 100,
                    "_source": ["content"],
                    "sort": [{"_id": "asc"}]
                }
            )

            hits = result.get("hits", {}).get("hits", [])
            if not hits:
                self.logger.warning("No parent chunks found for extraction")
                return

            # Combine content from all parent chunks
            full_content = "\n\n".join([
                hit["_source"].get("content", "")
                for hit in hits
            ])

            self.logger.info(f"Extracted {len(full_content)} chars from {len(hits)} chunks")

            # Run extraction
            extractor = get_structured_extractor()
            extraction = asyncio.run(extractor.extract(
                content=full_content,
                document_id=self.document_id,
                collection_id=doc.get("collection_id", ""),
            ))

            # Store in MongoDB
            extraction_dict = extraction.model_dump()

            # Upsert - replace if exists
            extraction_collection.update_one(
                {"document_id": self.document_id},
                {"$set": extraction_dict},
                upsert=True
            )

            self.logger.info(
                f"Structured extraction complete: type={extraction.document_type}, "
                f"entities={len(extraction.entities)}, amounts={len(extraction.amounts)}"
            )

            # Update document with extraction summary
            document_collection.update_one(
                {"_id": self.document_id},
                {"$set": {
                    "has_extraction": True,
                    "extraction_type": extraction.document_type,
                    "extraction_summary": extraction.summary,
                }}
            )

        except Exception as e:
            self.logger.warning(f"Structured extraction failed (non-blocking): {e}")
            # Don't fail the document - extraction is optional


class DocumentDeleter:
    """
    Handles document deletion operations.

    Responsibilities:
    - Delete from MongoDB
    - Delete from MinIO
    - Delete from Elasticsearch
    - Delete from Milvus
    """

    def __init__(self, document_id: str, username: str = None):
        self.document_id = document_id
        self.username = username
        self.logger = logging.getLogger(f"{self.__class__.__name__}[{document_id[:8]}]")

    def delete(self) -> bool:
        """Delete the document from all systems."""
        self.logger.info(f"Starting deletion for document {self.document_id}")

        try:
            doc = document_collection.find_one({"_id": self.document_id})
            if not doc:
                self.logger.warning(f"Document {self.document_id} not found")
                self._emit("Document not found", 100)
                return False

            file_name = doc.get("file_name", "Unknown")
            self.logger.info(f"Deleting document: {file_name}")

            # 1. Delete from MongoDB
            self._emit("Deleting from MongoDB", 20)
            document_collection.delete_one({"_id": self.document_id})
            self.logger.info("Deleted from MongoDB (main document)")

            # Delete any chunk documents
            result = document_collection.delete_many({"document_id": self.document_id})
            if result.deleted_count > 0:
                self.logger.info(f"Deleted {result.deleted_count} chunk documents from MongoDB")

            self._emit("Deleted from MongoDB", 40)

            # 2. Delete from MinIO
            file_path = doc.get("file_path")
            if file_path:
                try:
                    minio_client.remove_object(Config.BUCKET_NAME, file_path)
                    self.logger.info(f"Deleted file from MinIO: {file_path}")
                    self._emit("Deleted file from MinIO", 60)
                except Exception as e:
                    self.logger.error(f"Error deleting from MinIO: {e}")

            # 3. Delete from Elasticsearch
            try:
                sync_es = get_sync_elasticsearch_client()
                sync_es.delete_by_query(
                    query={"query": {"term": {"document_id.keyword": self.document_id}}},
                    index=Config.ELASTIC_INDEX
                )
                self.logger.info("Deleted embeddings from Elasticsearch")
                self._emit("Removed embeddings from Elasticsearch", 70)
            except Exception as e:
                self.logger.error(f"Error deleting from ES: {e}")

            # 4. Delete from Milvus
            try:
                from pymilvus import Collection, utility, MilvusException
                from core.clients.milvus_client import get_milvus_client

                milvus_client = get_milvus_client()
                milvus_client.connect()

                collection_name = "embedding_collection"
                if utility.has_collection(collection_name):
                    coll = Collection(collection_name)
                    try:
                        coll.load()
                        expr = f"metadata['document_id'] == '{self.document_id}'"
                        coll.delete(expr)
                        self.logger.info("Deleted embeddings from Milvus")
                    except MilvusException as e:
                        if e.code == 700 or "index not found" in str(e.message):
                            self.logger.warning("Skipping Milvus deletion: Index not found")
                        else:
                            raise e

                    self._emit("Removed embeddings from Milvus", 90)
            except Exception as e:
                self.logger.warning(f"Could not delete from Milvus: {e}")

            self._emit("Deletion completed", 100)
            self.logger.info(f"Deletion completed for {self.document_id}")
            return True

        except Exception as e:
            self.logger.error(f"Error during deletion: {e}", exc_info=True)
            self._emit("Error during deletion", 100, error=str(e))
            return False

    def _emit(self, status: str, progress: int, error: str = None) -> None:
        """Emit deletion status."""
        self.logger.debug(f"Deletion progress: {progress}% - {status}")

        data = {
            "document_id": self.document_id,
            "status": status,
            "progress": progress
        }
        if error:
            data["error"] = error
        socketio.emit("deletion_update", data)


# Celery task wrappers
@celery_app.task(bind=True, max_retries=3)
def background_process_document(self, document_id: str) -> bool:
    """Celery task for document processing."""
    logger.info(f"Celery task started: process document {document_id}")

    try:
        processor = DocumentProcessor(document_id)
        result = processor.process()
        logger.info(f"Celery task completed: document {document_id}, success={result}")
        return result
    except Exception as e:
        logger.error(f"Celery task failed: {e}", exc_info=True)
        raise


@celery_app.task(bind=True)
def background_delete_document_task(self, document_id: str, username: str = None) -> bool:
    """Celery task for document deletion."""
    logger.info(f"Celery task started: delete document {document_id}")

    try:
        deleter = DocumentDeleter(document_id, username)
        result = deleter.delete()
        logger.info(f"Celery task completed: delete {document_id}, success={result}")
        return result
    except Exception as e:
        logger.error(f"Celery deletion task failed: {e}", exc_info=True)
        raise
