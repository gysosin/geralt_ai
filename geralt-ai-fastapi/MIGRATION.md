# FastAPI Migration - GeraltAI API

Complete migration from Flask to FastAPI with OOP patterns, Gemini AI support, and industry-standard RAG.

## Migration Summary

| Component | Flask (Old) | FastAPI (New) | Status |
|-----------|-------------|---------------|--------|
| Bot Tokens | `routes/bot_management.py` | `api/v1/bots/router.py` | ✅ Complete |
| Search/RAG | `routes/bot_management.py` | `api/v1/bots/router.py` | ✅ Complete |
| Quizzes | `routes/bot_management.py` | `api/v1/bots/router.py` | ✅ Complete |
| Analytics | `routes/bot_management.py` | `api/v1/bots/router.py` | ✅ Complete |
| Templates | `routes/bot_management.py` | `api/v1/bots/router.py` | ✅ Complete |
| Sharing | `routes/bot_management.py` | `api/v1/bots/router.py` | ✅ Complete |
| Embed Codes | `routes/bot_management.py` | `api/v1/bots/router.py` | ✅ Complete |
| Auth | `routes/auth.py` | `api/v1/auth/router.py` | ✅ Complete |
| Collections | `routes/collections.py` | `api/v1/collections/router.py` | ✅ Complete |
| Conversations | `routes/conversations.py` | `api/v1/conversations/router.py` | ✅ Complete |
| Users | `routes/user_management.py` | `api/v1/users/router.py` | ✅ Complete |

## Route Mapping

### Bot Management Routes

| Flask Route | FastAPI Route | Method |
|-------------|---------------|--------|
| `/generate_bot_token` | `/api/v1/bots/tokens` | POST |
| `/get_bot_tokens` | `/api/v1/bots/tokens` | GET |
| `/get_bot_token_details` | `/api/v1/bots/tokens/{bot_token}` | GET |
| `/update_bot_token` | `/api/v1/bots/tokens` | PUT |
| `/delete_bot_token` | `/api/v1/bots/tokens` | DELETE |
| `/search_with_bot_token` | `/api/v1/bots/search` | POST |
| `/share_bot_token` | `/api/v1/bots/share` | POST |
| `/view_shared_users` | `/api/v1/bots/shared-users` | GET |
| `/update_shared_user_role` | `/api/v1/bots/shared-users/update-role` | POST |
| `/remove_shared_user` | `/api/v1/bots/shared-users/remove` | POST |
| `/get_templates` | `/api/v1/bots/templates` | GET |
| `/create_template` | `/api/v1/bots/templates` | POST |
| `/generate_embed_code` | `/api/v1/bots/embed-codes` | POST |
| `/get_embed_code` | `/api/v1/bots/embed-codes` | GET |
| `/delete_embed_code` | `/api/v1/bots/embed-codes` | DELETE |
| `/get_all_conversations` | `/api/v1/bots/conversations` | GET |
| `/get_bot_conversation` | `/api/v1/bots/conversations/{id}` | GET |
| `/update_bot_conversation` | `/api/v1/bots/conversations` | PUT |
| `/delete_single_conversation` | `/api/v1/bots/conversations/{id}` | DELETE |

### Quiz Routes

| Flask Route | FastAPI Route | Method |
|-------------|---------------|--------|
| `/quizzes` | `/api/v1/bots/quizzes` | GET |
| `/quizzes/<id>` | `/api/v1/bots/quizzes/{id}` | GET |
| `/quizzes/grouped` | `/api/v1/bots/quizzes/grouped` | GET |
| `/quizzes/categories` | `/api/v1/bots/quizzes/categories` | GET |
| `/quizzes/results` | `/api/v1/bots/quizzes/results` | GET |
| `/quizzes/performance` | `/api/v1/bots/quizzes/performance` | GET |
| `/start_quiz` | `/api/v1/bots/quizzes/start` | POST |
| `/submit_quiz` | `/api/v1/bots/quizzes/submit` | POST |
| `/save_quiz_progress` | `/api/v1/bots/quizzes/progress` | POST |
| `/quiz/<id>` | `/api/v1/bots/quizzes/{id}` | PUT/DELETE |
| `/quiz/<id>/attempts` | `/api/v1/bots/quizzes/{id}/attempts` | GET |
| `/quiz/<id>/attempts/<aid>` | `/api/v1/bots/quizzes/{id}/attempts/{aid}` | DELETE |

