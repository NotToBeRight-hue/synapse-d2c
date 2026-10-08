"""Environment configuration. Secrets remain on the server."""
import os
from sqlalchemy.engine import URL


def database_url() -> str:
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        return explicit
    if os.getenv("POSTGRES_HOST"):
        return URL.create("postgresql+psycopg", host=os.environ["POSTGRES_HOST"],
                          username=os.getenv("POSTGRES_USER", "synapse"),
                          password=os.getenv("POSTGRES_PASSWORD", "synapse"),
                          database=os.getenv("POSTGRES_DB", "synapse")).render_as_string(hide_password=False)
    return "sqlite:///./synapse.db"


class Settings:
    database_url: str = database_url()
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.7-flash")
    api_title: str = "Synapse D2C"
    simulation_limit: int = max(1, int(os.getenv("SIMULATION_LIMIT_PER_HOUR", "30")))
    ai_limit: int = max(0, int(os.getenv("AI_LIMIT_PER_DAY", "10")))
    cors_origins: list[str] = [s.strip() for s in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if s.strip()]


settings = Settings()

