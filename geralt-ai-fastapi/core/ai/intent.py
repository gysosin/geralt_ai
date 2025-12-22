from typing import List, Optional
from core.ai.base import LLMProvider

class IntentAnalyzer:
    """
    Analyzes user intent using an LLM.
    """
    def __init__(self, llm_provider: LLMProvider):
        self.llm = llm_provider

    async def determine_intent(self, query: str) -> str:
        """
        Classify user query into intents like GREETING, GENERAL_CHAT, RAG_QUERY, CREATE_QUIZ, VIEW_QUIZ, DELETE_QUIZ, or OTHER.
        """
        prompt = f"""
You are an AI that classifies user intent for the query:
"{query}"

Possible Intents:
- GREETING: Hello, Hi, Hey, Good morning, etc.
- GENERAL_CHAT: How are you, Tell me a joke, General questions not requiring external documents.
- RAG_QUERY: Questions asking for specific information, data, summaries, or facts likely to be found in documents (e.g., "What is the revenue?", "Summarize the PDF", "Who is the CEO?").
- CREATE_QUIZ: Requests to create a quiz.
- VIEW_QUIZ: Requests to view quizzes.
- DELETE_QUIZ: Requests to delete a quiz.
- OTHER: Anything else.

Output only one intent. Default to 'RAG_QUERY' if it seems like a question about content, otherwise 'GENERAL_CHAT'.
"""
        try:
            intent_resp = await self.llm.complete(prompt, max_tokens=10, temperature=0.1)
            top_intent = intent_resp.strip().upper()
            allowed = [
                "GREETING", "GENERAL_CHAT", "RAG_QUERY", 
                "CREATE_QUIZ", "VIEW_QUIZ", "DELETE_QUIZ", "OTHER"
            ]
            
            # Simple fallback if LLM adds extra text
            for possible in allowed:
                if possible in top_intent:
                    return possible
            
            # Default to RAG_QUERY for safety if unclear but looks like a query
            if "?" in query or len(query.split()) > 3:
                return "RAG_QUERY"
                
            return "GENERAL_CHAT"
        except Exception:
            return "RAG_QUERY"
