"""Configuration management using Pydantic Settings."""

from functools import lru_cache
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # OpenAI Configuration
    openai_api_key: str = Field(default="", description="OpenAI API key")
    openai_model: str = Field(default="gpt-4-turbo-preview", description="OpenAI model name")
    openai_max_tokens: int = Field(default=4096, description="Max tokens for OpenAI")
    openai_temperature: float = Field(default=0.7, ge=0.0, le=2.0)

    # Google Gemini Configuration
    gemini_api_key: str = Field(default="", description="Google Gemini API key")
    gemini_model: str = Field(default="gemini-2.5-flash", description="Gemini model name")
    gemini_max_tokens: int = Field(default=8192, description="Max tokens for Gemini")
    gemini_temperature: float = Field(default=0.7, ge=0.0, le=1.0)

    # Anthropic Claude Configuration
    anthropic_api_key: str = Field(default="", description="Anthropic API key")
    claude_model: str = Field(default="claude-3-opus-20240229", description="Claude model name")
    claude_max_tokens: int = Field(default=4096, description="Max tokens for Claude")
    claude_temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    
    # Application Settings
    app_name: str = Field(default="Multimodal Agent Builder")
    app_version: str = Field(default="0.1.0")
    app_env: str = Field(
        default="development", description="Environment: development, staging, production"
    )
    app_debug: bool = Field(default=True)
    app_port: int = Field(default=8000, ge=1, le=65535)
    app_host: str = Field(default="0.0.0.0")

    # Logging Configuration
    log_level: str = Field(default="INFO", description="Logging level")
    log_format: str = Field(default="json", description="Log format: json or plain")

    # Rate Limiting
    rate_limit_enabled: bool = Field(default=True)
    rate_limit_requests: int = Field(default=100, ge=1)
    rate_limit_period: int = Field(default=60, ge=1, description="Period in seconds")
    redis_url: str = Field(default="", description="Redis URL for shared rate limiting (optional)")

    # File Upload Settings
    max_file_size_mb: int = Field(default=10, ge=1, le=100)
    allowed_image_types: str = Field(default="jpg,jpeg,png,gif,bmp,webp")
    allowed_audio_types: str = Field(default="mp3,wav,ogg,m4a,flac")

    # CORS / Origins
    cors_allowed_origins: str = Field(
        default="*",
        description="Comma-separated list of allowed origins; '*' in development",
    )

    # Ethics/Grounding
    ethics_framework_path: str = Field(
        default="", description="Path to ethics framework reference materials"
    )

    # Agent Settings
    default_agent_timeout: int = Field(
        default=300, ge=10, le=3600, description="Timeout in seconds"
    )
    max_concurrent_agents: int = Field(default=10, ge=1, le=100)
    enable_agent_memory: bool = Field(default=True)

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of {valid_levels}")
        return v.upper()

    @field_validator("app_env")
    @classmethod
    def validate_app_env(cls, v: str) -> str:
        """Validate application environment."""
        valid_envs = ["development", "staging", "production"]
        if v.lower() not in valid_envs:
            raise ValueError(f"Invalid environment. Must be one of {valid_envs}")
        return v.lower()

    @property
    def allowed_image_extensions(self) -> List[str]:
        """Get list of allowed image file extensions."""
        return [f".{ext.strip()}" for ext in self.allowed_image_types.split(",")]

    @property
    def allowed_audio_extensions(self) -> List[str]:
        """Get list of allowed audio file extensions."""
        return [f".{ext.strip()}" for ext in self.allowed_audio_types.split(",")]

    @property
    def allowed_origins(self) -> List[str]:
        """Get list of allowed CORS origins based on environment."""
        if self.is_development and (self.cors_allowed_origins.strip() == "*"):
            return ["*"]
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.app_env == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.app_env == "development"

    def get_llm_config(self, provider: str) -> dict:
        """Get configuration for a specific LLM provider.

        Args:
            provider: One of 'openai', 'gemini', or 'anthropic'

        Returns:
            Dictionary with provider-specific configuration
        """
        configs = {
            "openai": {
                "api_key": self.openai_api_key,
                "model": self.openai_model,
                "max_tokens": self.openai_max_tokens,
                "temperature": self.openai_temperature,
            },
            "gemini": {
                "api_key": self.gemini_api_key,
                "model": self.gemini_model,
                "max_tokens": self.gemini_max_tokens,
                "temperature": self.gemini_temperature,
            },
            "anthropic": {
                "api_key": self.anthropic_api_key,
                "model": self.claude_model,
                "max_tokens": self.claude_max_tokens,
                "temperature": self.claude_temperature,
            },
        }

        if provider not in configs:
            raise ValueError(f"Unknown provider: {provider}. Must be one of {list(configs.keys())}")

        return configs[provider]

    def validate_api_keys(self) -> dict:
        """Validate which API keys are configured.

        Returns:
            Dictionary indicating which providers have API keys configured
        """
        return {
            "openai": bool(self.openai_api_key),
            "gemini": bool(self.gemini_api_key),
            "anthropic": bool(self.anthropic_api_key),
        }


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance.

    Returns:
        Settings instance
    """
    return Settings()


# Create a global settings instance
settings = get_settings()
