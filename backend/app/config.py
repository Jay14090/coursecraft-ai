from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "CourseCraft API"
    app_env: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"
    frontend_url: str = "http://localhost:3000"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/coursecraft"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None
    llm_provider: Literal["groq", "openrouter", "demo"] = "demo"
    llm_model: str = "llama-3.3-70b-versatile"
    groq_api_key: str | None = None
    openrouter_api_key: str | None = None
    embedding_model: str = "text-embedding-3-small"
    demo_mode: bool = True
    preview_data_path: str | None = None
    preview_gcs_bucket: str | None = None
    preview_gcs_object: str = "coursecraft/preview-data.json"
    preview_firestore_collection: str | None = None
    preview_firestore_document: str = "preview-state"
    max_pdf_mb: int = Field(default=50, ge=1, le=200)

    @property
    def llm_api_key(self) -> str | None:
        return self.groq_api_key if self.llm_provider == "groq" else self.openrouter_api_key

    @property
    def llm_base_url(self) -> str:
        if self.llm_provider == "groq":
            return "https://api.groq.com/openai/v1"
        return "https://openrouter.ai/api/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
