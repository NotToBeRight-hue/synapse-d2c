from fastapi import APIRouter, HTTPException
from backend.app.core.scenarios import DEMO_SCENARIOS

router = APIRouter()

@router.get("/api/scenarios")
def list_scenarios():
    """Returns a list of available high-impact demo scenario keys."""
    return {
        "scenarios": [
            {"key": key, "description": val["description"]} 
            for key, val in DEMO_SCENARIOS.items()
        ]
    }

@router.get("/api/scenarios/{scenario_key}")
def get_scenario_data(scenario_key: str):
    """Fetches the specific dataset and parameters for a given demo scenario."""
    if scenario_key not in DEMO_SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_key}' not found.")
    
    return DEMO_SCENARIOS[scenario_key]