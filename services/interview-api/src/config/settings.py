"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "interview-platform"
    debug: bool = True

    # Database
    database_url: str = "postgresql+asyncpg://admin:admin123@localhost:5432/interview_platform"

    # JWT Auth
    jwt_secret_key: str = "change-me-to-a-random-256-bit-hex-string"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    # Judge0
    judge0_url: str = "https://judge0-ce.p.rapidapi.com"
    rapidapi_key: str = ""
    rapidapi_host: str = "judge0-ce.p.rapidapi.com"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # LLM Gateway (Alter Domus AI Gateway)
    llm_gateway_url: str = "https://api.alterdomus.dev/llm-gateway/v1"
    llm_gateway_model: str = "eu.claude-4.5-sonnet"
    llm_gateway_token: str = ""  # JWT Bearer token for M2M auth
    llm_gateway_org_id: str = ""  # x-organization-id header for tenant resolution

    # Frontend
    frontend_url: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
