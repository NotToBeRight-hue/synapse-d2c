"""Concave log-response profit allocation with bounded multi-start SLSQP.

For spend x: revenue = a * log1p(x / scale), a = observed revenue / log1p(observed / scale).
The negative profit objective is convex. Inventory bounds express business safety,
not a mathematical remedy for non-convex objectives. Latency is measured, not guaranteed.
"""
from __future__ import annotations

from time import perf_counter
from typing import Any, Mapping, Sequence
import numpy as np
from numpy.typing import NDArray
from scipy.optimize import minimize

Vector = NDArray[np.float64]
STOCK_BUFFER_DAYS = 14.0
MAX_ITERATIONS = 100
MAX_BUDGET = 1_000_000_000.0
MAX_CAMPAIGNS = 100
SOLVER_BUDGET_SECONDS = 0.075


class _SolverDeadline(Exception):
    pass


def _number(value: Any, label: str, maximum: float = 1e16) -> float:
    try:
        value = float(value)
    except (ValueError, TypeError, OverflowError) as error:
        raise ValueError(f"{label} must be a finite number") from error
    if not np.isfinite(value) or not 0 <= value <= maximum:
        raise ValueError(f"{label} must be finite and between 0 and {maximum:g}")
    return value


def _validated_budget(budget: float) -> float:
    value = _number(budget, "budget", MAX_BUDGET)
    if value <= 0:
        raise ValueError("budget must be positive")
    return value


def _parameters(campaigns: Sequence[Mapping[str, Any]]) -> tuple[Vector, Vector, Vector, Vector]:
    if len(campaigns) > MAX_CAMPAIGNS:
        raise ValueError(f"At most {MAX_CAMPAIGNS} SKU/channel pairs are supported per simulation")
    a, scales, margins, horizons = [], [], [], []
    for index, row in enumerate(campaigns):
        try:
            spend = _number(row["spend"], "spend")
            revenue = _number(row["revenue"], "revenue")
            margin = _number(row["margin"], "margin", 1)
            stock = _number(row["stock_units"], "stock_units")
            velocity = _number(row["daily_velocity"], "daily_velocity")
            if not row["sku"] or row["channel"] not in ("meta", "google"):
                raise ValueError("sku and channel are required")
        except KeyError as error:
            raise ValueError(f"campaign {index} is missing {error.args[0]}") from error
        scale = max(spend, 1.0)
        # No observed spend means no evidence of an advertising response.
        a.append(revenue / np.log1p(spend / scale) if spend >= 1e-6 else 0.0)
        scales.append(scale)
        margins.append(margin)
        horizons.append(0.0 if row.get("inventory_data_missing", False) or stock == 0 else (stock / velocity if velocity > 0 else np.inf))
    return np.asarray(a), np.asarray(scales), np.asarray(margins), np.asarray(horizons)


def _profit(x: Vector, a: Vector, scales: Vector, margins: Vector) -> float:
    return float(np.sum(margins * a * np.log1p(x / scales) - x))


def _feasible(x: Vector, caps: Vector, budget: float) -> Vector:
    x = np.clip(np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0), 0.0, caps)
    total = float(x.sum())
    if total > budget:
        x *= budget / total
    # Correct possible last-bit overflow without redistributing to blocked SKUs.
    if float(x.sum()) > budget:
        x *= np.nextafter(budget / float(x.sum()), 0.0)
    return x


def _dual_fallback(weights: Vector, scales: Vector, caps: Vector, budget: float) -> Vector:
    """KKT water filling for the separable logarithmic objective.

    x_i(lambda) = clip(weight_i/(1+lambda)-scale_i, 0, cap_i).
    Bisection is deterministic and avoids unbounded gradients at zero spend.
    """
    unconstrained = np.clip(weights - scales, 0, caps)
    if float(unconstrained.sum()) <= budget:
        return unconstrained
    low, high = 0.0, max(1.0, float(np.max(weights / scales)))
    for _ in range(100):
        middle = (low + high) / 2
        x = np.clip(weights / (1 + middle) - scales, 0, caps)
        if float(x.sum()) > budget:
            low = middle
        else:
            high = middle
    return _feasible(np.clip(weights / (1 + high) - scales, 0, caps), caps, budget)


