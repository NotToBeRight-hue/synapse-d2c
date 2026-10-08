"""Ordered database migrations; never erase legacy snapshots."""
from sqlalchemy import Engine, text

REVISION = 2


def upgrade(engine: Engine) -> None:
    # Serialize startup migration across workers, on PostgreSQL and SQLite.
    with engine.connect() as connection:
        if engine.dialect.name == "sqlite":
            connection.exec_driver_sql("BEGIN IMMEDIATE")
        else:
            connection.begin()
            connection.execute(text("SELECT pg_advisory_xact_lock(73012901)"))
        try:
            connection.execute(text(
                "CREATE TABLE IF NOT EXISTS schema_migrations "
                "(version INTEGER PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
            ))
            current = connection.execute(text("SELECT MAX(version) FROM schema_migrations")).scalar() or 0
            if current > REVISION:
                raise RuntimeError("Database schema is newer than this application")
            if current < 1:
                from app.migrations.v001_entities import apply
                apply(connection)
                connection.execute(text("INSERT INTO schema_migrations (version) VALUES (1)"))
            if current < 2:
                from app.migrations.v002_monthly_reports import apply as apply_monthly
                apply_monthly(connection)
                connection.execute(text("INSERT INTO schema_migrations (version) VALUES (2)"))
            connection.commit()
        except Exception:
            connection.rollback()
            raise

