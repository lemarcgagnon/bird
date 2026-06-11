from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./nichoir16.db"
    allow_dev_bootstrap: bool = False
    demo_email: str = "demo@nichoir.local"
    demo_password: str = "demo1234"
    session_ttl_hours: int = 24
    cors_origins: str = "http://127.0.0.1:8016"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
