"""
Bot Search Service

Handles RAG-based search queries using bot token context.
Extracted from bot_management_service.py for single responsibility.
"""
import os
import json
import re
from datetime import datetime
from uuid import uuid4
from collections import defaultdict
from typing import Any, Dict, List, Optional

from fuzzywuzzy import fuzz

from config import Config
from clients import redis_client, es_client
from models.database import (
    tokens_collection,
    conversation_collection,
    document_collection,
)
from helpers.utils import get_utility_service

from core.ai.factory import AIProviderFactory
from core.rag.retriever import HybridRetriever
from core.ai.intent import IntentAnalyzer
from core.ai.suggestions import SuggestionGenerator

from services.bots import BaseService, ServiceResult
from services.bots.quiz_service import get_quiz_service


class BotSearchService(BaseService):
    """
    Service for RAG-based search with bot context.
    
    Responsibilities:
    - Execute search queries against bot's document collections
    - Manage conversation context and history
    - Handle quiz creation from search context
    - Generate suggestions and UI actions
    """
    
    WORD_LIMIT = 1500
    MAX_HISTORY_MESSAGES = 6
    
    def __init__(self):
        super().__init__()
        self.tokens_db = tokens_collection
        self.conversations_db = conversation_collection
        self.documents_db = document_collection
        self.cache = redis_client
        self.quiz_service = get_quiz_service()
    
    async def search(
        self,
        bot_token: str,
        identity: Optional[str],
        query: str,
        conversation_id: Optional[str] = None,
        model_preference: Optional[str] = None,
        embedding_preference: str = "mistral"
    ) -> ServiceResult:
        """
        Execute a RAG search query.
        """
        try:
            # Validate bot token
            token_record = self.tokens_db.find_one({"bot_token": bot_token})
            if not token_record:
                return ServiceResult.fail("Invalid bot token", 403)
            
            allowed_collections = token_record.get("collection_ids", [])
            if not allowed_collections:
                return ServiceResult.fail("No collections associated with this bot.", 400)
            
            # Determine username
            username = self.extract_username(identity) if identity else "unauth_user"
            query_text = query.strip()
            
            if not query_text:
                return ServiceResult.fail("A non-empty 'query' is required.", 400)
            
            # Handle short queries
            conv_id = conversation_id or str(uuid4())
            if len(query_text) < 3:
                response = self._create_fallback_response(conv_id)
                self._save_conversation(bot_token, username, conv_id, query_text, response)
                return ServiceResult.ok(response)
            
            # Check user intent via IntentAnalyzer
            llm = AIProviderFactory.get_llm_provider()
            intent_analyzer = IntentAnalyzer(llm)
            user_intent = await intent_analyzer.determine_intent(query_text)

            if user_intent == "CREATE_QUIZ":
                result = await self._handle_quiz_intent(
                    query_text, username, bot_token, conv_id, allowed_collections
                )
                return ServiceResult.ok(result)
            
            # Normal Q&A path
            result = await self._execute_rag_search(
                query_text=query_text,
                username=username,
                bot_token=bot_token,
                token_record=token_record,
                conversation_id=conv_id,
                allowed_collections=allowed_collections,
                embedding_preference=embedding_preference
            )
            
            return ServiceResult.ok(result)
            
        except Exception as e:
            self.logger.error(f"Error in search: {e}")
            return ServiceResult.fail(f"An unexpected error occurred: {str(e)}", 500)
    
    async def _execute_rag_search(
        self,
        query_text: str,
        username: str,
        bot_token: str,
        token_record: Dict,
        conversation_id: str,
        allowed_collections: List[str],
        embedding_preference: str
    ) -> Dict:
        """Execute the main RAG search pipeline."""
        
        # Get conversation history
        full_history = self._get_conversation_history(bot_token, username, conversation_id)
        trimmed_history = full_history[-self.MAX_HISTORY_MESSAGES:]
        history_str = self._format_history(trimmed_history)
        
        # Retrieve relevant documents using HybridRetriever
        embedder = AIProviderFactory.get_embedding_provider()
        retriever = HybridRetriever(es_client, embedder)
        
        retrieval_results = await retriever.retrieve(query_text, collection_ids=allowed_collections, top_k=15)
        
        # Convert RetrievalResult to dict chunks for compatibility
        top_chunks = []
        for r in retrieval_results:
            top_chunks.append({
                "content": r.content,
                "metadata": r.metadata,
                "document_id": r.document_id,
            })
        
        # Build document metadata
        doc_ids = list(set(c["document_id"] for c in top_chunks))
        doc_meta_dict = self._build_doc_metadata(doc_ids)
        aggregated_doc_metadata = self._aggregate_chunk_metadata(top_chunks, doc_meta_dict)
        
        # Build context and prompt
        doc_context = self._truncate_words(
            "\n\n".join([c["content"] for c in top_chunks])
        )
        bot_prompt = token_record.get("prompt", "").strip() or (
            "You are a helpful assistant that provides answers. "
            "As per my knowledge, answer the user's query accurately."
        )
        
        final_prompt = self._build_final_prompt(
            bot_prompt, doc_context, history_str, query_text
        )
        
        # Get LLM response
        llm = AIProviderFactory.get_llm_provider()
        lc_response = await llm.complete(final_prompt, max_tokens=800, temperature=0.2)
        
        # Generate suggestions and UI actions
        minimal_chunks = [{"content": c["content"], "metadata": {}} for c in top_chunks]
        
        suggestion_gen = SuggestionGenerator(llm)
        suggestions = await suggestion_gen.generate_small_questions(
            minimal_chunks, list(range(len(minimal_chunks)))
        )
        
        buttons = await self._determine_ui_actions(lc_response, bot_token, username, llm)
        
        # Build top sources
        top_sources = [
            f"{info['other_metadata'].get('file_name', '')} ({info['other_metadata'].get('url', '')})"
            for info in doc_meta_dict.values()
        ]
        
        final_data = {
            "response": lc_response,
            "conversation_id": conversation_id,
            "metadata": aggregated_doc_metadata,
            "suggestions": suggestions,
            "buttons": buttons,
            "top_documents": list(doc_meta_dict.values()),
            "top_sources": top_sources,
            "is_typing_enabled": False,
            "top_chunks": top_chunks,
        }
        
        self._save_conversation(bot_token, username, conversation_id, query_text, final_data)
        return final_data
    
    async def _handle_quiz_intent(
        self,
        query_text: str,
        username: str,
        bot_token: str,
        conversation_id: str,
        allowed_collections: List[str]
    ) -> Dict:
        """Handle quiz creation intent."""
        
        quiz_result = await self.quiz_service.create_quiz_from_query(
            query_text, username, bot_token, allowed_collections
        )
        
        if not quiz_result.success:
            final_data = self._create_error_response(conversation_id, quiz_result.error or "Quiz creation failed")
        else:
            quiz_data = quiz_result.data
            quiz_data["inProgress"] = False
            quiz_data["isSubmitted"] = False
            quiz_data["isStarted"] = False
            quiz_data["submission_data"] = {}
            
            # Ensure each question has selected_option
            for q in quiz_data.get("questions", []):
                if "selected_option" not in q:
                    q["selected_option"] = ""
            
            final_data = {
                "response": quiz_data.get("message", "Quiz created successfully"),
                "conversation_id": conversation_id,
                "metadata": {},
                "suggestions": [],
                "buttons": [],
                "top_documents": [],
                "top_sources": [],
                "quiz": quiz_data,
                "is_typing_enabled": False,
            }
        
        self._save_conversation(bot_token, username, conversation_id, query_text, final_data)
        return final_data
    
    async def _determine_ui_actions(
        self,
        assistant_response: str,
        bot_token: str,
        user_id: str,
        llm_provider
    ) -> List[Dict]:
        """
        Match assistant response to UI actions using fuzzy matching + LLM.
        """
        try:
            bot_data = self.tokens_db.find_one({"bot_token": bot_token})
            if not bot_data or "ui_actions" not in bot_data:
                return []

            ui_actions = bot_data["ui_actions"]
            if not ui_actions:
                return []

            ass_response_norm = assistant_response.lower().strip()
            
            # Rule-based (Fuzzy)
            rules_actions = []
            for action in ui_actions:
                phrases = [
                    ph.strip().lower()
                    for ph in action.get("trigger_phrases", "").split(",")
                ]
                for phrase in phrases:
                    if phrase in ass_response_norm:
                        rules_actions.append(action["action_id"])
                        break
                    elif fuzz.partial_ratio(phrase, ass_response_norm) >= 80:
                        rules_actions.append(action["action_id"])
                        break

            # LLM-based
            available_actions_json = json.dumps(
                [
                    {
                        "action_id": a["action_id"],
                        "trigger_phrases": a["trigger_phrases"],
                    }
                    for a in ui_actions
                ],
                indent=2,
            )

            prompt = f"""
Determine relevant action IDs from the assistant's final response.

Assistant Response:
{assistant_response}

Available Actions (JSON):
{available_actions_json}

Instructions:
- Check if any action's 'trigger_phrases' appear in the assistant's response.
- Output relevant action_ids in uppercase, separated by commas.
- If no action, output 'NO_ACTION'.
"""
            action_resp = await llm_provider.complete(prompt)
            action_resp = action_resp.strip().upper()
            
            llm_actions = []
            if action_resp != "NO_ACTION":
                raw_ids = re.split(r"[,\n;]+", action_resp)
                valid_ids_upper = [a["action_id"].upper() for a in ui_actions]
                llm_actions = [
                    rid.strip() 
                    for rid in raw_ids 
                    if rid.strip() in valid_ids_upper
                ]

            combined = set(a.upper() for a in llm_actions) | set(r.upper() for r in rules_actions)
            
            action_map = {a["action_id"].upper(): a for a in ui_actions}
            final_suggestions = [action_map[c] for c in combined if c in action_map]
            return final_suggestions

        except Exception:
            return []

    def _build_doc_metadata(self, doc_ids: List[str]) -> Dict:
        """Build document-level metadata map."""
        doc_meta_dict = {}
        
        docs = list(self.documents_db.find({"_id": {"$in": doc_ids}}))
        found_ids = set()
        
        for parent_doc in docs:
            doc_id = str(parent_doc["_id"])
            found_ids.add(doc_id)
            
            fname = parent_doc.get("file_name", "")
            ext = fname.split(".")[-1].lower() if "." in fname else ""
            rtype = get_utility_service().get_resource_type(ext)
            doc_url = get_utility_service().generate_preview_url(parent_doc.get("file_path", ""), fname)
            
            doc_meta_dict[doc_id] = {
                "document_id": doc_id,
                "collection_id": str(parent_doc.get("collection_id", "")),
                "file_type": rtype,
                "other_metadata": {
                    "file_name": fname,
                    "url": doc_url,
                    "original_url": parent_doc.get("url", ""),
                },
            }
        
        # Fill missing ones
        for did in doc_ids:
            if did not in found_ids:
                doc_meta_dict[did] = {
                    "document_id": did,
                    "file_type": "unknown",
                    "other_metadata": {},
                }
        
        return doc_meta_dict
    
    def _aggregate_chunk_metadata(
        self,
        chunks: List[Dict],
        doc_meta_dict: Dict
    ) -> Dict:
        """Aggregate metadata from chunks by document."""
        chunks_by_doc = defaultdict(list)
        for c in chunks:
            chunks_by_doc[c["document_id"]].append(c)
        
        aggregated = {}
        for doc_id, chunk_list in chunks_by_doc.items():
            if doc_id not in doc_meta_dict:
                continue
            
            start_times = []
            end_times = []
            page_nums = set()
            paragraph_idxs = set()
            
            for ch in chunk_list:
                m = ch.get("metadata", {})
                if "start_time" in m:
                    try:
                        start_times.append(float(m["start_time"]))
                    except:
                        pass
                if "end_time" in m:
                    try:
                        end_times.append(float(m["end_time"]))
                    except:
                        pass
                if "page_number" in m:
                    page_nums.add(m["page_number"])
                if "paragraph_index" in m:
                    paragraph_idxs.add(m["paragraph_index"])
            
            agg_info = {}
            if start_times and end_times:
                agg_info["start_time"] = min(start_times)
                agg_info["end_time"] = max(end_times)
            if page_nums:
                agg_info["page_numbers"] = sorted(list(page_nums))
            if paragraph_idxs:
                agg_info["paragraph_indices"] = sorted(list(paragraph_idxs))
            
            aggregated[doc_id] = agg_info
        
        return aggregated
    
    def _build_final_prompt(
        self,
        bot_prompt: str,
        doc_context: str,
        history_str: str,
        query_text: str
    ) -> str:
        """Build the final prompt for LLM."""
        context_block = (
            f"{bot_prompt}\n\n### Context:\n{doc_context}\n"
            if doc_context.strip()
            else f"{bot_prompt}\n\n(No context)\n"
        )
        
        return f"""{context_block}

You are an AI assistant with a deep understanding of contextual conversations and document references. Given the conversation history and relevant document excerpts, your task is to generate accurate, contextual, and helpful responses.

Guidelines:
- Context Awareness – Always consider the full conversation and relevant document references before generating a response.
- Precision – Your answers should be concise yet detailed, directly addressing the user's query.
- Relevance – If no relevant information exists in the provided documents, clearly state: "No relevant info."
- Clarity & Coherence – Ensure responses are easy to understand and logically structured.

Conversation:
{history_str}

User Query: {query_text}
Answer as best you can with the context above.
"""
    
    def _format_history(self, messages: List[Dict]) -> str:
        """Format conversation history for prompt."""
        history_str = ""
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            
            if role == "user":
                history_str += f"User: {content}\n"
            elif role == "assistant":
                if isinstance(content, dict) and "response" in content:
                    history_str += f"Assistant: {content['response']}\n"
                else:
                    history_str += f"Assistant: {content}\n"
        
        return history_str
    
    def _truncate_words(self, text: str) -> str:
        """Truncate text to word limit."""
        words = text.split()
        return " ".join(words[:self.WORD_LIMIT])
    
    def _create_fallback_response(self, conversation_id: str) -> Dict:
        """Create a fallback response for short queries."""
        return {
            "response": "Hello! How can I help you today?",
            "conversation_id": conversation_id,
            "metadata": {},
            "suggestions": [],
            "buttons": [],
            "top_documents": [],
            "top_sources": [],
            "is_typing_enabled": False,
        }
    
    def _create_error_response(self, conversation_id: str, error: str) -> Dict:
        """Create an error response."""
        return {
            "response": error,
            "conversation_id": conversation_id,
            "metadata": {},
            "suggestions": [],
            "buttons": [],
            "top_documents": [],
            "top_sources": [],
            "is_typing_enabled": False,
        }
    
    def _save_conversation(
        self,
        bot_token: str,
        username: str,
        conversation_id: str,
        user_query: str,
        assistant_data: Dict
    ) -> None:
        """Save conversation to MongoDB or Redis."""
        now = datetime.utcnow().isoformat()
        msgs = [
            {"role": "user", "content": user_query, "timestamp": now},
            {"role": "assistant", "content": assistant_data, "timestamp": now},
        ]
        
        if username != "unauth_user":
            self.conversations_db.update_one(
                {"_id": conversation_id, "username": username, "bot_token": bot_token},
                {
                    "$push": {"messages": {"$each": msgs}},
                    "$setOnInsert": {"created_at": datetime.utcnow()},
                },
                upsert=True,
            )
        else:
            existing_data = self.cache.get(conversation_id)
            conv_obj = {"messages": []}
            if existing_data:
                conv_obj = json.loads(existing_data)
            conv_obj["messages"] += msgs
            conv_obj["bot_token"] = bot_token
            self.cache.setex(conversation_id, 3600, json.dumps(conv_obj, default=str))
    
    def _get_conversation_history(
        self,
        bot_token: str,
        username: str,
        conversation_id: str
    ) -> List[Dict]:
        """Retrieve conversation history."""
        if username != "unauth_user":
            conv = self.conversations_db.find_one({
                "_id": conversation_id,
                "username": username,
                "bot_token": bot_token
            })
            return conv.get("messages", []) if conv else []
        else:
            existing_data = self.cache.get(conversation_id)
            if existing_data:
                conv_obj = json.loads(existing_data)
                return conv_obj.get("messages", [])
            return []


# Singleton instance
_search_service_instance: Optional[BotSearchService] = None


def get_search_service() -> BotSearchService:
    """Get or create the bot search service singleton."""
    global _search_service_instance
    if _search_service_instance is None:
        _search_service_instance = BotSearchService()
    return _search_service_instance