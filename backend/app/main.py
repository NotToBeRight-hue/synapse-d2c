from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .core.database import initialize_database, engine
from .core.config import settings

@asynccontextmanager
async def lifespan(app):
    initialize_database()
    yield

from fastapi import FastAPI
from .api import sync, simulate, optimize, diagnostics, execute, scenarios_api, comparison, auth  # <-- Import the new optimize module

app = FastAPI(title="Synapse-D2C Engine", lifespan=lifespan)

# Include your routers
app.include_router(sync.router, prefix="/api/sync")
app.include_router(simulate.router)
app.include_router(optimize.router)  # <-- Register the optimization route
app.include_router(diagnostics.router)  # <-- Register diagnostics route
app.include_router(execute.router)
app.include_router(scenarios_api.router)
@app.get("/")
def read_root():
    return {"status": "Synapse-D2C Autonomous Engine Online"}

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                   allow_methods=['GET', 'POST', 'PATCH'], allow_headers=['Content-Type', 'Authorization', 'X-Brand-ID'])
app.include_router(auth.router, prefix='/api/auth')
app.include_router(comparison.router, prefix='/api/sync')

@app.get('/health')
def health() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text('SELECT 1'))
    return {'status': 'ok', 'service': 'synapse-d2c'}