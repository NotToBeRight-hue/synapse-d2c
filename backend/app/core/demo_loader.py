# Demo Scenario State Loader for Live Judging & Testing

from .scenarios import DEMO_SCENARIOS

def load_demo_scenario(scenario_key: str) -> dict:
    """
    Retrieves predefined high-impact test scenarios:
    - 'stockout_risk': Forces ad spend to 0.0 due to < 14 days stock.
    - 'starved_margin': Corrects capital allocation away from low-margin commodities.
    """
    if scenario_key not in DEMO_SCENARIOS:
        raise ValueError(f"Invalid scenario key. Choose from {list(DEMO_SCENARIOS.keys())}")
    
    return DEMO_SCENARIOS[scenario_key]["data"]