"""Monthly financial reports reuse source normalization, never solver projections."""
from collections import defaultdict
from typing import Any
import math
from app.models.schemas import (
    ComparisonChange, FinancialTotals, MonthlyPayload, MonthlyProduct, MonthlyReport, MonthlyView,
)
from app.services.analytics import normalize_campaigns


def totals(revenue: float, spend: float, gross: float) -> FinancialTotals:
    return FinancialTotals(revenue=revenue, spend=spend, contribution=gross - spend,
                           margin=gross / revenue if revenue > 0 else None,
                           roas=revenue / spend if spend > 0 else None)


def monthly_view(report: MonthlyReport) -> MonthlyView:
    payload = MonthlyPayload.model_validate(report.payload)
    campaigns = normalize_campaigns(payload)
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in campaigns:
        grouped[row["sku"]].append(row)
    products: list[MonthlyProduct] = []
    for sku, rows in sorted(grouped.items()):
        revenue = sum(row["revenue"] for row in rows)
        spend = sum(row["spend"] for row in rows)
        gross = sum(row["revenue"] * row["margin"] for row in rows)
        stock = rows[0]  # Inventory belongs to the SKU, not each channel.
        days = None if stock["inventory_data_missing"] else (0.0 if stock["stock_units"] == 0 else
               stock["stock_units"] / stock["daily_velocity"] if stock["daily_velocity"] > 0 else None)
        if days is not None and not math.isfinite(days):
            days = None
        products.append(MonthlyProduct(sku=sku, **totals(revenue, spend, gross).model_dump(),
                                       stock_days=days, inventory_data_missing=stock["inventory_data_missing"]))
    revenue = sum(row.revenue for row in products)
    spend = sum(row.spend for row in products)
    gross = sum(row.contribution + row.spend for row in products)
    return MonthlyView(reporting_month=report.reporting_month, report_id=report.id,
                       created_at=report.created_at, data_mode=payload.data_mode,
                       totals=totals(revenue, spend, gross), products=products)


def changes(first: FinancialTotals, second: FinancialTotals) -> dict[str, ComparisonChange]:
    result: dict[str, ComparisonChange] = {}
    for key in ("revenue", "spend", "contribution", "margin", "roas"):
        before, after = getattr(first, key), getattr(second, key)
        if before is None or after is None:
            continue
        delta = after - before
        result[key] = ComparisonChange(absolute=delta,
                                      percent=delta / abs(before) * 100 if abs(before) > 1e-9 else None)
    return result
