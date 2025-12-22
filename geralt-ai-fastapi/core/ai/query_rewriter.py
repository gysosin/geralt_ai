from core.ai.base import LLMProvider

class QueryRewriter:
    """
    Rewrites user queries to be self-contained based on conversation history.
    """
    def __init__(self, llm_provider: LLMProvider):
        self.llm = llm_provider

    async def rewrite(self, query: str, history_str: str) -> str:
        """
        Rewrite query to be standalone.
        """
        if not history_str:
            return query
            
        prompt = f"""
Given a conversation history and a follow-up query, rewrite the follow-up query to be a standalone question that captures the full context. 
If the query is already standalone, return it exactly as is.
Do NOT answer the question. Just rewrite it.

Conversation History:
{history_str}

Follow-up Query: {query}

Standalone Query:"""

        try:
            rewritten = await self.llm.complete(prompt, max_tokens=100, temperature=0.1)
            clean_query = rewritten.strip().replace("Standalone Query:", "").strip()
            return clean_query
        except Exception:
            return query
