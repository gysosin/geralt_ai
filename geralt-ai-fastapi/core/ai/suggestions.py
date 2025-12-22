from typing import List, Dict, Optional
from core.ai.base import LLMProvider

class SuggestionGenerator:
    """
    Generates follow-up questions or suggestions based on context and conversation history.
    """
    def __init__(self, llm_provider: LLMProvider):
        self.llm = llm_provider

    async def generate_small_questions(
        self, 
        context_chunks: List[Dict], 
        used_indices: List[int],
        user_query: Optional[str] = None,
        ai_response: Optional[str] = None,
        conversation_history: Optional[List[Dict]] = None
    ) -> List[str]:
        """
        Generates follow-up questions based on the conversation context.
        
        Args:
            context_chunks: List of document chunks
            used_indices: Indices of chunks used for the response
            user_query: The user's original question
            ai_response: The AI's response to use for context
            conversation_history: Previous messages in the conversation to avoid repetition
        """
        if not context_chunks:
            return []
            
        # Use the chunks that were actually used for the response
        used_chunks = [c for i, c in enumerate(context_chunks) if i in used_indices]
        if not used_chunks:
            used_chunks = context_chunks[:3]
            
        context_text = "\n".join(ch["content"][:300] for ch in used_chunks[:3])
        
        # Build conversation history summary to avoid repetition
        history_summary = ""
        if conversation_history:
            asked_questions = []
            for msg in conversation_history:
                if msg.get("role") == "user":
                    content = msg.get("content", "")
                    if isinstance(content, str) and len(content) < 100:
                        asked_questions.append(content)
            if asked_questions:
                history_summary = f"\n\nQuestions already asked (DO NOT suggest these topics again):\n- " + "\n- ".join(asked_questions[-5:])
        
        # Build a prompt that considers the user's question and the response
        query_context = f"\nCurrent question: {user_query}" if user_query else ""
        response_context = f"\nCurrent answer: {ai_response[:200]}..." if ai_response else ""

        prompt = f"""Generate 1-2 short follow-up questions (under 10 words each) that a user might ask next.

Document Context:
{context_text[:500]}
{query_context}
{response_context}
{history_summary}

CRITICAL Rules:
- Do NOT suggest questions about topics already asked or answered
- Questions should explore NEW aspects of the document
- Questions should be directly related to the document content
- Keep questions specific and actionable
- If nothing new to ask, respond with "NONE"

Output format: Just the questions, one per line, no numbering or bullets."""

        try:
            response_text = await self.llm.complete(prompt, max_tokens=100, temperature=0.7)
            suggestions = []
            
            # Extract questions already asked to filter them out
            asked_topics = set()
            if conversation_history:
                for msg in conversation_history:
                    if msg.get("role") == "user":
                        content = msg.get("content", "")
                        if isinstance(content, str):
                            # Extract key words from asked questions
                            words = content.lower().split()
                            asked_topics.update(words)
            
            for line in response_text.strip().split('\n'):
                line = line.strip()
                if not line or line.upper() == "NONE":
                    continue
                # Clean up the line
                line = line.lstrip('0123456789.-) ')
                if line:
                    if not line.endswith('?'):
                        line += '?'
                    
                    # Skip if this question is too similar to what was already asked
                    line_words = set(line.lower().split())
                    overlap = len(line_words.intersection(asked_topics))
                    # If more than 60% of words overlap with asked topics, skip
                    if len(line_words) > 0 and overlap / len(line_words) > 0.6:
                        continue
                        
                    suggestions.append(line)
            
            return suggestions[:2]  # Return max 2 suggestions
            
        except Exception:
            return []
