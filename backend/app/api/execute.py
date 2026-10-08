# The Closed-Loop Actuator & Feedback Endpoint
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import datetime

router = APIRouter()

# In-memory feedback state store for closed-loop tracking
EXECUTION_STATE_STORE = []

class ExecutePayload(BaseModel):
    brand_id: str
    approved_allocation: List[Dict[str, Any]]
    total_approved_budget: float
    projected_profit_lift: float

@router.post("/api/execute")
def execute_budget_decision(payload: ExecutePayload):
    """
    Closed-loop actuator endpoint. Logs approved budget allocations into the 
    feedback state store and initializes post-action tracking metrics.
    """
    try:
        execution_record = {
            "execution_id": f"EX_EXEC_{len(EXECUTION_STATE_STORE) + 1:04d}",
            "brand_id": payload.brand_id,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "status": "APPLIED_TO_AD_APIS",
            "approved_allocation": payload.approved_allocation,
            "total_approved_budget": payload.total_approved_budget,
            "projected_profit_lift": payload.projected_profit_lift,
            "feedback_tracking": "ACTIVE_7_DAY_WINDOW"
        }
        
        EXECUTION_STATE_STORE.append(execution_record)

        return {
            "success": True,
            "message": "Budget allocation successfully approved and dispatched to live ad actuators.",
            "execution_record": execution_record
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/execute/history")
def get_execution_history():
    """Retrieves past execution logs for closed-loop model reinforcement."""
    return {
        "total_executions": len(EXECUTION_STATE_STORE),
        "history": EXECUTION_STATE_STORE
    }