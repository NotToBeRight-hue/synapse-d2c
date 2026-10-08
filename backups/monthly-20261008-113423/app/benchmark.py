"""Reproducible illustrative benchmark; never forces a profit-lift target."""
import json
from pathlib import Path
from statistics import median
import argparse
from app.models.schemas import SyncPayload
from app.services.analytics import normalize_campaigns
from app.solver.optimizer import optimize_allocations, uniform_allocation


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", type=Path, default=Path("../frontend/public/sample-snapshot.json"))
    parser.add_argument("--runs", type=int, default=20)
    args = parser.parse_args()
    if not 1 <= args.runs <= 1000:
        parser.error("--runs must be between 1 and 1000")
    payload = SyncPayload.model_validate_json(args.payload.read_text(encoding="utf-8"))
    campaigns = normalize_campaigns(payload)
    reports = []
    for budget in (payload.budget * .5, payload.budget, payload.budget * 1.25):
        results = [optimize_allocations(campaigns, budget) for _ in range(args.runs)]
        optimized = results[-1]
        baseline = uniform_allocation(campaigns, budget)
        multiple = optimized["net_profit"] / baseline["net_profit"] if baseline["net_profit"] > 1e-9 else None
        reports.append({
            "budget": budget, "baseline_profit": baseline["net_profit"], "optimized_profit": optimized["net_profit"],
            "profit_multiple": multiple, "median_ms": median(r["solve_time_ms"] for r in results),
            "maximum_ms": max(r["solve_time_ms"] for r in results),
            "all_budget_feasible": all(r["total_spend"] <= budget for r in results),
            "all_inventory_safe": all(row["allocated_spend"] == 0 for r in results
                                      for row in r["allocations"] if row["inventory_protected"]),
        })
    print(json.dumps({"dataset": "explicit illustrative mock", "reports": reports}, indent=2))


if __name__ == "__main__":
    main()

