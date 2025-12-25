"""
RAG Pipeline End-to-End Test

Tests each step of the RAG pipeline:
1. Document storage in MongoDB
2. Content extraction
3. Embedding generation
4. Elasticsearch indexing
5. Retrieval/search
"""
import asyncio
import sys
import os
import logging
from datetime import datetime
from uuid import uuid4

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Config
from core.config import settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def test_mongodb_connection():
    """Test MongoDB connection and check for documents."""
    print("\n" + "="*60)
    print("STEP 1: Testing MongoDB Connection")
    print("="*60)
    
    try:
        from models.database import document_collection, collection_collection
        
        # Check collections count
        coll_count = collection_collection.count_documents({})
        doc_count = document_collection.count_documents({})
        processed_count = document_collection.count_documents({"status": "processed"})
        
        print(f"✓ MongoDB connected successfully")
        print(f"  - Total collections: {coll_count}")
        print(f"  - Total documents: {doc_count}")
        print(f"  - Processed documents: {processed_count}")
        
        # Sample a processed document
        if processed_count > 0:
            sample = document_collection.find_one({"status": "processed"})
            print(f"\n  Sample processed document:")
            print(f"  - ID: {sample.get('_id')}")
            print(f"  - File: {sample.get('file_name')}")
            print(f"  - Collection ID: {sample.get('collection_id')}")
            return sample.get('_id'), sample.get('collection_id')
        else:
            print("  ⚠ No processed documents found!")
            # Check for uploaded but not processed
            uploaded = document_collection.find_one({"status": "uploaded"})
            if uploaded:
                print(f"  Found uploaded document awaiting processing: {uploaded.get('file_name')}")
            return None, None
            
    except Exception as e:
        print(f"✗ MongoDB connection failed: {e}")
        return None, None


def test_elasticsearch_connection():
    """Test Elasticsearch connection and index."""
    print("\n" + "="*60)
    print("STEP 2: Testing Elasticsearch Connection")
    print("="*60)
    
    try:
        from clients import es_client
        
        # Check connection
        if es_client.ping():
            print("✓ Elasticsearch connected successfully")
        else:
            print("✗ Elasticsearch ping failed")
            return False, 0
        
        # Check index exists
        index_name = Config.ELASTIC_INDEX
        if es_client.indices.exists(index=index_name):
            print(f"✓ Index '{index_name}' exists")
            
            # Get doc count
            count = es_client.count(index=index_name)
            doc_count = count.get('count', 0)
            print(f"  - Documents indexed: {doc_count}")
            
            # Get mapping info
            mapping = es_client.indices.get_mapping(index=index_name)
            props = mapping[index_name]["mappings"].get("properties", {})
            print(f"  - Fields: {list(props.keys())}")
            
            if "embedding" in props:
                dims = props["embedding"].get("dims", "unknown")
                print(f"  - Embedding dimensions: {dims}")
            
            return True, doc_count
        else:
            print(f"✗ Index '{index_name}' does not exist")
            return False, 0
            
    except Exception as e:
        print(f"✗ Elasticsearch error: {e}")
        import traceback
        traceback.print_exc()
        return False, 0


