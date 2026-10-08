"""Revision 2 adds monthly reports without altering operating snapshots."""
from sqlalchemy import Connection
from app.models.schemas import MonthlyReport


def apply(connection: Connection) -> None:
    MonthlyReport.__table__.create(connection, checkfirst=True)
