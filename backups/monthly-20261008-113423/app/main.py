"""FastAPI application with explicit origins, authentication and safe errors."""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.api import auth, simulate, sync
from app.core.database import initialize_database, engine
from app.core.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    initialize_database()
    yield


app = FastAPI(title=settings.api_title, version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                   allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type", "Authorization", "X-Brand-ID"])
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(sync.router, prefix="/api/sync", tags=["sync"])
app.include_router(simulate.router, prefix="/api/simulate", tags=["simulation"])


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, error: RequestValidationError) -> JSONResponse:
    # Never echo tokens, entire payloads, or non-JSON NaN values in validation errors.
    return JSONResponse(status_code=422, content={"detail": [
        {"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]}
        for item in error.errors()
    ]})


@app.exception_handler(SQLAlchemyError)
async def database_error(_request: Request, error: SQLAlchemyError) -> JSONResponse:
    logger.error("Database operation failed: %s", type(error).__name__)
    return JSONResponse(status_code=503, content={"detail": "Database temporarily unavailable. Retry shortly."})


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "service": "synapse-d2c"}