### Dashboard & Analytics Routes

| Flask Route | FastAPI Route | Method |
|-------------|---------------|--------|
| `/dashboard` | `/api/v1/bots/dashboard` | GET |
| `/dashboard/progress` | `/api/v1/bots/dashboard/progress` | GET |
| `/dashboard/recommendations` | `/api/v1/bots/dashboard/recommendations` | GET |
| `/view_token_logs` | `/api/v1/bots/analytics/logs` | GET |
| `/delete_token` | `/api/v1/bots/analytics/logs` | DELETE |
| `/usage_summary` | `/api/v1/bots/analytics/summary` | GET |
| `/daily_usage` | `/api/v1/bots/analytics/daily` | GET |
| `/top_users` | `/api/v1/bots/analytics/top-users` | GET |
| `/top_models` | `/api/v1/bots/analytics/top-models` | GET |

### Auth Routes

| Flask Route | FastAPI Route | Method |
|-------------|---------------|--------|
| `/login` | `/api/v1/auth/login` | POST |
| `/register` | `/api/v1/auth/register` | POST |
| `/login/microsoft` | `/api/v1/auth/login/microsoft` | GET |
| `/callback` | `/api/v1/auth/callback` | GET |
| `/me` | `/api/v1/auth/me` | GET |

### Collection Routes

| Flask Route | FastAPI Route | Method |
|-------------|---------------|--------|
| `/create_collection` | `/api/v1/collections/` | POST |
| `/get_collections` | `/api/v1/collections/` | GET |
| `/update_collection` | `/api/v1/collections/` | PUT |
| `/delete_collection` | `/api/v1/collections/{id}` | DELETE |
| `/upload_documents` | `/api/v1/collections/upload` | POST |
| `/process_document` | `/api/v1/collections/process` | POST |
| `/list_documents` | `/api/v1/collections/documents` | POST |
| `/share_collection` | `/api/v1/collections/share` | POST |

### Conversation Routes

| Flask Route | FastAPI Route | Method |
|-------------|---------------|--------|
| `/search_with_conversation` | `/api/v1/conversations/search` | POST |
| `/get_all_conversations` | `/api/v1/conversations/` | GET |
| `/get_conversations_by_collection` | `/api/v1/conversations/by-collection` | GET |
| `/get_conversation` | `/api/v1/conversations/{id}` | GET |
| `/delete_conversation` | `/api/v1/conversations/{id}` | DELETE |
| `/search` (public) | `/api/v1/conversations/search/public` | GET |

### User Routes

| Flask Route | FastAPI Route | Method |
|-------------|---------------|--------|
| `/profile` | `/api/v1/users/profile` | GET |
| `/profile/update` | `/api/v1/users/profile` | PUT |
| `/profile/delete` | `/api/v1/users/profile` | DELETE |
| `/tenants` | `/api/v1/users/tenants` | GET/POST |

## New Features in FastAPI Version

### 1. Gemini AI Support
```python
# Set in .env
DEFAULT_AI_MODEL=gemini
GEMINI_API_KEY=your_key
```

### 2. Enhanced RAG Pipeline
- Semantic chunking (512 chars, 128 overlap)
- Hybrid retrieval (BM25 + vector similarity)
- Cohere reranking support

### 3. OOP Architecture
- Class-based controllers
- Factory pattern for AI providers
- Repository pattern for data access

## Running FastAPI

```bash
cd GeraltAI-API
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Access Swagger UI: http://localhost:8000/docs

## Files to Delete (Old Flask)

After verifying FastAPI works:

```bash
rm -rf routes/
rm app.py
rm initializations.py
rm swagger/
```

Keep:
- `services/` - Business logic (reused by FastAPI)
- `helpers/` - Utility functions (reused)
- `models/database.py` - MongoDB collections (reused)
- `celery_tasks.py` - Background tasks (reused)
