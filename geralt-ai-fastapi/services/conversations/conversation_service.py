"""
Conversation Service

Handles conversation CRUD and search operations.
"""
import json
import logging
from datetime import datetime
from uuid import uuid4
from collections import defaultdict
from typing import Dict, List, Optional, Any

from bson.objectid import ObjectId

from clients import redis_client, es_client, minio_client
from helpers.cache_invalidation import invalidate_cache_for_conversations_by_user
from helpers.utils import get_utility_service
from models.database import conversation_collection, tokens_collection, token_logs_collection
from services.bots import BaseService, ServiceResult

from core.ai.factory import AIProviderFactory
from core.rag.retriever import HybridRetriever
from core.ai.intent import IntentAnalyzer
from core.ai.suggestions import SuggestionGenerator


class ConversationService(BaseService):
    """
    Service for managing conversations.
    
    Responsibilities:
    - CRUD operations on conversations
    - Search within conversations
    - Conversation history management
    """
    
    WORD_LIMIT = 1500
    MAX_HISTORY_MESSAGES = 6
    
    def __init__(self):
        super().__init__()
        self.db = conversation_collection
        self.tokens_db = tokens_collection
        self.cache = redis_client
    
    # =========================================================================
    # Search Operations
    # =========================================================================

    async def search(
        self,
        identity: str,
        query: str,
        collection_id: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> ServiceResult:
        """
        Execute a RAG search query on a collection (without bot context).
        """
        try:
            username = self.extract_username(identity)
            query_text = query.strip()
            
            if not query_text:
                return ServiceResult.fail("Query is required", 400)
            
            conv_id = conversation_id or str(uuid4())
            
            # Use provided collection or try to infer from conversation
            allowed_collections = []
            if collection_id:
                allowed_collections = [collection_id]
            elif conversation_id:
                conv = self.db.find_one({"_id": conversation_id, "username": username})
                if conv:
                    allowed_collections = conv.get("collection_ids", [])
            
            # If no collection context, get user's collections (owned + shared)
            if not allowed_collections:
                from models.database import collection_collection
                # Query owned collections
                owned = collection_collection.find({"created_by": username})
                allowed_collections = [str(c["collection_id"]) for c in owned]
                
                # Also include shared collections
                shared = collection_collection.find({"shared_with.username": username})
                allowed_collections.extend([str(c["collection_id"]) for c in shared])
                
                # Remove duplicates
                allowed_collections = list(set(allowed_collections))
            
            # Get conversation history
            full_history = self._get_conversation_history(username, conv_id)
            trimmed_history = full_history[-self.MAX_HISTORY_MESSAGES:]
            history_str = self._format_history(trimmed_history)
            
            # If no collections, chat directly with AI (no RAG)
            if not allowed_collections:
                llm = AIProviderFactory.get_llm_provider()
                
                direct_prompt = f"""You are a helpful AI assistant. Answer the user's question to the best of your ability.

Conversation History:
{history_str}

User: {query_text}
Assistant:"""
                
                response_text = await llm.complete(direct_prompt)
                
                # Log token usage for analytics
                self._log_token_usage(
                    username=username,
                    model=llm.model_name,
                    prompt_text=direct_prompt,
                    response_text=response_text,
                    operation="direct_chat"
                )
                
                final_data = {
                    "response": response_text,
                    "conversation_id": conv_id,
                    "metadata": {},
                    "suggestions": [],
                    "top_documents": [],
                    "collection_id": None,
                    "mode": "direct_chat"  # Indicate this is direct AI chat without RAG
                }
                
                # Save conversation
                self._save_conversation(username, conv_id, query_text, final_data, [])
                
                return ServiceResult.ok(final_data)
            
            # RAG mode: Retrieve from collections
            embedder = AIProviderFactory.get_embedding_provider()
            retriever = HybridRetriever(es_client, embedder)
            
            retrieval_results = await retriever.retrieve(
                query_text, 
                collection_ids=allowed_collections, 
                top_k=10
            )
            
            # Chunk processing - include more detail for UI display
            top_chunks = []
            for r in retrieval_results:
                top_chunks.append({
                    "content": r.content,
                    "metadata": r.metadata,
                    "document_id": r.document_id,
                    "score": getattr(r, 'score', 0),
                })
            
            doc_ids = list(set(c["document_id"] for c in top_chunks))
            doc_meta_dict = self._build_doc_metadata(doc_ids)
            aggregated_doc_metadata = self._aggregate_chunk_metadata(top_chunks, doc_meta_dict)
            
            # Build enhanced top_documents with chunk details
            enhanced_top_docs = []
            for doc_id, doc_meta in doc_meta_dict.items():
                # Get chunks for this document
                doc_chunks = [c for c in top_chunks if c["document_id"] == doc_id]
                
                # Extract page numbers from chunks
                page_numbers = set()
                chunk_snippets = []
                best_score = 0
                
                for chunk in doc_chunks[:3]:  # Limit to top 3 chunks per doc
                    meta = chunk.get("metadata", {})
                    if "page_number" in meta:
                        page_numbers.add(meta["page_number"])
                    # Get snippet (first 200 chars of content)
                    content = chunk.get("content", "")
                    if content:
                        chunk_snippets.append(content[:200] + "..." if len(content) > 200 else content)
                    if chunk.get("score", 0) > best_score:
                        best_score = chunk.get("score", 0)
                
                enhanced_doc = {
                    **doc_meta,
                    "page_numbers": sorted(list(page_numbers)) if page_numbers else None,
                    "chunk_snippets": chunk_snippets,
                    "score": best_score,
                    "chunk_count": len(doc_chunks),
                }
                enhanced_top_docs.append(enhanced_doc)
            
            # Sort by score descending
            enhanced_top_docs.sort(key=lambda x: x.get("score", 0), reverse=True)
            
            # Prompt
            doc_context = self._truncate_words(
                "\n\n".join([c["content"] for c in top_chunks])
            )
            
            final_prompt = f"""
Use the following context to answer the user's question. If the answer is not in the context, say so.

Context:
{doc_context}

Conversation History:
{history_str}

User: {query_text}
Assistant:"""

            # LLM
            llm = AIProviderFactory.get_llm_provider()
            response_text = await llm.complete(final_prompt)
            
            # Log token usage for analytics
            self._log_token_usage(
                username=username,
                model=llm.model_name,
                prompt_text=final_prompt,
                response_text=response_text,
                operation="rag_chat"
            )
            
            # Suggestions - pass query, response, and conversation history
            minimal_chunks = [{"content": c["content"], "metadata": {}} for c in top_chunks]
            suggestion_gen = SuggestionGenerator(llm)
            suggestions = await suggestion_gen.generate_small_questions(
                minimal_chunks, 
                list(range(len(minimal_chunks))),
                user_query=query_text,
                ai_response=response_text,
                conversation_history=full_history
            )
            
            # Build Response with enhanced sources
            final_data = {
                "response": response_text,
                "conversation_id": conv_id,
                "metadata": aggregated_doc_metadata,
                "suggestions": suggestions,
                "top_documents": enhanced_top_docs,  # Now includes page_numbers, chunks, scores
                "collection_id": allowed_collections[0] if allowed_collections else None,
                "mode": "rag"  # Indicate this is RAG mode
            }
            
            # Save
            self._save_conversation(username, conv_id, query_text, final_data, allowed_collections)
            
            return ServiceResult.ok(final_data)
            
        except Exception as e:
            self.logger.error(f"Error in conversation search: {e}")
            return ServiceResult.fail(str(e), 500)

    # =========================================================================
    # Private Helpers for Search
    # =========================================================================
    
    def _get_conversation_history(self, username: str, conversation_id: str) -> List[Dict]:
        conv = self.db.find_one({"_id": conversation_id, "username": username})
        return conv.get("messages", []) if conv else []

    def _format_history(self, messages: List[Dict]) -> str:
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
        words = text.split()
        return " ".join(words[:self.WORD_LIMIT])

    def _save_conversation(
        self, 
        username: str, 
        conversation_id: str, 
        query: str, 
        response: Dict, 
        collection_ids: List[str]
    ):
        now = datetime.utcnow().isoformat()
        msgs = [
            {"role": "user", "content": query, "timestamp": now},
            {"role": "assistant", "content": response, "timestamp": now},
        ]
        
        update_data = {
            "$push": {"messages": {"$each": msgs}},
            "$setOnInsert": {"created_at": datetime.utcnow(), "name": query[:50]},
        }
        if collection_ids:
            update_data["$addToSet"] = {"collection_ids": {"$each": collection_ids}}
            
        self.db.update_one(
            {"_id": conversation_id, "username": username},
            update_data,
            upsert=True
        )

    def _build_doc_metadata(self, doc_ids: List[str]) -> Dict:
        # Avoid circular import if possible, or use db directly
        from models.database import document_collection
        doc_meta_dict = {}
        docs = list(document_collection.find({"_id": {"$in": doc_ids}}))
        
        for parent_doc in docs:
            doc_id = str(parent_doc["_id"])
            fname = parent_doc.get("file_name", "")
            ext = fname.split(".")[-1].lower() if "." in fname else ""
            rtype = get_utility_service().get_resource_type(ext)
            # Use utility for URL
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
        return doc_meta_dict

    def _aggregate_chunk_metadata(self, chunks: List[Dict], doc_meta_dict: Dict) -> Dict:
        chunks_by_doc = defaultdict(list)
        for c in chunks:
            chunks_by_doc[c["document_id"]].append(c)
        
        aggregated = {}
        for doc_id, chunk_list in chunks_by_doc.items():
            if doc_id not in doc_meta_dict:
                continue
            
            page_nums = set()
            for ch in chunk_list:
                m = ch.get("metadata", {})
                if "page_number" in m:
                    page_nums.add(m["page_number"])
            
            agg_info = {}
            if page_nums:
                agg_info["page_numbers"] = sorted(list(page_nums))
            aggregated[doc_id] = agg_info
        
        return aggregated

    # =========================================================================
    # CRUD Operations
    # =========================================================================
    
    def get(
        self,
        identity: str,
        conversation_id: str,
        collection_id_filter: Optional[str] = None
    ) -> ServiceResult:
        """
        Get a specific conversation.
        
        Args:
            identity: User's identity
            conversation_id: Conversation to retrieve
            collection_id_filter: Optional filter by collection
            
        Returns:
            ServiceResult with conversation data
        """
        try:
            username = self.extract_username(identity)
            
            query = {"_id": conversation_id, "username": username}
            if collection_id_filter:
                query["collection_ids"] = collection_id_filter
            
            conv = self.db.find_one(query)
            if not conv:
                return ServiceResult.fail("Conversation not found or access denied", 404)
            
            return ServiceResult.ok(self._serialize_document(conv))
            
        except Exception as e:
            self.logger.error(f"Error getting conversation: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def list(self, identity: str) -> ServiceResult:
        """
        List all conversations for a user.
        
        Args:
            identity: User's identity
            
        Returns:
            ServiceResult with list of conversations
        """
        try:
            username = self.extract_username(identity)
            
            convs = self.db.find({"username": username})
            result = []
            
            for conv in convs:
                messages = conv.get("messages", [])
                first_user_msg = next(
                    (m.get("content") for m in messages if m.get("role") == "user"),
                    ""
                )
                
                result.append({
                    "conversation_id": conv["_id"],
                    "first_message": first_user_msg[:100] if first_user_msg else "",
                    "created_at": conv.get("created_at"),
                    "bot_token": conv.get("bot_token"),
                })
            
            return ServiceResult.ok(result)
            
        except Exception as e:
            self.logger.error(f"Error listing conversations: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def list_by_collection(self, identity: str, collection_id: str) -> ServiceResult:
        """List conversations for a specific collection."""
        try:
            username = self.extract_username(identity)
            
            convs = self.db.find({
                "username": username,
                "collection_ids": collection_id
            })
            
            result = [{"conversation_id": conv["_id"]} for conv in convs]
            return ServiceResult.ok(result)
            
        except Exception as e:
            self.logger.error(f"Error listing conversations by collection: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def delete(self, identity: str, conversation_id: str) -> ServiceResult:
        """Delete a conversation."""
        try:
            username = self.extract_username(identity)
            
            result = self.db.delete_one({
                "_id": conversation_id,
                "username": username
            })
            
            if result.deleted_count == 0:
                return ServiceResult.fail("Conversation not found or access denied", 404)
            
            invalidate_cache_for_conversations_by_user(username)
            self.log_operation("delete_conversation", username=username, conversation_id=conversation_id)
            
            return ServiceResult.ok({"message": "Conversation deleted successfully"})
            
        except Exception as e:
            self.logger.error(f"Error deleting conversation: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def rename(self, identity: str, conversation_id: str, new_name: str) -> ServiceResult:
        """Rename a conversation."""
        try:
            username = self.extract_username(identity)
            
            result = self.db.update_one(
                {"_id": conversation_id, "username": username},
                {"$set": {"name": new_name}}
            )
            
            if result.modified_count == 0:
                return ServiceResult.fail("Conversation not found or access denied", 404)
            
            return ServiceResult.ok({"message": "Conversation renamed successfully"})
            
        except Exception as e:
            self.logger.error(f"Error renaming conversation: {e}")
            return ServiceResult.fail(str(e), 500)
    
    def get_all_for_bot(self, identity: str, bot_token: str) -> ServiceResult:
        """Get all conversations for a specific bot."""
        try:
            username = self.extract_username(identity)
            
            convs = self.db.find({
                "username": username,
                "bot_token": bot_token
            })
            
            result = []
            for conv in convs:
                result.append({
                    "conversation_id": conv["_id"],
                    "name": conv.get("name"),
                    "created_at": conv.get("created_at"),
                    "messages_count": len(conv.get("messages", [])),
                })
            
            return ServiceResult.ok(result)
            
        except Exception as e:
            self.logger.error(f"Error getting bot conversations: {e}")
            return ServiceResult.fail(str(e), 500)
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    def _serialize_document(self, doc: Dict) -> Dict:
        """Recursively serialize MongoDB document for JSON."""
        if isinstance(doc, dict):
            return {k: self._serialize_document(v) for k, v in doc.items()}
        elif isinstance(doc, list):
            return [self._serialize_document(item) for item in doc]
        elif isinstance(doc, ObjectId):
            return str(doc)
        elif isinstance(doc, datetime):
            return doc.isoformat()
        else:
            return doc
    
    @staticmethod
    def is_valid_object_id(oid: str) -> bool:
        """Check if string is valid MongoDB ObjectId."""
        try:
            ObjectId(oid)
            return True
        except Exception:
            return False
    
    def _log_token_usage(
        self,
        username: str,
        model: str,
        prompt_text: str,
        response_text: str,
        operation: str = "chat"
    ):
        """Log token usage for analytics."""
        try:
            # Estimate tokens (rough estimate: ~4 chars per token)
            prompt_tokens = len(prompt_text) // 4
            completion_tokens = len(response_text) // 4
            total_tokens = prompt_tokens + completion_tokens
            
            token_logs_collection.insert_one({
                "user_id": username,
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "operation": operation,
                "timestamp": datetime.utcnow(),
            })
        except Exception as e:
            self.logger.warning(f"Failed to log token usage: {e}")


# Singleton instance
_conversation_service_instance: Optional[ConversationService] = None


def get_conversation_service() -> ConversationService:
    """Get or create the conversation service singleton."""
    global _conversation_service_instance
    if _conversation_service_instance is None:
        _conversation_service_instance = ConversationService()
    return _conversation_service_instance
