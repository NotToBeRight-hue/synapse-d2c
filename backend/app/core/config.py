import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: os.getenv(
        "DATABASE_URL", "postgresql+psycopg://synapse:synapse@localhost:5432/synapse"
    ))
    simulation_limit: int = field(default_factory=lambda: max(1, int(os.getenv('SIMULATION_LIMIT_PER_HOUR', '30'))))
    ai_limit: int = field(default_factory=lambda: max(0, int(os.getenv('AI_LIMIT_PER_DAY', '10'))))
    cors_origins: list[str] = field(default_factory=lambda: [value.strip() for value in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if value.strip()])
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""), repr=False)


settings = Settings()
