# Geralt AI - Detailed API Specification

This document provides a comprehensive technical breakdown of the Geralt AI Backend API. It is intended for developers, AI assistants, and architects to understand the server-side contract, data models, and logic flow.

## 🛠 Tech Stack Context
- **Framework:** FastAPI (Python 3.10+)
- **Database:** MongoDB (Data), Milvus (Vector Search), Redis (Caching/Queue)
- **Asynchronous Task Queue:** Celery
- **Object Storage:** MinIO (S3 Compatible)
- **Authentication:** JWT (JSON Web Tokens) & Microsoft OAuth 2.0
- **AI Integration:** LangChain, OpenAI, Mistral, Gemini

---

## 1. API Structure & Entry Point
- **Root URL:** `/api/v1`
- **Documentation:** `/docs` (Swagger UI), `/redoc` (ReDoc)
- **Entry Point:** `main.py` (Initializes FastAPI app, middleware, and routers)

---

## 2. Authentication (`/api/v1/auth`)
**Purpose:** Handle user identity, registration, and session management.

### Endpoints
*   `POST /register`
    *   **Payload:** `username`, `email`, `password`, `firstname`, `lastname`.
    *   **Logic:** Hashes password, creates user in `users` collection.
*   `POST /login`
    *   **Payload:** `email` (or username), `password`.
    *   **Response:** JWT `access_token`.
*   `GET /login/microsoft`
    *   **Logic:** Generates Microsoft OAuth authorization URL and redirects user.
*   `GET /callback` (Microsoft)
    *   **Logic:** Exchanges code for token, creates/updates user from MS profile, returns JWT.
*   `GET /me`
    *   **Logic:** Returns profile of the currently authenticated user (parsed from JWT).

---

## 3. Bot Management (`/api/v1/bots`)
**Purpose:** Manage AI assistants (Bots), their configuration, and deployment.

### Endpoints
*   `POST /tokens` (Create Bot)
    *   **Payload:** `name`, `prompt` (System Prompt), `collection_ids` (Knowledge Base), `welcome_message`, `icon` (File).
    *   **Logic:** Creates a bot configuration in `bot_db.tokens`.
*   `GET /tokens`
    *   **Query:** `tenant_id`.
    *   **Response:** List of bots owned by user.
*   `POST /search` (RAG Query)
    *   **Payload:** `query`, `bot_token`, `conversation_id`, `model_preference`.
    *   **Logic:**
        1.  Retrieves bot config.
        2.  Vector search in Milvus for relevant chunks from linked collections.
        3.  Constructs prompt with context.
        4.  Calls LLM (OpenAI/Mistral).
        5.  Returns stream or text response with `sources`.
*   `POST /share` & `GET /shared-users`
    *   **Logic:** Manages permissions for other users to access/edit specific bots.
*   `POST /embed-codes`
    *   **Logic:** Generates a JS snippet for embedding the bot on external sites.

---

## 4. Knowledge Collections (`/api/v1/collections`)
**Purpose:** CRUD for document repositories and file ingestion.

### Endpoints
*   `POST /` (Create Collection)
    *   **Payload:** `name`, `tenant_id`.
*   `GET /`
    *   **Response:** List of collections (Name, File Count, Owner).
*   `POST /upload`
    *   **Payload:** `files` (Multipart), `urls`, `collection_id`.
    *   **Logic:**
        1.  Saves file to MinIO.
        2.  Creates metadata entry in `documents` collection (`status: "uploaded"`).
        3.  Triggers Celery task for processing.
*   `POST /process`
    *   **Payload:** `document_id`.
    *   **Logic:**
        1.  Extracts text (PDF/DOCX/Web).
        2.  Chunks text.
        3.  Generates embeddings (e.g., OpenAI/Cohere).
        4.  Upserts vectors to Milvus.
        5.  Updates status to `completed`.
*   `POST /documents` (List)
    *   **Payload:** `collection_id`.
    *   **Response:** List of files with processing status.

---

## 5. Conversations (`/api/v1/conversations`)
**Purpose:** Manage chat history and context.

### Endpoints
*   `GET /`
    *   **Response:** List of recent conversations (ID, Title, Date).
*   `GET /{conversation_id}`
    *   **Response:** Full message history (`role: "user"`, `role: "assistant"`).
*   `POST /search` (Chat)
    *   **Payload:** `query`, `conversation_id`, `collection_id`.
    *   **Logic:** Similar to Bot Search but scoped to a user's direct chat with a collection.
*   `DELETE /{conversation_id}`
    *   **Logic:** Soft/Hard delete conversation history.

---

## 6. Analytics (`/api/v1/bots/analytics` & `/users`)
**Purpose:** Track usage, token consumption, and costs.

### Endpoints
*   `GET /analytics/summary`
    *   **Response:** Total requests, total tokens, estimated cost.
*   `GET /analytics/daily-usage`
    *   **Logic:** Aggregates `token_logs` collection by date.
*   `GET /analytics/top-models`
    *   **Logic:** Returns distribution of models used (e.g., "gpt-4", "mistral-medium").

---

## 7. Quizzes (`/api/v1/bots/quizzes`)
**Purpose:** Educational/Training module.

### Endpoints
*   `GET /quizzes`
    *   **Response:** List of available quizzes.
*   `POST /quizzes/start`
    *   **Logic:** Initializes a quiz attempt session.
*   `POST /quizzes/submit`
    *   **Logic:** Grades the quiz and saves results to `quiz_results`.

---

## 8. Data Models (MongoDB)

### Database: `document_db`
*   **`users`**: User profile, auth provider info, role.
*   **`collections`**: Metadata for document groups.
*   **`documents`**: File metadata, MinIO path, processing status (`processing`, `completed`, `failed`), vector IDs.
*   **`conversations`**: Chat sessions. Contains `messages` array (content, role, timestamp).

### Database: `bot_db`
*   **`tokens` (Bots)**: Bot config, system prompt, linked `collection_ids`, UI theme preferences.
*   **`token_logs`**: Audit log of every LLM request (input tokens, output tokens, model used, latency).
*   **`embed_codes`**: Active embed scripts and their expiry.
*   **`quizzes`**: Quiz definitions (questions, answers).
*   **`quiz_results`**: User performance data.

---

## 9. Real-time Updates (Socket.IO)
*   **Mount Point:** `/socket.io`
*   **Events:**
    *   `processing_update`: Pushes progress % of document ingestion to frontend.
    *   `deletion_update`: Pushes status of document deletion.

---

## 10. Background Tasks (Celery)
*   **`process_document`**: Heavy lifting for text extraction and vectorization.
*   **`generate_embeddings`**: Calls AI APIs to get vector data.
*   **`upload_to_milvus`**: Inserts vectors into vector DB.
