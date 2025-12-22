# GeraltAI FastAPI

Modern FastAPI backend for GeraltAI with Gemini AI support and enhanced RAG.

## Quick Start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your API keys

# Run server
uvicorn main:app --reload --port 8000
```

## Access

- **API**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Environment Variables

```env
# Required
SECRET_KEY=your_jwt_secret
MONGO_URI=mongodb://127.0.0.1:27018
ELASTICSEARCH_URL=http://127.0.0.1:9209

# AI (set at least one)
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
MISTRAL_API_KEY=your_mistral_key

# Default AI model (gemini, openai, mistral)
DEFAULT_AI_MODEL=gemini
```

## Project Structure

```
geralt-ai-fastapi/
├── main.py              # FastAPI app entry
├── api/                 # API routes
│   └── v1/
│       ├── auth/
│       ├── bots/
│       ├── collections/
│       ├── conversations/
│       └── users/
├── core/                # Core modules
│   ├── ai/              # AI providers (Gemini, OpenAI, Mistral)
│   ├── rag/             # RAG pipeline
│   └── security/        # JWT auth
├── services/            # Business logic
├── helpers/             # Utilities
└── models/              # Database models
```

## Features

- ✅ FastAPI with async support
- ✅ Gemini AI embeddings + LLM
- ✅ Hybrid RAG (BM25 + vector)
- ✅ Semantic chunking
- ✅ JWT authentication
- ✅ Pydantic validation
- ✅ Auto-generated OpenAPI docs
