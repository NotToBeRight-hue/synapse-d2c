"""Revision 1: brand ownership, normalized entities, audit and quota tables."""
from sqlalchemy import Connection, inspect, text
from app.models.schemas import Base


def apply(connection: Connection) -> None:
    legacy = "ingestion_snapshots" in inspect(connection).get_table_names()
    Base.metadata.create_all(connection)
    if legacy:
        columns = {c["name"] for c in inspect(connection).get_columns("ingestion_snapshots")}
        if "brand_id" not in columns:
            connection.execute(text(
                "ALTER TABLE ingestion_snapshots ADD COLUMN brand_id INTEGER REFERENCES brands(id)"
            ))
            connection.execute(text(
                "CREATE INDEX ix_ingestion_snapshots_brand_id ON ingestion_snapshots (brand_id)"
            ))
    # Legacy snapshots stay unassigned. Do not silently expose them to a new brand.

