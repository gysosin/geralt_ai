# GeraltAI FastAPI

Modern, high-performance FastAPI backend for GeraltAI. Features comprehensive RAG (Retrieval-Augmented Generation) support, multi-provider AI integration (Gemini, OpenAI, Mistral), and advanced document processing with OCR capabilities.

## 🚀 Features

- **FastAPI Core**: Fully async, high-performance Python framework.
- **Multi-AI Support**: Seamlessly switch between Google Gemini, OpenAI, and Mistral.
- **Advanced RAG**: Hybrid search using Elasticsearch (BM25) and Vector embeddings.
- **Document Intelligence**: 
  - **Universal Processing**: Converts DOCX, PPTX, XLSX to PDF for unified processing pipeline.
  - Automated text extraction with **pixel-perfect bounding box coordinates**.
  - **Integrated OCR** (Tesseract) for scanned documents and images.
  - **Smart Snapshots**: Generates visual page snapshots with **highlighted regions** showing exact extraction points.
- **Real-time Updates**: Socket.IO integration for live processing status.
- **Background Processing**: Celery + Redis for robust asynchronous task management.
- **Agent Platform**: Reusable agents, deterministic workflows, approval queues, run history, ADK manifests, and MCP-compatible tool declarations.
- **MCP Registry Safety**: External streamable HTTP MCP servers are validated before registration and health checks to reject non-HTTP schemes, localhost, private IPs, link-local addresses, and DNS resolutions to unsafe networks.

## 🛠️ System Requirements

Before setting up the Python environment, ensure the following system-level dependencies are installed:

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update

# OCR (Optical Character Recognition)
sudo apt-get install -y tesseract-ocr libtesseract-dev

# PDF processing
sudo apt-get install -y poppler-utils

# Document conversion (DOCX, PPTX, XLSX → PDF)
sudo apt-get install -y libreoffice-writer libreoffice-impress libreoffice-calc
```

### Linux (Fedora)
```bash
# OCR and PDF tools
sudo dnf install -y tesseract tesseract-langpack-eng poppler-utils

# Document conversion (required for DOCX, PPTX, XLSX → PDF)
sudo dnf install -y libreoffice-headless libreoffice-writer libreoffice-impress libreoffice-calc
```

### macOS
```bash
# OCR and PDF tools
brew install tesseract
brew install poppler

# Document conversion
brew install --cask libreoffice
```

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd geralt-ai-fastapi
    ```

2.  **Create a Virtual Environment**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install Python Dependencies**
    ```bash
    pip install -r requirements.txt
    ```

## ⚙️ Configuration

1.  **Environment Variables**
    Copy the example configuration:
    ```bash
    cp .env.example .env
    ```

2.  **Update `.env`**
    Edit `.env` to include your configuration. Key variables include:

    ```env
    # --- Core ---
    ENVIRONMENT=development
    SECRET_KEY=your_secure_jwt_secret_here
    DEBUG=True
    AUTO_START_CELERY_WORKER=True
    
    # --- Databases ---
    MONGO_URI=mongodb://localhost:27017
    ELASTICSEARCH_URL=http://localhost:9200
    REDIS_URL=redis://localhost:6379/0
    
    # --- Object Storage (MinIO) ---
    MINIO_ENDPOINT=localhost:9000
    MINIO_ACCESS_KEY=minioadmin
    MINIO_SECRET_KEY=minioadmin
    MINIO_BUCKET=geralt-docs
    
    # --- AI Providers (Set your active keys) ---
    GEMINI_API_KEY=your_gemini_key
    OPENAI_API_KEY=your_openai_key
    MISTRAL_API_KEY=your_mistral_key
    
    # --- RAG configuration ---
    DEFAULT_AI_MODEL=gemini
    ```

    For production deployments, set `ENVIRONMENT=production`, replace
    `SECRET_KEY` with a high-entropy value of at least 32 characters, and use
    explicit `CORS_ORIGINS` instead of `*`. Also replace the default MinIO
    credentials, provide API keys for the selected AI model/reranker, and set
    `AUTO_START_CELERY_WORKER=False` so the worker is supervised separately.
    Startup validation rejects unsafe production defaults.

## 🏃 Running the Application

GeraltAI requires both the API server and the Celery worker to be running.

### 1. Start Infrastructure (Docker)
Ensure your supporting services (MongoDB, Redis, Elasticsearch, MinIO) are running. If you have a `docker-compose.yml` for these:
```bash
docker-compose up -d
```

### 2. Start the API Server
This handles HTTP requests and WebSocket connections.
```bash
uvicorn main:app --reload --port 8000
```
*   **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
*   **Root**: [http://localhost:8000](http://localhost:8000)
*   **Liveness**: [http://localhost:8000/health](http://localhost:8000/health)
*   **Readiness**: [http://localhost:8000/ready](http://localhost:8000/ready) returns `503` if MongoDB, Redis, or MinIO is unavailable.

### 3. Start the Celery Worker
This processes background tasks like document ingestion, embedding generation, and OCR.
```bash
celery -A core.tasks worker --loglevel=info
```
> **Note:** The API server can auto-start one worker process for development convenience when `AUTO_START_CELERY_WORKER=True`. Production must run the worker separately under its process supervisor.

## 👤 Admin Bootstrap

Create the initial admin user with an explicit password:

```bash
GERALT_ADMIN_PASSWORD='replace-with-a-strong-password' python scripts/create_admin_user.py
```

Optional overrides: `GERALT_ADMIN_EMAIL`, `GERALT_ADMIN_USERNAME`,
`GERALT_ADMIN_FIRSTNAME`, and `GERALT_ADMIN_LASTNAME`. The script refuses
passwords shorter than 12 characters and never logs the plaintext password.

## 🤖 Agent Platform Operations

The `/api/v1/agent-platform` API exposes document intelligence as reusable agent and workflow primitives:

- `GET /tools` lists built-in tools and MCP-ready tool declarations.
- `POST /agents` creates reusable agents with approved tool contracts.
- `POST /workflows` creates deterministic multi-step workflows.
- `POST /workflows/{workflow_id}/runs` starts a workflow run with optional dry-run planning.
- `GET /workflow-runs/pending-approvals` lists human approval interrupts with step arguments and run inputs.
- `POST /workflow-runs/{run_id}/steps/{step_id}/approve` resumes an approved step.
- `POST /workflow-runs/{run_id}/steps/{step_id}/reject` blocks a run with an auditable rejection reason.
- `GET /adk/manifest` exports agents, workflows, and MCP toolsets for ADK-oriented runtimes.

### MCP Server Registration

Streamable HTTP MCP servers must use `http` or `https` and must not point to local or private infrastructure. The service rejects obvious unsafe targets during create/update and resolves hostnames during health checks before making outbound requests. Register local developer tools with the `stdio` transport instead of pointing streamable HTTP at `localhost`.

## 📂 Project Structure

```
geralt-ai-fastapi/
├── main.py              # Application entry point & AppFactory
├── api/
│   └── v1/              # API Routes (Auth, Bots, Collections, Files, etc.)
├── core/
│   ├── ai/              # AI Interface & Providers (Gemini/OpenAI/Mistral)
│   ├── extraction/      # Document Extraction & OCR Logic
│   ├── rag/             # Retrieval & Ranking Logic
│   └── tasks/           # Celery Tasks (background jobs)
├── services/            # Business Logic Layer
└── models/              # Pydantic & DB Models
```
