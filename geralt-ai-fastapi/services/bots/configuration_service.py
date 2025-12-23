"""
Configuration Service

Handles application configuration and model availability.
"""
from typing import List, Dict, Any
from core.config import settings
from services.bots import BaseService, ServiceResult

class ConfigurationService(BaseService):
    """
    Service for retrieving application configuration.
    """
    
    def get_available_models(self) -> ServiceResult:
        """
        Get list of available AI models based on configured API keys.
        """
        try:
            models = []
            
            # Gemini Models
            if settings.GEMINI_API_KEY:
                models.extend([
                    {"id": "gemini-2.5-flash-lite", "name": "Gemini 2.5 Flash Lite", "provider": "Google"},
                    {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "provider": "Google"},
                    {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "provider": "Google"},
                ])
                
            # OpenAI Models
            if settings.OPENAI_API_KEY:
                models.extend([
                    {"id": "gpt-4o", "name": "GPT-4o", "provider": "OpenAI"},
                    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "provider": "OpenAI"},
                    {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "provider": "OpenAI"},
                    {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "provider": "OpenAI"},
                ])
                
            # Mistral Models
            if settings.MISTRAL_API_KEY:
                models.extend([
                    {"id": "mistral-large-latest", "name": "Mistral Large", "provider": "Mistral"},
                    {"id": "mistral-medium-latest", "name": "Mistral Medium", "provider": "Mistral"},
                    {"id": "mistral-small-latest", "name": "Mistral Small", "provider": "Mistral"},
                ])
                
            return ServiceResult.ok({
                "models": models,
                "default_model": settings.DEFAULT_AI_MODEL
            })
            
        except Exception as e:
            self.logger.error(f"Error getting available models: {e}")
            return ServiceResult.fail(str(e), 500)

# Singleton instance
_configuration_service_instance = None

def get_configuration_service() -> ConfigurationService:
    global _configuration_service_instance
    if _configuration_service_instance is None:
        _configuration_service_instance = ConfigurationService()
    return _configuration_service_instance
