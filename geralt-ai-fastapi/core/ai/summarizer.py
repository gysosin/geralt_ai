from typing import List, Dict
from core.ai.base import LLMProvider

class ConversationSummarizer:
    """
    Maintains a running summary of a conversation to enable long-term context.
    """
    def __init__(self, llm_provider: LLMProvider):
        self.llm = llm_provider

    async def update_summary(self, current_summary: str, new_messages: List[Dict]) -> str:
        """
        Update the existing summary with new messages.
        """
        if not new_messages:
            return current_summary

        # Format new messages for the prompt
        new_msgs_str = ""
        for msg in new_messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if isinstance(content, dict):
                content = content.get("response", str(content))
            new_msgs_str += f"{role}: {content}\n"

        if not current_summary:
            prompt = f"""
Summarize the following conversation concisely, capturing key topics, decisions, and user preferences.

Conversation:
{new_msgs_str}

Summary:"""
        else:
            prompt = f"""
Update the conversation summary with the new lines of dialogue. Keep the summary concise but retain important details like names, goals, and context.

Current Summary:
{current_summary}

New Lines:
{new_msgs_str}

Updated Summary:"""

        try:
            summary = await self.llm.complete(prompt, max_tokens=200, temperature=0.3)
            return summary.strip()
        except Exception:
            return current_summary
