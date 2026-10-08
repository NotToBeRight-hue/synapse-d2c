"""Request validation and persisted snapshot models."""
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import DateTime, Integer, JSON, String, Float, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AdRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)
    sku: str = Field(min_length=1, max_length=100)
    spend: float = Field(ge=0, le=1_000_000_000)
    revenue: float = Field(ge=0, le=1_000_000_000)


class SalesRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)
    sku: str = Field(min_length=1, max_length=100)
    revenue: float = Field(ge=0, le=1_000_000_000)
    margin: float = Field(ge=0, le=1, description="Gross margin as a fraction, e.g. 0.55")


class InventoryRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)
    sku: str = Field(min_length=1, max_length=100)
    stock_units: float = Field(ge=0, le=1_000_000_000_000)
    daily_velocity: float = Field(ge=0, le=1_000_000_000, description="Units sold per day")
    margin: float | None = Field(default=None, ge=0, le=1)


class SyncPayload(BaseModel):
    """Combined ad-platform, commerce and inventory snapshot."""
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    data_mode: Literal["mock", "uploaded"] = "uploaded"
    budget: float = Field(gt=0, le=1_000_000_000, allow_inf_nan=False)
    meta: list[AdRecord] = Field(default_factory=list, max_length=5000)
    google: list[AdRecord] = Field(default_factory=list, max_length=5000)
    shopify: list[SalesRecord] = Field(default_factory=list, max_length=5000)
    erp: list[InventoryRecord] = Field(default_factory=list, max_length=5000)

    @field_validator("meta", "google", "shopify", "erp", mode="before")
    @classmethod
    def accept_wrapped_records(cls, value: Any) -> Any:
        if isinstance(value, dict):
            for key in ("campaigns", "records", "sales", "inventory", "items"):
                if key in value:
                    return value[key]
        return value


class SimulateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    snapshot_id: int | None = Field(default=None, ge=1, strict=True)
    budget: float | None = Field(default=None, gt=0, le=1_000_000_000, allow_inf_nan=False)
    include_ai: bool = True


class MonthlyPayload(SyncPayload):
    """Complete INR monthly financial totals, not daily optimizer inputs."""
    reporting_month: str = Field(pattern=r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$")
    budget: float = Field(default=1, gt=0, le=1_000_000_000)


class MonthlyReport(Base):
    __tablename__ = "monthly_reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    reporting_month: Mapped[str] = mapped_column(String(7), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)


class InventoryUpdate(BaseModel):
    """Replace supplied SKUs' total inventory within an existing snapshot."""
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    snapshot_id: int = Field(ge=1, strict=True)
    erp: list[InventoryRecord] = Field(min_length=1, max_length=100)

    @field_validator("erp")
    @classmethod
    def unique_skus(cls, records: list[InventoryRecord]) -> list[InventoryRecord]:
        if len({record.sku for record in records}) != len(records):
            raise ValueError("Supply one total stock and daily velocity record per SKU")
        return records


class StrictResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    @field_validator("created_at", check_fields=False)
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class SourceCounts(StrictResponse):
    meta: int
    google: int
    shopify: int
    erp: int


class CampaignMetrics(StrictResponse):
    inventory_data_missing: bool = False
    sku: str
    channel: Literal["meta", "google"]
    spend: float
    revenue: float
    margin: float
    stock_units: float
    daily_velocity: float


class SyncResponse(StrictResponse):
    data_mode: Literal["mock", "uploaded"] = "uploaded"
    status: Literal["synced"]
    snapshot_id: int
    source_counts: SourceCounts
    campaigns: list[CampaignMetrics]
    budget: float


class LatestSnapshotResponse(StrictResponse):
    data_mode: Literal["mock", "uploaded"] = "uploaded"
    snapshot_id: int
    created_at: datetime
    source_counts: SourceCounts
    campaigns: list[CampaignMetrics]
    budget: float


class AllocationRow(StrictResponse):
    inventory_data_missing: bool = False
    sku: str
    channel: Literal["meta", "google"]
    before_spend: float | None = None
    allocated_spend: float
    predicted_revenue: float
    predicted_contribution: float
    stockout_horizon_days: float | None
    inventory_protected: bool


class AllocationResult(StrictResponse):
    allocations: list[AllocationRow]
    total_spend: float
    unspent_budget: float
    net_profit: float
    converged: bool | None = None
    solver: str | None = None
    solve_time_ms: float | None = None
    model: dict[str, float] | None = None


class ProfitLift(StrictResponse):
    absolute: float
    percent: float | None
    multiple: float | None


class Recommendation(StrictResponse):
    text: str
    provider: Literal["gemini", "local-fallback"]
    reason: Literal["api_key_missing", "ai_disabled", "quota_exhausted", "request_too_large", "empty_response", "provider_error"] | None = None


class SimulationResponse(StrictResponse):
    metric_id: int | None = None
    data_mode: Literal["mock", "uploaded"] = "uploaded"
    snapshot_id: int
    budget: float
    baseline: AllocationResult
    optimized: AllocationResult
    profit_lift: ProfitLift
    profit_change_pct: float | None
    recommendation: Recommendation


class IngestionSnapshot(Base):
    __tablename__ = "ingestion_snapshots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brand_id: Mapped[int | None] = mapped_column(ForeignKey("brands.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="accepted")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Brand(Base):
    __tablename__ = "brands"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # References to operator-managed secrets, never plaintext provider credentials.
    provider_token_refs: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)


