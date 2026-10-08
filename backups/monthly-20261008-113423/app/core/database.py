"""SQLAlchemy engine, foreign-key enforcement and transaction lifecycle."""
from collections.abc import Generator
import sqlite3
from sqlalchemy import create_engine, event
from sqlalchemy.pool import ConnectionPoolEntry
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import settings

connect_args = {"check_same_thread": False, "timeout": 30} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=connect_args)
if engine.dialect.name == "sqlite":
    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection: sqlite3.Connection, _record: ConnectionPoolEntry) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as db:
        try:
            yield db
        except Exception:
            db.rollback()
            raise


def initialize_database() -> None:
    from app.migrations import upgrade
    upgrade(engine)