def test_elasticsearch_sample_documents(collection_id=None):
    """Check what documents exist in ES for a collection."""
    print("\n" + "="*60)
    print("STEP 3: Checking Elasticsearch Documents")
    print("="*60)
    
    try:
        from clients import es_client
        
        query = {"query": {"match_all": {}}, "size": 5}
        if collection_id:
            # Use collection_id.keyword for term queries since the field is analyzed text
            query = {
                "query": {"term": {"collection_id.keyword": collection_id}},
                "size": 5
            }
            print(f"  Filtering by collection_id: {collection_id}")
        
        result = es_client.search(index=Config.ELASTIC_INDEX, body=query)
        hits = result.get("hits", {}).get("hits", [])
        
        print(f"  Found {len(hits)} sample documents")
        
        for i, hit in enumerate(hits, 1):
            source = hit.get("_source", {})
            content_preview = source.get("content", "")[:150] + "..." if source.get("content") else "(empty)"
            print(f"\n  Document {i}:")
            print(f"    - document_id: {source.get('document_id')}")
            print(f"    - collection_id: {source.get('collection_id')}")
            print(f"    - chunk_id: {source.get('chunk_id')}")
            print(f"    - content preview: {content_preview}")
            print(f"    - has embedding: {'embedding' in source}")
            if 'embedding' in source:
                emb = source['embedding']
                print(f"    - embedding length: {len(emb) if isinstance(emb, list) else 'not a list'}")
        
        return len(hits) > 0
        
    except Exception as e:
        print(f"✗ Error querying Elasticsearch: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_embedding_provider():
    """Test embedding generation."""
    print("\n" + "="*60)
    print("STEP 4: Testing Embedding Provider")
    print("="*60)
    
    try:
        from core.ai.factory import AIProviderFactory
        
        embedder = AIProviderFactory.get_embedding_provider()
        print(f"✓ Embedding provider initialized: {type(embedder).__name__}")
        print(f"  - Model: {settings.DEFAULT_EMBEDDING_MODEL}")
        
        # Test embedding generation
        test_text = "This is a test sentence for embedding."
        embedding = await embedder.embed(test_text)
        
        print(f"✓ Embedding generated successfully")
        print(f"  - Dimensions: {len(embedding)}")
        print(f"  - First 5 values: {embedding[:5]}")
        
        # Check if dimensions match config
        expected_dims = settings.EMBEDDING_DIMENSION
        if len(embedding) != expected_dims:
            print(f"  ⚠ WARNING: Embedding dimension mismatch!")
            print(f"    - Generated: {len(embedding)}")
            print(f"    - Expected (EMBEDDING_DIMENSION): {expected_dims}")
        
        return len(embedding)
        
    except Exception as e:
        print(f"✗ Embedding provider error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_hybrid_retriever(collection_id=None):
    """Test hybrid retriever with a sample query."""
    print("\n" + "="*60)
    print("STEP 5: Testing Hybrid Retriever")
    print("="*60)
    
    try:
        from core.ai.factory import AIProviderFactory
        from core.rag.retriever import HybridRetriever
        from clients import es_client
        from core.clients.milvus_client import get_milvus_client
        
        embedder = AIProviderFactory.get_embedding_provider()
        milvus_client = get_milvus_client()
        # Ensure connected for test
        milvus_client.connect()
        
        retriever = HybridRetriever(es_client, embedder, milvus_client=milvus_client)
        
        print(f"✓ HybridRetriever initialized")
        print(f"  - Index: {retriever.index}")
        # Weights removed in Hierarchical RRF version
        
        # Test query
        test_query = "What information is available in the documents?"
        collection_ids = [collection_id] if collection_id else None
        
        print(f"\n  Testing query: '{test_query}'")
        if collection_ids:
            print(f"  With collection filter: {collection_ids}")
        
        results = await retriever.retrieve(
            query=test_query,
            collection_ids=collection_ids,
            top_k=5
        )
        
        print(f"\n  Results: {len(results)} chunks retrieved")
        
        for i, result in enumerate(results, 1):
            print(f"\n  Result {i}:")
            print(f"    - Score: {result.score:.4f}")
            print(f"    - Document ID: {result.document_id}")
            print(f"    - Content preview: {result.content[:100]}...")
        
        return len(results)
        
    except Exception as e:
        print(f"✗ Hybrid retriever error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def test_config_consistency():
    """Check configuration consistency."""
    print("\n" + "="*60)
    print("STEP 6: Checking Configuration Consistency")
    print("="*60)
    
    print(f"  Elasticsearch URL: {settings.ELASTICSEARCH_URL}")
    print(f"  Elasticsearch Index: {settings.ELASTIC_INDEX}")
    print(f"  Embedding Model: {settings.DEFAULT_EMBEDDING_MODEL}")
    print(f"  Embedding Dimension: {settings.EMBEDDING_DIMENSION}")
    print(f"  Vector Weight: {settings.VECTOR_WEIGHT}")
    print(f"  Keyword Weight: {settings.KEYWORD_WEIGHT}")
    
    # Check for dimension mismatch with ES
    try:
        from clients import es_client
        mapping = es_client.indices.get_mapping(index=settings.ELASTIC_INDEX)
        props = mapping[settings.ELASTIC_INDEX]["mappings"].get("properties", {})
        if "embedding" in props:
            es_dims = props["embedding"].get("dims", 0)
            config_dims = settings.EMBEDDING_DIMENSION
            if es_dims != config_dims:
                print(f"\n  ⚠ DIMENSION MISMATCH DETECTED!")
                print(f"    - ES Index dims: {es_dims}")
                print(f"    - Config dims: {config_dims}")
                print(f"    This could cause search failures!")
            else:
                print(f"\n  ✓ Dimensions match: {es_dims}")
    except Exception as e:
        print(f"  Could not verify ES dimensions: {e}")


async def run_all_tests():
    """Run all RAG pipeline tests."""
    print("\n" + "="*60)
    print("  RAG PIPELINE END-TO-END TEST")
    print("="*60)
    print(f"  Timestamp: {datetime.now().isoformat()}")
    
    # Step 1: MongoDB
    doc_id, collection_id = test_mongodb_connection()
    
    # Step 2: Elasticsearch connection
    es_ok, es_count = test_elasticsearch_connection()
    
    # Step 3: Sample ES documents
    if es_ok and es_count > 0:
        test_elasticsearch_sample_documents(collection_id)
    
    # Step 4: Embedding provider
    embedding_dims = await test_embedding_provider()
    
    # Step 5: Hybrid retriever
    if es_ok and es_count > 0:
        results_count = await test_hybrid_retriever(collection_id)
    else:
        print("\n  Skipping retriever test - no documents in Elasticsearch")
        results_count = 0
    
    # Step 6: Config
    test_config_consistency()
    
    # Summary
    print("\n" + "="*60)
    print("  SUMMARY")
    print("="*60)
    
    issues = []
    
    if not doc_id:
        issues.append("No processed documents in MongoDB")
    if not es_ok:
        issues.append("Elasticsearch connection failed")
    if es_count == 0:
        issues.append("No documents in Elasticsearch index")
    if embedding_dims is None:
        issues.append("Embedding provider failed")
    if results_count == 0:
        issues.append("Retriever returned no results")
    
    if issues:
        print("  ❌ Issues found:")
        for issue in issues:
            print(f"    - {issue}")
    else:
        print("  ✅ All tests passed!")
    
    return len(issues) == 0


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
