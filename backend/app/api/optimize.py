from fastapi import APIRouter, HTTPException
from ..solver.optimizer import optimize_ad_spend_hill

router = APIRouter()

@router.post("/api/optimize")
def run_optimization(payload: dict):
    try:
        budgets = [item['spend'] for item in payload['meta']]
        revenues = [item['revenue'] for item in payload['shopify']]
        margins = [item['margin'] for item in payload['shopify']]
        # Assuming inventory days are passed or calculated from ERP warehouse data
        inventory_days = payload.get('inventory_days', [30.0] * len(budgets)) 
        max_budget = payload['budget']

        optimized_spends, success, message = optimize_ad_spend_hill(
            spends=budgets,
            revenues=revenues,
            margins=margins,
            inventory_days=inventory_days,
            max_total_budget=max_budget
        )

        return {
            "success": success,
            "message": message,
            "optimized_allocation": optimized_spends.tolist()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))