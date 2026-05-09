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
- RAG_QUERY: Questions asking for specific information, data, summaries, facts, tables, lists, or calculations likely to be found in documents (e.g., "What is the revenue?", "Summarize the PDF", "Who is the CEO?", "Show me a table of vendors", "List all payments").
- CREATE_QUIZ: Requests to create a quiz.
- VIEW_QUIZ: Requests to view quizzes.
- DELETE_QUIZ: Requests to delete a quiz.
- OTHER: Anything else.

Rules:
1. If the query asks for ANY data, facts, names, amounts, or summaries that could be in a document, it MUST be 'RAG_QUERY'.
2. If the user asks for a table, list, or aggregation, it is 'RAG_QUERY'.
3. Default to 'RAG_QUERY' if unsure.

Output only one word (the Intent).
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