class ApiToken(Base):
    __tablename__ = "api_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Campaign(Base):
    __tablename__ = "campaigns"
    __table_args__ = (UniqueConstraint("brand_id", "sku", "platform"),
                      CheckConstraint("daily_spend >= 0 AND generated_revenue >= 0"),
                      CheckConstraint("platform IN ('meta', 'google')"))
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    sku: Mapped[str] = mapped_column(String(100))
    platform: Mapped[str] = mapped_column(String(20))
    daily_spend: Mapped[float] = mapped_column(Float)
    generated_revenue: Mapped[float] = mapped_column(Float)


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (UniqueConstraint("brand_id", "sku"),
                      CheckConstraint("current_stock_units >= 0 AND daily_stock_velocity >= 0"),
                      CheckConstraint("contribution_margin >= 0 AND contribution_margin <= 1"))
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    sku: Mapped[str] = mapped_column(String(100))
    current_stock_units: Mapped[float] = mapped_column(Float)
    daily_stock_velocity: Mapped[float] = mapped_column(Float)
    days_of_inventory: Mapped[float | None] = mapped_column(Float)
    contribution_margin: Mapped[float] = mapped_column(Float)


class Metric(Base):
    __tablename__ = "metrics"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("ingestion_snapshots.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    net_contribution_profit: Mapped[float] = mapped_column(Float)
    baseline_profit: Mapped[float] = mapped_column(Float)
    lift_multiplier: Mapped[float | None] = mapped_column(Float)
    result: Mapped[dict[str, Any]] = mapped_column(JSON)


class UsageCounter(Base):
    __tablename__ = "usage_counters"
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), primary_key=True)
    scope: Mapped[str] = mapped_column(String(30), primary_key=True)
    window_start: Mapped[int] = mapped_column(Integer, primary_key=True)
    used: Mapped[int] = mapped_column(Integer, default=0)


class BrandProfile(StrictResponse):
    id: int
    name: str


class SessionResponse(StrictResponse):
    brand: BrandProfile
    simulation_limit_per_hour: int
    ai_limit_per_day: int


class MetricSummary(StrictResponse):
    id: int
    snapshot_id: int
    created_at: datetime
    net_contribution_profit: float
    baseline_profit: float
    lift_multiplier: float | None


class MonthSummary(StrictResponse):
    reporting_month: str
    report_id: int
    created_at: datetime
    data_mode: Literal["mock", "uploaded"]


class FinancialTotals(StrictResponse):
    revenue: float
    spend: float
    contribution: float
    margin: float | None
    roas: float | None


class MonthlyProduct(FinancialTotals):
    sku: str
    stock_days: float | None
    inventory_data_missing: bool


class MonthlyView(MonthSummary):
    totals: FinancialTotals
    products: list[MonthlyProduct]


class ComparisonChange(StrictResponse):
    absolute: float
    percent: float | None


class MonthlyComparison(StrictResponse):
    month1: MonthlyView
    month2: MonthlyView
    changes: dict[str, ComparisonChange]
