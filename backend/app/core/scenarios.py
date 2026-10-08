# Phase 3 High-Impact Demonstration Scenarios

DEMO_SCENARIOS = {
    "stockout_risk": {
        "description": "Trending ad driving high traffic, causing an imminent SKU inventory stockout (< 14 days inventory). Optimizer must force spend to 0.0.",
        "data": {
            "data_mode": "scenario_stockout",
            "budget": 10000000,
            "meta": [
                {"sku": "Viral Summer Dress", "spend": 4000000, "revenue": 12000000}
            ],
            "shopify": [
                {"sku": "Viral Summer Dress", "revenue": 12000000, "margin": 0.40}
            ],
            "inventory_days": [8.5]  # Below 14-day threshold -> Triggers inventory safeguard!
        }
    },
    "starved_margin": {
        "description": "High-margin SKU starved of ad spend while low-margin items consume capital. Optimizer reallocates budget for maximum profit lift.",
        "data": {
            "data_mode": "scenario_starved",
            "budget": 15000000,
            "meta": [
                {"sku": "Low Margin Commodity", "spend": 10000000, "revenue": 11000000},
                {"sku": "High Margin Luxury Item", "spend": 500000, "revenue": 2500000}
            ],
            "shopify": [
                {"sku": "Low Margin Commodity", "revenue": 11000000, "margin": 0.08},
                {"sku": "High Margin Luxury Item", "revenue": 2500000, "margin": 0.55}
            ],
            "inventory_days": [45.0, 30.0]
        }
    }
}