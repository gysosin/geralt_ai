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
        Classify user query into intents like CREATE_QUIZ, VIEW_QUIZ, DELETE_QUIZ, or OTHER.
        """
        prompt = f"""
You are an AI that classifies user intent for the query:
"{query}"

Possible Intents:
- CREATE_QUIZ
- VIEW_QUIZ
- DELETE_QUIZ
- OTHER

Output only one intent. Default to 'OTHER' if unclear.
"""
        try:
            intent_resp = await self.llm.complete(prompt, max_tokens=10, temperature=0.1)
            top_intent = intent_resp.strip().upper()
            allowed = ["CREATE_QUIZ", "VIEW_QUIZ", "DELETE_QUIZ", "OTHER"]
            
            # Simple fallback if LLM adds extra text
            for possible in allowed:
                if possible in top_intent:
                    return possible
            return "OTHER"
        except Exception:
            return "OTHER"
