"""Run with python -m app.migrate before deploying a new application revision."""
from app.core.database import engine
from app.migrations import upgrade

if __name__ == "__main__":
    upgrade(engine)
    print("Database is at schema revision 1.")

