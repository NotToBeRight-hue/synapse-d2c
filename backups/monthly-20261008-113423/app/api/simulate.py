"""Inventory-safe comparative simulation, persistent quotas and audit history."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import current_brand, reserve_usage
from app.models.schemas import (
    Brand, IngestionSnapshot, Metric, MetricSummary, SimulateRequest, SimulationResponse, SyncPayload,
)
from app.services.analytics import normalize_campaigns
from app.services.gemini import generate_recommendation
from app.solver.optimizer import optimize_allocations, uniform_allocation

router = APIRouter()


@router.post("", response_model=SimulationResponse)
def run_simulation(request: SimulateRequest | None = None, db: Session = Depends(get_db),
                   brand: Brand = Depends(current_brand)) -> SimulationResponse:
    snapshot = db.scalar(select(IngestionSnapshot).where(IngestionSnapshot.brand_id == brand.id)
                         .order_by(IngestionSnapshot.id.desc()).limit(1))
    if snapshot is None:
        raise HTTPException(409, "Sync source data before running a simulation")
    request = request or SimulateRequest()
    if request.snapshot_id is not None and request.snapshot_id != snapshot.id:
        raise HTTPException(409, "Source data changed. Refresh the dashboard before simulating again.")
    payload = SyncPayload.model_validate(snapshot.payload)
    budget = request.budget if request.budget is not None else payload.budget
    campaigns = normalize_campaigns(payload)
    if not reserve_usage(db, brand.id, "simulation", settings.simulation_limit, 3600):
        raise HTTPException(429, "Hourly simulation limit reached", headers={"Retry-After": "3600"})
    try:
        optimized = optimize_allocations(campaigns, budget)
        baseline = uniform_allocation(campaigns, budget)
    except (ValueError, ArithmeticError) as error:
        raise HTTPException(422, str(error)) from error
    delta = optimized["net_profit"] - baseline["net_profit"]
    percent = delta / abs(baseline["net_profit"]) * 100 if abs(baseline["net_profit"]) > 1e-9 else None
    multiple = optimized["net_profit"] / baseline["net_profit"] if baseline["net_profit"] > 1e-9 else None
    result = {"snapshot_id": snapshot.id, "data_mode": payload.data_mode, "budget": budget,
              "baseline": baseline, "optimized": optimized,
              "profit_lift": {"absolute": delta, "percent": percent, "multiple": multiple},
              "profit_change_pct": percent}
    allow_ai = bool(request.include_ai and settings.gemini_api_key)
    if allow_ai:
        allow_ai = reserve_usage(db, brand.id, "ai", settings.ai_limit, 86400)
    result["recommendation"] = generate_recommendation(result, allow_ai=allow_ai)
    if not request.include_ai:
        result["recommendation"]["reason"] = "ai_disabled"
    elif settings.gemini_api_key and not allow_ai:
        result["recommendation"]["reason"] = "quota_exhausted"
    response = SimulationResponse.model_validate(result)
    metric = Metric(brand_id=brand.id, snapshot_id=snapshot.id,
                    net_contribution_profit=optimized["net_profit"], baseline_profit=baseline["net_profit"],
                    lift_multiplier=multiple, result=response.model_dump(mode="json"))
    db.add(metric)
    db.flush()
    response.metric_id = metric.id
    metric.result = response.model_dump(mode="json")
    db.commit()
    return response


@router.get("/history", response_model=list[MetricSummary])
def history(limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db),
            brand: Brand = Depends(current_brand)) -> list[MetricSummary]:
    metrics = db.scalars(select(Metric).where(Metric.brand_id == brand.id)
                         .order_by(Metric.id.desc()).limit(limit)).all()
    return [MetricSummary.model_validate(m, from_attributes=True) for m in metrics]


@router.get("/history/{metric_id}", response_model=SimulationResponse)
def history_detail(metric_id: int, db: Session = Depends(get_db),
                   brand: Brand = Depends(current_brand)) -> SimulationResponse:
    metric = db.scalar(select(Metric).where(Metric.id == metric_id, Metric.brand_id == brand.id))
    if metric is None:
        raise HTTPException(404, "Simulation not found")
    return SimulationResponse.model_validate(metric.result)

