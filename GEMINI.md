# GeraltAI Project

## Project Overview

GeraltAI is a full-stack AI-powered application consisting of a Python-based Flask API backend and an Angular-based frontend managed within an Nx workspace. The system integrates various advanced AI technologies (LangChain, OpenAI, Mistral, Milvus) for document processing, RAG (Retrieval-Augmented Generation), and likely audio/video processing (Whisper, YouTube tools).

### Architecture

*   **Backend (`GeraltAI-API/`):**
    *   **Framework:** Flask (with Flask-RESTx, Flask-SocketIO).
    *   **Database:** MongoDB (Data), Milvus (Vector DB), Redis (Cache/Queue), Elasticsearch.
    *   **Storage:** MinIO (Object Storage).
    *   **AI/ML:** LangChain, OpenAI, MistralAI, Cohere, Whisper.
    *   **Async Tasks:** Celery.
    *   **Document Processing:** PyPDF2, python-docx, pdfplumber, pytube, yt-dlp.

*   **Frontend (`ui/`):**
    *   **Framework:** Angular 18.
    *   **Build System:** Nx (Smart Monorepo).
    *   **UI Libraries:** Angular Material, Tailwind CSS, AG Grid Enterprise, ECharts.
    *   **State Management:** NgRx.
    *   **Apps:** `ers` (Main application).

## Building and Running

### Backend (`GeraltAI-API/`)

1.  **Environment Setup:**
    *   Ensure a `.env` file exists (refer to `dev.env` or `prod.env` as templates).
    *   Install dependencies:
        ```bash
        pip install -r requirements.txt
        ```

2.  **Running the API:**
    *   Directly with Python:
        ```bash
        python app.py
        ```
    *   With Docker (Recommended for dependencies like Milvus/Redis):
        ```bash
        docker-compose up --build
        ```

### Frontend (`ui/`)

1.  **Installation:**
    ```bash
    npm install
    ```

2.  **Development Server:**
    *   Run the `ers` application:
        ```bash
        npx nx serve ers
        ```
    *   The application will typically run on `http://localhost:4200`.

3.  **Building for Production:**
    ```bash
    npx nx build ers --configuration=production
    ```
    *   Artifacts will be output to `dist/apps/ers`.

4.  **Running Tests:**
    *   Unit Tests (Jest): `npx nx test ers`
    *   E2E Tests (Playwright): `npx nx e2e ers-e2e`

## Development Conventions

*   **Code Style:**
    *   **Python:** Follow PEP 8.
    *   **TypeScript/Angular:** Follow standard Angular style guide. ESLint and Prettier are configured.
*   **State Management:** The frontend uses NgRx for complex state management.
*   **Git:** This project appears to use Git. Ensure `.gitignore` files are respected.
*   **Configuration:**
    *   Backend config is managed via `config.py` and environment variables.
    *   Frontend environments are likely managed via `project.json` configurations (dev, qa, stg, prod).

## Key Directories

*   `GeraltAI-API/routes/`: API endpoint definitions.
*   `GeraltAI-API/services/`: Business logic layer.
*   `GeraltAI-API/models/`: Database models (MongoDB).
*   `GeraltAI-API/rag.py`: RAG (Retrieval-Augmented Generation) implementation.
*   `ui/apps/ers/`: Main Angular application source.
*   `ui/libs/`: Shared Angular libraries (components, services, state).
