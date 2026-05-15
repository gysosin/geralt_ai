# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

GeraltAI is an AI-powered document processing and RAG (Retrieval-Augmented Generation) system with a FastAPI backend and React/TypeScript frontend.

## Development Commands

### Backend (geralt-ai-fastapi/)

```bash
# Activate virtual environment
cd geralt-ai-fastapi
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run API server (auto-starts Celery worker in dev mode)
uvicorn main:app --reload --port 8000

# Run Celery worker separately (recommended for debugging)
celery -A core.tasks worker --loglevel=info

# Run all tests
pytest

# Run a single test file
pytest tests/test_rag_pipeline.py

# Run a specific test
pytest tests/test_rag_pipeline.py::test_function_name -v
```

### Frontend (new_ui/)

```bash
cd new_ui
npm install
npm run dev      # Development server
npm run build    # Production build
```

### Infrastructure

Requires MongoDB, Redis, Elasticsearch, MinIO, and Milvus. Start with:
```bash
docker-compose up -d
```

## Architecture

### Backend Structure

- **main.py**: AppFactory pattern handles startup/shutdown, auto-starts Celery, mounts Socket.IO
- **api/v1/**: REST endpoints organized by domain (auth, bots, collections, conversations, files, users)
- **services/**: Business logic layer (bots, collections, conversations, users, storage_stats)
- **core/**: Framework components

### AI Provider System (core/ai/)

Factory pattern with swappable AI backends:
- **base.py**: Abstract interfaces (`EmbeddingProvider`, `LLMProvider`, `RerankerProvider`)
- **factory.py**: `AIProviderFactory` creates providers based on `DEFAULT_AI_MODEL` setting
- **gemini.py, openai.py, mistral.py**: Concrete implementations
- **cohere.py**: Reranker implementation

Use `AIProviderFactory.get_llm_provider()` or `get_embedding_provider()` to get instances.

### RAG Pipeline (core/rag/)

Hierarchical hybrid retrieval with RRF (Reciprocal Rank Fusion):

1. **pipeline.py**: `RAGPipeline` orchestrates retrieve → rerank → generate. `RAGPipelineBuilder` for configuration.
2. **retriever.py**: `HybridRetriever` combines:
   - Milvus vector search (child chunks)
   - Elasticsearch BM25 (parent chunks)
   - RRF fusion merges results
3. **query_classifier.py**: Routes queries to specialized handlers (AGGREGATION, SUMMARY, or standard QA)
4. **query_enhancer.py**: LLM-based query expansion for better retrieval
5. **chunker.py**: Parent/child chunking strategy for hierarchical retrieval
6. **aggregation_engine.py**: Handles aggregation queries over structured extracted data
7. **collection_summarizer.py**: Generates collection summaries

### Document Processing (core/extraction/)

- **documents.py**: PDF/DOCX/PPTX/XLSX extraction with bounding boxes
- **converters.py**: Universal conversion to PDF (via LibreOffice)
- **structured_extractor.py**: LLM-based structured data extraction from documents
- **text.py, media.py, web.py**: Specialized extractors

### Background Tasks (core/tasks/)

Celery tasks for async processing:
- **document_tasks.py**: Document ingestion, chunking, embedding generation, OCR
- **collection_tasks.py**: Collection-level operations

Tasks communicate progress via Socket.IO (helpers/socketio_instance.py).

### Frontend Structure (new_ui/)

- **App.tsx**: Main router component
- **src/store/**: Zustand state management
- **src/services/**: API client functions
- **components/**: Reusable UI components
- Uses Vite, React 19, React Router, Framer Motion, Recharts

## Key Patterns

### Adding a New AI Provider
1. Create implementation in `core/ai/` extending `EmbeddingProvider` and/or `LLMProvider`
2. Add enum value to `AIModel` in `factory.py`
3. Add case to factory methods

### Adding a New API Endpoint
1. Create router in `api/v1/{domain}/router.py`
2. Import and include in `api/v1/router.py`

### Document Processing Flow
1. Upload → MinIO storage
2. Celery task triggered → Extraction (with OCR if needed)
3. Chunking (parent/child) → Elasticsearch (parents) + Milvus (children with embeddings)
4. Query → Hybrid retrieval → RRF fusion → LLM generation

## System Dependencies

Backend requires system packages for document processing:
- tesseract-ocr (OCR)
- poppler-utils (PDF processing)
- libreoffice (DOCX/PPTX/XLSX → PDF conversion)
