"""High-entropy bearer tokens and durable atomic per-brand usage limits."""
import hashlib
import time
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schemas import ApiToken, Brand, UsageCounter

bearer = HTTPBearer(auto_error=False)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def current_brand(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    x_brand_id: int | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Brand:
    if credentials is None or x_brand_id is None or len(credentials.credentials) > 512:
        raise HTTPException(401, "Select a brand and supply its API token", headers={"WWW-Authenticate": "Bearer"})
    brand = db.scalar(select(Brand).join(ApiToken).where(
        Brand.id == x_brand_id, ApiToken.token_hash == hash_token(credentials.credentials)
    ))
    if brand is None:
        raise HTTPException(401, "Invalid brand or API token", headers={"WWW-Authenticate": "Bearer"})
    return brand


def reserve_usage(db: Session, brand_id: int, scope: str, limit: int, seconds: int) -> bool:
    """Atomic across workers. Successful reservations persist even if an external call fails."""
    window = int(time.time()) // seconds * seconds
    key = {"brand_id": brand_id, "scope": scope, "window_start": window}
    try:
        with db.begin_nested():
            db.add(UsageCounter(**key, used=0))
            db.flush()
    except IntegrityError:
        pass
    result = db.execute(update(UsageCounter).where(
        UsageCounter.brand_id == brand_id, UsageCounter.scope == scope,
        UsageCounter.window_start == window, UsageCounter.used < limit,
    ).values(used=UsageCounter.used + 1))
    db.commit()
    return result.rowcount == 1

