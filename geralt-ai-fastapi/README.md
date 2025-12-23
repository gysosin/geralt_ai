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
    SECRET_KEY=your_secure_jwt_secret_here
    DEBUG=True
    
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

### 3. Start the Celery Worker
This processes background tasks like document ingestion, embedding generation, and OCR.
```bash
celery -A core.tasks worker --loglevel=info
```
> **Note:** The API server attempts to auto-start a worker process for development convenience, but running it separately is recommended for production or debugging.

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
