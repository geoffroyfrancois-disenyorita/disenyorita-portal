from pydantic import BaseSettings, AnyHttpUrl
from typing import List


class Settings(BaseSettings):
    api_v1_str: str = "/api/v1"
    project_name: str = "Disenyorita Isla Platform"
    allowed_hosts: List[AnyHttpUrl] = []
    cors_origins: List[str] = ["http://localhost:3000"]
    security_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 60 * 24 * 14
    secret_key: str = "change-me"

    class Config:
        env_file = ".env"
        case_sensitive = True


def get_settings() -> Settings:
    return Settings()
