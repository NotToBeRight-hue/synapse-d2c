"""Run with python -m app.migrate before deploying a new application revision."""
from app.core.database import engine
from app.migrations import upgrade
from app.migrations import REVISION

if __name__ == "__main__":
    upgrade(engine)
    print(f"Database is at schema revision {REVISION}.")