def _result(campaigns: list[dict[str, Any]], x: Vector, budget: float,
            a: Vector, scales: Vector, margins: Vector, horizons: Vector) -> dict[str, Any]:
    revenues = a * np.log1p(x / scales)
    rows = [{
        "sku": row["sku"], "channel": row["channel"], "before_spend": float(row["spend"]),
        "allocated_spend": float(x[i]), "predicted_revenue": float(revenues[i]),
        "predicted_contribution": float(margins[i] * revenues[i] - x[i]),
        "stockout_horizon_days": float(horizons[i]) if np.isfinite(horizons[i]) else None,
        "inventory_protected": bool(horizons[i] < STOCK_BUFFER_DAYS),
        "inventory_data_missing": bool(row.get("inventory_data_missing", False)),
    } for i, row in enumerate(campaigns)]
    spent = float(x.sum())
    return {"allocations": rows, "total_spend": spent, "unspent_budget": max(0.0, budget - spent),
            "net_profit": _profit(x, a, scales, margins)}


def uniform_allocation(campaigns: list[dict[str, Any]], budget: float) -> dict[str, Any]:
    """Fair baseline: equal budget across observed, inventory-safe campaigns."""
    budget = _validated_budget(budget)
    a, scales, margins, horizons = _parameters(campaigns)
    eligible = (horizons >= STOCK_BUFFER_DAYS) & (a > 0)
    x = np.zeros(len(campaigns))
    if eligible.any():
        x[eligible] = budget / int(eligible.sum())
    x = _feasible(x, np.where(eligible, budget, 0), budget)
    return _result(campaigns, x, budget, a, scales, margins, horizons)


def optimize_allocations(campaigns: list[dict[str, Any]], budget: float) -> dict[str, Any]:
    started = perf_counter()
    budget = _validated_budget(budget)
    a, scales, margins, horizons = _parameters(campaigns)
    weights = a * margins
    # Spending beyond the unconstrained optimum can only reduce profit.
    caps = np.where(horizons >= STOCK_BUFFER_DAYS, np.minimum(budget, np.maximum(weights - scales, 0)), 0)
    eligible = np.flatnonzero(caps > 0)
    best = np.zeros(len(campaigns))
    converged, solver, starts_attempted = True, "inventory-safe-zero", 0
    if eligible.size:
        w, s, c = weights[eligible], scales[eligible], caps[eligible]
        objective_scale = max(1.0, budget, float(w.sum()))
        observations = np.asarray([float(row["spend"]) for row in campaigns])[eligible]
        starts = [
            _feasible(np.full(eligible.size, budget / eligible.size), c, budget),
            _feasible(observations, c, budget),
            np.zeros(eligible.size),
        ]
        best_profit = 0.0
        converged = False
        deadline = started + SOLVER_BUDGET_SECONDS

        def check() -> None:
            if perf_counter() > deadline:
                raise _SolverDeadline

        def objective(y: Vector) -> float:
            check()
            x = y * budget
            return -float(np.sum(w * np.log1p(x / s) - x)) / objective_scale

        def gradient(y: Vector) -> Vector:
            check()
            # Finite because scale >= 1. Normalize for stable SLSQP conditioning.
            return -(w / (s + y * budget) - 1) * budget / objective_scale

        for initial in starts:
            if perf_counter() >= deadline:
                break
            starts_attempted += 1
            try:
                result = minimize(objective, initial / budget, method="SLSQP", jac=gradient,
                                  bounds=[(0.0, float(cap / budget)) for cap in c],
                                  constraints=[{"type": "ineq", "fun": lambda y: 1.0 - float(y.sum()),
                                                "jac": lambda y: -np.ones_like(y)}],
                                  options={"maxiter": MAX_ITERATIONS, "ftol": 1e-11})
                candidate = _feasible(np.asarray(result.x) * budget, c, budget)
                profit = float(np.sum(w * np.log1p(candidate / s) - candidate))
                if result.success and np.isfinite(result.x).all() and profit >= best_profit:
                    best[eligible], best_profit = candidate, profit
                    converged = True
            except (_SolverDeadline, ValueError, RuntimeError, ArithmeticError):
                continue
        # Independent KKT certificate also catches falsely successful SLSQP exits.
        certified = _dual_fallback(w, s, c, budget)
        certified_profit = float(np.sum(w * np.log1p(certified / s) - certified))
        if not converged or certified_profit - best_profit > max(1e-7, abs(certified_profit) * 1e-7):
            best[eligible] = certified
            solver, converged = "log-dual-fallback", True
        else:
            solver = "SLSQP-multistart"
    best = _feasible(best, caps, budget)
    result = _result(campaigns, best, budget, a, scales, margins, horizons)
    result.update(converged=converged, solver=solver,
                  solve_time_ms=round((perf_counter() - started) * 1000, 3),
                  model={"stock_buffer_days": STOCK_BUFFER_DAYS, "starts_attempted": starts_attempted})
    return result

