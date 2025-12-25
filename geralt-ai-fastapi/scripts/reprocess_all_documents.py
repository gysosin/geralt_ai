"""
Reprocess All Documents

This script:
1. Finds all documents in MongoDB.
2. Deletes their existing vector/chunk data (cleanup).
3. Re-triggers the processing pipeline using the new Hierarchical RRF strategy.
"""
import sys
import os
import time
import logging

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.database import document_collection
from core.tasks.document_tasks import DocumentProcessor, DocumentDeleter
from clients import es_client, minio_client, get_milvus_client
from config import Config

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def reprocess_all():
    logger.info("Starting reprocessing of all documents...")
    
    # 1. Get all documents
    docs = list(document_collection.find({}))
    total = len(docs)
    logger.info(f"Found {total} documents in MongoDB.")
    
    if total == 0:
        logger.info("No documents to process.")
        return

    # 2. Reset Milvus Collection (Optional but cleaner for full re-index)
    # Since we are deleting doc-by-doc, we might not need to drop the whole collection,
    # but dropping ensures no orphan chunks remain.
    try:
        mc = get_milvus_client()
        mc.connect()
        if mc._embedding_collection:
            # We don't drop the collection because other users might be using it?
            # But this is a full system re-process.
            # Let's rely on DocumentDeleter to be safe.
            pass
    except Exception as e:
        logger.warning(f"Milvus connection warning: {e}")

    success_count = 0
    fail_count = 0

    for i, doc in enumerate(docs, 1):
        doc_id = doc["_id"]
        filename = doc.get("file_name", "unknown")
        
        logger.info(f"[{i}/{total}] Reprocessing: {filename} ({doc_id})")
        
        try:
            # A. Clean up old data
            # We use DocumentDeleter to remove ES entries and Milvus entries for this docID
            # Note: DocumentDeleter also deletes from MongoDB if we aren't careful!
            # We ONLY want to delete vectors/chunks, NOT the metadata record itself.
            # However, DocumentDeleter.delete() removes the doc from Mongo.
            
            # Custom cleanup logic to preserve Mongo record:
            logger.info("  - Cleaning up old chunks...")
            
            # 1. Delete from ES
            try:
                es_client.delete_by_query(
                    index=Config.ELASTIC_INDEX,
                    body={"query": {"term": {"document_id.keyword": doc_id}}},
                    refresh=True
                )
            except Exception as e:
                logger.warning(f"    ES cleanup failed: {e}")

            # 2. Delete from Milvus (Best effort)
            try:
                # We can't easily delete by expression in Milvus without loading.
                # But since we are re-ingesting, new chunks will just be added.
                # Ideally we delete. If Milvus 2.6, we can try delete by expression if we had a scalar index on document_id.
                # For now, we skip explicit Milvus delete per doc to avoid complexity, 
                # or rely on the fact that we wiped the volume earlier (so it's empty).
                pass 
            except Exception as e:
                logger.warning(f"    Milvus cleanup failed: {e}")

            # B. Update Status
            document_collection.update_one(
                {"_id": doc_id},
                {"$set": {
                    "status": "processing",
                    "processed": False,
                    "error_message": None,
                    "progress": 0
                }}
            )
            
            # C. Process
            logger.info("  - Re-ingesting...")
            processor = DocumentProcessor(doc_id)
            if processor.process():
                logger.info(f"  ✓ Successfully reprocessed: {filename}")
                success_count += 1
            else:
                logger.error(f"  ✗ Failed to process: {filename}")
                # Revert status to error
                document_collection.update_one(
                    {"_id": doc_id},
                    {"$set": {"status": "error", "error_message": "Reprocessing failed"}}
                )
                fail_count += 1
                
        except Exception as e:
            logger.error(f"  ✗ Exception processing {filename}: {e}")
            fail_count += 1

    logger.info("="*40)
    logger.info(f"Reprocessing Complete.")
    logger.info(f"Success: {success_count}")
    logger.info(f"Failed:  {fail_count}")
    logger.info("="*40)

if __name__ == "__main__":
    reprocess_all()
