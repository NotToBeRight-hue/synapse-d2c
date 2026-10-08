"""Brand profile selection and token verification."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import current_brand
from app.models.schemas import Brand, BrandProfile, SessionResponse

router = APIRouter()


@router.get("/brands", response_model=list[BrandProfile])
def brands(db: Session = Depends(get_db)) -> list[BrandProfile]:
    # Profile names/IDs are deliberately public for the local gateway; secrets never are.
    return [BrandProfile(id=b.id, name=b.name) for b in db.scalars(select(Brand).order_by(Brand.name)).all()]


@router.get("/me", response_model=SessionResponse)
def me(brand: Brand = Depends(current_brand)) -> SessionResponse:
    return SessionResponse(brand=BrandProfile(id=brand.id, name=brand.name),
                           simulation_limit_per_hour=settings.simulation_limit,
                           ai_limit_per_day=settings.ai_limit)

