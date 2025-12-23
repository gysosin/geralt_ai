"""
Bots Router

Complete bot management endpoints including tokens, search, quizzes, analytics, and sharing.
Migrated from Flask routes/bot_management.py
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query, UploadFile, File, Form
from pydantic import BaseModel, Field

from api.deps import get_current_user, get_optional_user
from services.bots import (
    get_token_service,
    get_sharing_service,
    get_search_service,
    get_template_service,
    get_embed_service,
    get_quiz_service,
    get_analytics_service,
    get_configuration_service,
    BotTokenService,
    BotSharingService,
    BotSearchService,
    TemplateService, # type: ignore
    EmbedService,    # type: ignore
    QuizService,     # type: ignore
    AnalyticsService, # type: ignore
    ConfigurationService # type: ignore
)
from services.conversations.conversation_service import get_conversation_service, ConversationService

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

class BotTokenCreate(BaseModel):
    name: str = Field(min_length=1)
    tenant_id: str
    collection_ids: List[str] = Field(default_factory=list)
    prompt: Optional[str] = None
    theme: Optional[str] = None
    description: Optional[str] = None
    welcome_message: Optional[str] = None
    # Add other fields as needed based on service requirements

class BotTokenDelete(BaseModel):
    bot_token: str
    tenant_id: str

class ShareBotRequest(BaseModel):
    bot_token: str
    user: str
    role: str = "read-only"
    tenant_id: Optional[str] = None

class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    bot_token: str
    conversation_id: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=20)
    model_preference: Optional[str] = None
    embedding_preference: str = "mistral"

class EmbedCodeCreate(BaseModel):
    bot_token: str
    tenant_id: str
    expiry_date: Optional[str] = None

class QuizStartRequest(BaseModel):
    quiz_id: str
    bot_token: Optional[str] = None

class QuizSubmitRequest(BaseModel):
    quiz_id: str
    attempt_id: str
    answers: Dict[str, Any] # Assuming answers structure

class QuizProgressRequest(BaseModel):
    quiz_id: str
    attempt_id: str
    question_id: str
    selected_option: str

class UpdateConversationRequest(BaseModel):
    conversation_id: str
    name: str
    bot_token: str


# =============================================================================
# Configuration Routes
# =============================================================================

@router.get("/config")
async def get_configuration(
    service: ConfigurationService = Depends(get_configuration_service)
):
    """Get application configuration (available models)."""
    result = service.get_available_models()
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# =============================================================================
# Bot Token Routes
# =============================================================================

@router.post("/tokens")
async def create_token(
    request: Request,
    current_user: str = Depends(get_current_user),
    service: BotTokenService = Depends(get_token_service)
):
    """Create a new bot token."""
    # Since create accepts form data and files, we expect multipart request
    # FastAPI handles this best with explicit params, but to keep dynamic form support
    # we can parse the request.
    form_data = await request.form()
    # Pass FormData directly to service to preserve .getlist() capability
    data_dict = form_data
    # Extract files if any
    files = {}
    if "icon" in data_dict and isinstance(data_dict["icon"], UploadFile):
        files["icon"] = data_dict["icon"]
    
    result = service.create(current_user, data_dict, files)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/tokens")
async def list_tokens(
    tenant_id: str = Query(...),
    current_user: str = Depends(get_current_user),
    service: BotTokenService = Depends(get_token_service)
):
    """List all bot tokens for current user."""
    result = service.list(current_user, tenant_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/tokens/{bot_token}")
async def get_token_details(
    bot_token: str,
    tenant_id: Optional[str] = Query(None),
    current_user: Optional[str] = Depends(get_optional_user),
    service: BotTokenService = Depends(get_token_service)
):
    """Get bot token details."""
    # If unauthenticated, we might still allow public access if logic supports it,
    # but service expects identity. If None, it might fail or handle public.
    # We'll pass identity if available.
    identity = current_user if current_user else "anonymous"
    result = service.get(identity, bot_token, tenant_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.put("/tokens")
async def update_token(
    request: Request,
    current_user: str = Depends(get_current_user),
    service: BotTokenService = Depends(get_token_service)
):
    """Update a bot token."""
    form_data = await request.form()
    data_dict = dict(form_data)
    files = {}
    if "icon" in data_dict and isinstance(data_dict["icon"], UploadFile):
        files["icon"] = data_dict["icon"]
    
    bot_token = data_dict.get("bot_token")
    if not bot_token:
        raise HTTPException(status_code=400, detail="bot_token required")
        
    result = service.update(current_user, bot_token, data_dict, files)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.delete("/tokens")
async def delete_token(
    data: BotTokenDelete, 
    current_user: str = Depends(get_current_user),
    service: BotTokenService = Depends(get_token_service)
):
    """Delete a bot token."""
    result = service.delete(current_user, data.bot_token)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/tokens/{bot_token}/icon")
async def get_bot_icon(
    bot_token: str, 
    current_user: Optional[str] = Depends(get_optional_user),
    service: BotTokenService = Depends(get_token_service)
):
    """Get bot icon content."""
    # Publicly accessible via proxy usually, but service requires identity for permission check?
    # get_icon service method checks DB.
    identity = current_user if current_user else "anonymous"
    result = service.get_icon(identity, bot_token)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    
    # Return raw content
    from fastapi.responses import Response
    return Response(content=result.data["content"], media_type=result.data["content_type"])


# =============================================================================
# Search Routes
# =============================================================================

@router.post("/search")
async def search(
    data: SearchRequest, 
    current_user: Optional[str] = Depends(get_optional_user),
    service: BotSearchService = Depends(get_search_service)
):
    """Perform RAG search using bot token."""
    result = await service.search(
        bot_token=data.bot_token,
        identity=current_user,
        query=data.query,
        conversation_id=data.conversation_id,
        model_preference=data.model_preference,
        embedding_preference=data.embedding_preference
    )
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# =============================================================================
# Sharing Routes
# =============================================================================

@router.post("/share")
async def share_bot(
    data: ShareBotRequest, 
    current_user: str = Depends(get_current_user),
    service: BotSharingService = Depends(get_sharing_service)
):
    """Share bot with another user."""
    result = service.share_bot(current_user, data.bot_token, data.user, data.role)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/shared-users")
async def view_shared_users(
    bot_token: str = Query(...),
    tenant_id: str = Query(...),
    current_user: str = Depends(get_current_user),
    service: BotSharingService = Depends(get_sharing_service)
):
    """View users bot is shared with."""
    result = service.list_shared_users(current_user, bot_token, tenant_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.post("/shared-users/update-role")
async def update_shared_user_role(
    bot_token: str,
    user: str,
    role: str,
    tenant_id: str,
    current_user: str = Depends(get_current_user),
    service: BotSharingService = Depends(get_sharing_service)
):
    """Update shared user's role."""
    result = service.update_role(current_user, bot_token, user, role, tenant_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.post("/shared-users/remove")
async def remove_shared_user(
    bot_token: str,
    user: str,
    current_user: str = Depends(get_current_user),
    service: BotSharingService = Depends(get_sharing_service)
):
    """Remove shared user from bot."""
    result = service.remove_user(current_user, bot_token, user)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# =============================================================================
# Templates Routes
# =============================================================================

@router.get("/templates")
async def list_templates(
    service: TemplateService = Depends(get_template_service)
):
    """Get available bot templates."""
    result = service.list()
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.post("/templates")
async def create_template(
    request: Request, 
    current_user: str = Depends(get_current_user),
    service: TemplateService = Depends(get_template_service)
):
    """Create a new template."""
    form_data = await request.form()
    data_dict = dict(form_data)
    files = {}
    if "image" in data_dict and isinstance(data_dict["image"], UploadFile):
        files["image"] = data_dict["image"]
        
    result = service.create(current_user, data_dict, files.get("image"))
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# =============================================================================
# Embed Code Routes
# =============================================================================

@router.post("/embed-codes")
async def generate_embed_code(
    data: EmbedCodeCreate, 
    current_user: str = Depends(get_current_user),
    service: EmbedService = Depends(get_embed_service)
):
    """Generate embed code for a bot."""
    result = service.generate_code(data.model_dump(), data.tenant_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/embed-codes")
async def get_embed_codes(
    bot_token: str = Query(...), 
    current_user: str = Depends(get_current_user),
    service: EmbedService = Depends(get_embed_service)
):
    """Get embed codes for a bot."""
    result = service.get_codes(bot_token)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.delete("/embed-codes")
async def delete_embed_code(
    bot_token: str = Query(...),
    secret_key: str = Query(...),
    current_user: str = Depends(get_current_user),
    service: EmbedService = Depends(get_embed_service)
):
    """Delete an embed code."""
    result = service.delete_code(bot_token, secret_key)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# =============================================================================
# Conversation Routes
# =============================================================================

@router.get("/conversations")
async def get_all_conversations(
    bot_token: str = Query(...),
    current_user: str = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service)
):
    """Get all conversations for a bot."""
    result = service.get_all_for_bot(current_user, bot_token)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    bot_token: str = Query(...),
    current_user: Optional[str] = Depends(get_optional_user),
    service: ConversationService = Depends(get_conversation_service)
):
    """Get a specific conversation."""
    identity = current_user if current_user else "anonymous"
    result = service.get(identity, conversation_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.put("/conversations")
async def update_conversation(
    data: UpdateConversationRequest,
    current_user: str = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service)
):
    """Update conversation name."""
    result = service.rename(current_user, data.conversation_id, data.name)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    bot_token: str = Query(...),
    current_user: Optional[str] = Depends(get_optional_user),
    service: ConversationService = Depends(get_conversation_service)
):
    """Delete a conversation."""
    identity = current_user if current_user else "anonymous"
    result = service.delete(identity, conversation_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# =============================================================================
# Quiz Routes
# =============================================================================

@router.get("/quizzes")
async def get_all_quizzes(
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Get all quizzes for current user."""
    result = service.list_quizzes(current_user)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/quizzes/grouped")
async def get_quizzes_by_category(
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Get quizzes grouped by category."""
    # Group quizzes by category from list_quizzes
    result = service.list_quizzes(current_user)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    
    quizzes = result.data.get("quizzes", [])
    grouped = {}
    for quiz in quizzes:
        cat = quiz.get("category", "General")
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(quiz)
    return {"grouped_quizzes": grouped}

@router.get("/quizzes/categories")
async def get_quiz_categories(
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Get all quiz categories."""
    result = service.list_quizzes(current_user)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    
    quizzes = result.data.get("quizzes", [])
    categories = list(set(q.get("category", "General") for q in quizzes))
    return {"categories": categories}

@router.get("/quizzes/results")
async def get_quiz_results(
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Get all quiz results for user."""
    result = service.get_quiz_results(current_user)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/quizzes/performance")
async def analyze_performance(
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Analyze user quiz performance."""
    result = service.get_quiz_results(current_user)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    
    results = result.data.get("results", [])
    if not results:
        return {"average_score": 0, "total_quizzes": 0, "performance": "No data"}
    
    scores = [r.get("score_percentage", 0) for r in results]
    avg_score = sum(scores) / len(scores) if scores else 0
    return {
        "average_score": avg_score,
        "total_quizzes": len(results),
        "performance": "Excellent" if avg_score >= 80 else "Good" if avg_score >= 60 else "Needs Improvement"
    }

@router.get("/quizzes/{quiz_id}")
async def get_quiz_details(
    quiz_id: str, 
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Get quiz details."""
    result = service.get_quiz(current_user, quiz_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/quizzes/{quiz_id}/attempts")
async def get_quiz_attempts(
    quiz_id: str, 
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Get all attempts for a quiz."""
    result = service.get_quiz_attempts(current_user, quiz_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.post("/quizzes/start")
async def start_quiz(
    data: QuizStartRequest, 
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Start a quiz attempt."""
    result = service.start_quiz(current_user, data.quiz_id, data.bot_token)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.post("/quizzes/submit")
async def submit_quiz(
    data: QuizSubmitRequest, 
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Submit a quiz."""
    result = service.submit_quiz(current_user, data.quiz_id, data.attempt_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.post("/quizzes/progress")
async def save_quiz_progress(
    data: QuizProgressRequest, 
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Save quiz progress."""
    result = service.save_progress(
        current_user, 
        data.quiz_id, 
        data.attempt_id, 
        data.question_id, 
        data.selected_option
    )
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.put("/quizzes/{quiz_id}")
async def update_quiz(
    quiz_id: str, 
    request: Request, 
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Update a quiz."""
    # Quiz update not implemented in service, return not implemented
    raise HTTPException(status_code=501, detail="Quiz update not implemented")

@router.delete("/quizzes/{quiz_id}")
async def delete_quiz(
    quiz_id: str, 
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Delete a quiz."""
    result = service.delete_quiz(current_user, quiz_id)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.delete("/quizzes/{quiz_id}/attempts/{attempt_id}")
async def delete_quiz_attempt(
    quiz_id: str, 
    attempt_id: str, 
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Delete a quiz attempt."""
    # Not implemented in service
    raise HTTPException(status_code=501, detail="Delete attempt not implemented")


# =============================================================================
# Dashboard Routes
# =============================================================================

@router.get("/dashboard")
async def dashboard_summary(
    current_user: str = Depends(get_current_user),
    service: QuizService = Depends(get_quiz_service)
):
    """Get dashboard summary (handled by QuizService or dedicated)."""
    # Assuming methods are on QuizService or similar
    if hasattr(service, "dashboard_summary"):
        result = await service.dashboard_summary(current_user)
    else:
        # Fallback if method missing
        return {"message": "Not implemented"}
    
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

# =============================================================================
# Analytics Routes
# =============================================================================
# ... (Simulated for brevity, similar pattern)

# =============================================================================
# Analytics Routes
# =============================================================================

@router.get("/analytics/summary")
async def usage_summary(
    current_user: str = Depends(get_current_user),
    bot_token: Optional[str] = Query(None),
    service: AnalyticsService = Depends(get_analytics_service)
):
    """Get usage summary statistics."""
    result = service.usage_summary(bot_token=bot_token)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/analytics/daily-usage")
async def daily_usage(
    days: int = Query(30),
    current_user: str = Depends(get_current_user),
    bot_token: Optional[str] = Query(None),
    service: AnalyticsService = Depends(get_analytics_service)
):
    """Get daily usage data."""
    from datetime import datetime, timedelta
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    result = service.daily_usage(start_date, end_date, bot_token=bot_token)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/analytics/top-users")
async def top_users(
    limit: int = Query(10),
    current_user: str = Depends(get_current_user),
    service: AnalyticsService = Depends(get_analytics_service)
):
    """Get top users by token usage."""
    result = service.top_users(limit)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/analytics/top-models")
async def top_models(
    current_user: str = Depends(get_current_user),
    service: AnalyticsService = Depends(get_analytics_service)
):
    """Get top models by usage."""
    result = service.top_models()
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.get("/analytics/token-logs")
async def view_token_logs(
    page: int = Query(1),
    limit: int = Query(50),
    model: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
    service: AnalyticsService = Depends(get_analytics_service)
):
    """Get token usage logs."""
    filters = {}
    if model:
        filters["model"] = model
    result = service.view_token_logs(filters, None, limit)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data

@router.delete("/analytics/token-logs")
async def delete_token_logs(
    log_ids: List[str] = Query([]),
    current_user: str = Depends(get_current_user),
    service: AnalyticsService = Depends(get_analytics_service)
):
    """Delete token logs."""
    if not log_ids:
        return {"deleted_count": 0}
    from bson import ObjectId
    query = {"_id": {"$in": [ObjectId(lid) for lid in log_ids]}}
    result = service.delete_token_logs(query)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    return result.data


# =============================================================================
# Proxy Routes
# =============================================================================

@router.get("/proxy-file")
async def proxy_file(
    url: str = Query(...), 
    filename: str = "file",
    service: BotTokenService = Depends(get_token_service)
):
    """Proxy file download."""
    result = service.proxy_file(url, filename)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    
    from fastapi.responses import Response
    return Response(
        content=result.data["content"], 
        media_type=result.data["content_type"],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/proxy-icon")
async def proxy_icon(
    url: str = Query(...),
    service: BotTokenService = Depends(get_token_service)
):
    """Proxy icon retrieval."""
    result = service.proxy_icon(url)
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.error)
    
    from fastapi.responses import Response
    return Response(content=result.data["content"], media_type=result.data["content_type"])

