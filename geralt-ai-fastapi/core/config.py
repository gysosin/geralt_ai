"""
GeraltAI Configuration

Pydantic Settings for type-safe, validated configuration with environment variable support.
"""
from functools import lru_cache
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # ==========================================================================
    # API Configuration
    # ==========================================================================
    API_VERSION: str = "v1"
    API_TITLE: str = "GeraltAI API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    API_ENDPOINT: str = Field(default="127.0.0.1:8000")
    AUTO_START_CELERY_WORKER: bool = Field(
        default=True,
        description="Start a local Celery worker with the API process for development only.",
    )
    ALLOW_ANONYMOUS_AGENT_PLATFORM: bool = Field(
        default=True,
        description="Allow unauthenticated agent platform access for local development only.",
    )

    # ==========================================================================
    # Security
    # ==========================================================================
    SECRET_KEY: str = Field(default="your_jwt_secret")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 386

    # ==========================================================================
    # CORS
    # ==========================================================================
    CORS_ORIGINS: List[str] = ["*"]

    # ==========================================================================
    # MongoDB
    # ==========================================================================
    MONGO_URI: str = Field(default="mongodb://127.0.0.1:27018")
    MONGO_DATABASE: str = "geraltai"
    MONGO_SERVER_SELECTION_TIMEOUT_MS: int = Field(default=3000, ge=500, le=30000)

    # ==========================================================================
    # Elasticsearch
    # ==========================================================================
    ELASTICSEARCH_URL: str = Field(default="http://127.0.0.1:9209")
    ELASTIC_INDEX: str = "documents"

    # ==========================================================================
    # Redis
    # ==========================================================================
    REDIS_HOST: str = "127.0.0.1"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""

    @property
    def redis_url(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}"

    # ==========================================================================
    # MinIO (Object Storage)
    # ==========================================================================
    MINIO_ENDPOINT: str = Field(default="127.0.0.1:9003")
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "documents"
    MINIO_SECURE: bool = False

    # ==========================================================================
    # Milvus (Vector DB)
    # ==========================================================================
    MILVUS_HOST: str = "127.0.0.1"
    MILVUS_PORT: int = 19530
    MILVUS_USER: str = ""
    MILVUS_PASSWORD: str = ""
    MILVUS_TOKEN: str = ""

    # ==========================================================================
    # AI Providers
    # ==========================================================================
    DEFAULT_AI_MODEL: str = Field(default="gemini", description="gemini, openai, or mistral")
    DEFAULT_EMBEDDING_MODEL: str = Field(default="gemini", description="gemini, openai, or mistral")
    DEFAULT_RERANKER: str = Field(default="cohere")

    # Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    GEMINI_LLM_MODEL: str = "gemini-2.5-flash-lite"

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENAI_LLM_MODEL: str = "gpt-4o-mini"

    # Mistral
    MISTRAL_API_KEY: str = ""
    MISTRAL_EMBEDDING_MODEL: str = "mistral-embed"
    MISTRAL_LLM_MODEL: str = "mistral-small-latest"

    # Cohere (Reranker)
    COHERE_API_KEY: str = ""
    COHERE_RERANK_MODEL: str = "rerank-english-v3.0"

    # Jina AI
    JINAAI_API_KEY: str = ""

    # ==========================================================================
    # Azure AD (Microsoft Auth)
    # ==========================================================================
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""
    AZURE_TENANT_ID: str = ""
    AZURE_SCOPE: str = "user"

    # ==========================================================================
    # RAG Configuration
    # ==========================================================================
    CHUNK_SIZE: int = Field(default=1000, ge=100, le=2000)
    CHUNK_OVERLAP: int = Field(default=128, ge=0, le=500)
    RETRIEVAL_TOP_K: int = Field(default=10, ge=1, le=50)
    RERANK_TOP_N: int = Field(default=10, ge=1, le=50)
    VECTOR_WEIGHT: float = Field(default=0.7, ge=0.0, le=1.0)
    KEYWORD_WEIGHT: float = Field(default=0.3, ge=0.0, le=1.0)
    EMBEDDING_DIMENSION: int = Field(default=1536)

    # ==========================================================================
    # Upload Limits
    # ==========================================================================
    MAX_CONTENT_LENGTH: int = Field(default=100 * 1024 * 1024)  # 100 MB

    # ==========================================================================
    # External URLs
    # ==========================================================================
    BOT_EMBED_URL: str = "https://geraltaidev.rectitudecs.com"

    # ==========================================================================
    # Timezone
    # ==========================================================================
    TIMEZONE: str = "UTC"

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"development", "staging", "production", "test"}
        normalized = v.lower()
        if normalized not in allowed:
            raise ValueError(f"Environment must be one of: {allowed}")
        return normalized

    @field_validator("DEFAULT_AI_MODEL", "DEFAULT_EMBEDDING_MODEL")
    @classmethod
    def validate_ai_model(cls, v: str) -> str:
        allowed = {"gemini", "openai", "mistral"}
        if v.lower() not in allowed:
            raise ValueError(f"AI model must be one of: {allowed}")
        return v.lower()

    @field_validator("DEFAULT_RERANKER")
    @classmethod
    def validate_reranker(cls, v: str) -> str:
        allowed = {"cohere", "jina", "none"}
        if v.lower() not in allowed:
            raise ValueError(f"Reranker must be one of: {allowed}")
        return v.lower()

    def _required_key_errors(self) -> List[str]:
        errors = []

        if self.DEFAULT_AI_MODEL == "gemini" and not self.GEMINI_API_KEY:
            errors.append("GEMINI_API_KEY required when using Gemini model")
        if self.DEFAULT_AI_MODEL == "openai" and not self.OPENAI_API_KEY:
            errors.append("OPENAI_API_KEY required when using OpenAI model")
        if self.DEFAULT_AI_MODEL == "mistral" and not self.MISTRAL_API_KEY:
            errors.append("MISTRAL_API_KEY required when using Mistral model")
        if self.DEFAULT_RERANKER == "cohere" and not self.COHERE_API_KEY:
            errors.append("COHERE_API_KEY required when using Cohere reranker")
        if self.DEFAULT_RERANKER == "jina" and not self.JINAAI_API_KEY:
            errors.append("JINAAI_API_KEY required when using Jina reranker")

        return errors

    def validate_required_keys(self) -> None:
        """Validate that required API keys are set based on selected models."""
        errors = self._required_key_errors()

        if errors:
            raise ValueError("Configuration errors: " + "; ".join(errors))

    def validate_startup_configuration(self) -> None:
        """Reject unsafe production startup defaults."""
        if self.ENVIRONMENT != "production":
            return

        errors = []
        weak_secret_values = {"", "your_jwt_secret", "change_me", "changeme"}
        if self.SECRET_KEY in weak_secret_values or len(self.SECRET_KEY) < 32:
            errors.append("SECRET_KEY must be a strong production secret")
        if "*" in self.CORS_ORIGINS:
            errors.append("CORS_ORIGINS must not include '*' in production")
        if self.AUTO_START_CELERY_WORKER:
            errors.append("AUTO_START_CELERY_WORKER must be false in production")
        if self.ALLOW_ANONYMOUS_AGENT_PLATFORM:
            errors.append("ALLOW_ANONYMOUS_AGENT_PLATFORM must be false in production")
        if self.MINIO_ACCESS_KEY == "minioadmin" or self.MINIO_SECRET_KEY == "minioadmin":
            errors.append("MINIO credentials must not use public defaults in production")
        errors.extend(self._required_key_errors())

        if errors:
            raise ValueError("Startup configuration errors: " + "; ".join(errors))

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
