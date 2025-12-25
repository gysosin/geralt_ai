"""
Cleanup Metadata Script

This script clears all document and embedding metadata from MongoDB
to provide a clean slate after the infrastructure upgrade.
"""
import sys
import os
import logging

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.database import document_collection, embedding_collection, notifications_collection
from core.clients.milvus_client import get_milvus_client
from clients import es_client
from config import Config

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def cleanup():
    logger.info("Starting total metadata cleanup...")
    
    # 1. MongoDB Documents
    try:
        doc_count = document_collection.count_documents({})
        document_collection.delete_many({})
        logger.info(f"✓ Cleared {doc_count} document records from MongoDB.")
    except Exception as e:
        logger.error(f"✗ Failed to clear document records: {e}")

    # 2. MongoDB Embeddings (Legacy/Cache)
    try:
        emb_count = embedding_collection.count_documents({})
        embedding_collection.delete_many({})
        logger.info(f"✓ Cleared {emb_count} embedding records from MongoDB.")
    except Exception as e:
        logger.error(f"✗ Failed to clear embedding records: {e}")

    # 3. MongoDB Notifications
    try:
        notif_count = notifications_collection.count_documents({})
        notifications_collection.delete_many({})
        logger.info(f"✓ Cleared {notif_count} notifications from MongoDB.")
    except Exception as e:
        logger.error(f"✗ Failed to clear notifications: {e}")

    # 4. Elasticsearch Index (Full Wipe)
    try:
        if await es_client.indices.exists(index=Config.ELASTIC_INDEX):
            await es_client.indices.delete(index=Config.ELASTIC_INDEX)
            logger.info(f"✓ Deleted Elasticsearch index: {Config.ELASTIC_INDEX}")
        else:
            logger.info(f"  Elasticsearch index {Config.ELASTIC_INDEX} does not exist.")
    except Exception as e:
        logger.error(f"✗ Failed to clear Elasticsearch index: {e}")

    # 5. Milvus Collection (Full Wipe)
    try:
        mc = get_milvus_client()
        mc.connect()
        from pymilvus import utility
        if utility.has_collection("embedding_collection"):
            utility.drop_collection("embedding_collection")
            logger.info("✓ Dropped Milvus collection: embedding_collection")
        else:
            logger.info("  Milvus collection embedding_collection does not exist.")
    except Exception as e:
        logger.error(f"✗ Failed to clear Milvus collection: {e}")

    logger.info("="*40)
    logger.info("Cleanup Complete. System is now empty and ready for fresh uploads.")
    logger.info("="*40)

if __name__ == "__main__":
    import asyncio
    asyncio.run(cleanup())
