"""Brand-scoped monthly report ingestion and side-by-side comparison."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import current_brand
from app.models.schemas import Brand, MonthlyReport, MonthlyPayload, MonthSummary, MonthlyComparison
from app.services.analytics import normalize_campaigns
from app.services.comparison import monthly_view, changes

router = APIRouter()
MONTH_PATTERN = r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$"


@router.post("/monthly", response_model=MonthSummary)
def import_month(payload: MonthlyPayload, db: Session = Depends(get_db),
                 brand: Brand = Depends(current_brand)) -> MonthSummary:
    normalize_campaigns(payload)  # Same financial/SKU validation as daily ingestion.
    report = MonthlyReport(brand_id=brand.id, reporting_month=payload.reporting_month,
                           payload=payload.model_dump(mode="json"))
    db.add(report)
    db.commit()
    db.refresh(report)
    return MonthSummary(reporting_month=report.reporting_month, report_id=report.id,
                        created_at=report.created_at, data_mode=payload.data_mode)


@router.get("/months", response_model=list[MonthSummary])
def months(db: Session = Depends(get_db), brand: Brand = Depends(current_brand)) -> list[MonthSummary]:
    latest = select(func.max(MonthlyReport.id)).where(MonthlyReport.brand_id == brand.id).group_by(
        MonthlyReport.reporting_month)
    reports = db.scalars(select(MonthlyReport).where(MonthlyReport.id.in_(latest)).order_by(
        MonthlyReport.reporting_month.desc())).all()
    return [MonthSummary(reporting_month=r.reporting_month, report_id=r.id,
                         created_at=r.created_at, data_mode=r.payload.get("data_mode", "uploaded")) for r in reports]


@router.get("/compare", response_model=MonthlyComparison)
def compare(month1: str = Query(pattern=MONTH_PATTERN), month2: str = Query(pattern=MONTH_PATTERN),
            db: Session = Depends(get_db), brand: Brand = Depends(current_brand)) -> MonthlyComparison:
    if month1 == month2:
        raise HTTPException(422, "Choose two different reporting months")
    views = []
    for month in (month1, month2):
        report = db.scalar(select(MonthlyReport).where(MonthlyReport.brand_id == brand.id,
                            MonthlyReport.reporting_month == month).order_by(MonthlyReport.id.desc()).limit(1))
        if report is None:
            raise HTTPException(404, f"No monthly report for {month}. Import complete monthly totals first.")
        views.append(monthly_view(report))
    return MonthlyComparison(month1=views[0], month2=views[1], changes=changes(views[0].totals, views[1].totals))
