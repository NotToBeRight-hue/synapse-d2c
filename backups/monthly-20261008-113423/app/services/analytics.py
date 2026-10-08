"""Pure source aggregation shared by ingestion and simulations."""
from collections import defaultdict
from dataclasses import dataclass
import math
from typing import Any
from fastapi import HTTPException
from app.models.schemas import SyncPayload


@dataclass
class Sales:
    revenue: float = 0.0
    contribution: float = 0.0
    margin_sum: float = 0.0
    count: int = 0


@dataclass
class Stock:
    units: float = 0.0
    velocity: float = 0.0
    margin_sum: float = 0.0
    margin_count: int = 0


def _sources(payload: SyncPayload) -> tuple[dict[str, Sales], dict[str, Stock]]:
    sales: dict[str, Sales] = defaultdict(Sales)
    inventory: dict[str, Stock] = defaultdict(Stock)
    for row in payload.shopify:
        product = sales[row.sku]
        product.revenue += row.revenue
        product.contribution += row.revenue * row.margin
        product.margin_sum += row.margin
        product.count += 1
    for row in payload.erp:
        stock = inventory[row.sku]
        stock.units += row.stock_units
        stock.velocity += row.daily_velocity
        if row.margin is not None:
            stock.margin_sum += row.margin
            stock.margin_count += 1
    return sales, inventory


def _margin(sales: Sales | None, stock: Stock | None) -> float | None:
    if sales and sales.count:
        return sales.contribution / sales.revenue if sales.revenue else sales.margin_sum / sales.count
    if stock and stock.margin_count:
        return stock.margin_sum / stock.margin_count
    return None


def normalize_campaigns(payload: SyncPayload) -> list[dict[str, Any]]:
    sales, inventory = _sources(payload)
    grouped: dict[tuple[str, str], dict[str, float]] = defaultdict(lambda: {"spend": 0.0, "revenue": 0.0})
    for channel in ("meta", "google"):
        for record in getattr(payload, channel):
            grouped[(record.sku, channel)]["spend"] += record.spend
            grouped[(record.sku, channel)]["revenue"] += record.revenue
    if not grouped:
        raise HTTPException(422, "At least one Meta or Google ad record is required")
    if len(grouped) > 100:
        raise HTTPException(422, "At most 100 unique SKU/channel pairs are supported")
    result: list[dict[str, Any]] = []
    for (sku, channel), metrics in grouped.items():
        stock = inventory.get(sku)
        margin = _margin(sales.get(sku), stock)
        if margin is None:
            raise HTTPException(422, f"Contribution margin missing from Shopify/ERP for SKU: {sku}")
        result.append({"sku": sku, "channel": channel, **metrics, "margin": margin,
                       "inventory_data_missing": stock is None,
                       "stock_units": stock.units if stock else 0.0,
                       "daily_velocity": stock.velocity if stock else 0.0})
    return result


def normalize_inventory(payload: SyncPayload) -> list[dict[str, Any]]:
    sales, inventory = _sources(payload)
    result: list[dict[str, Any]] = []
    for sku, stock in inventory.items():
        horizon = 0.0 if stock.units == 0 else (stock.units / stock.velocity if stock.velocity else None)
        if horizon is not None and not math.isfinite(horizon):
            horizon = None
        result.append({"sku": sku, "current_stock_units": stock.units, "daily_stock_velocity": stock.velocity,
                       "days_of_inventory": horizon, "contribution_margin": _margin(sales.get(sku), stock) or 0.0})
    return result
