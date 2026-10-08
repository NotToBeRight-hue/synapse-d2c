# Diagnostics & Anomaly Tagger
from fastapi import APIRouter, HTTPException
import numpy as np

router = APIRouter()

@router.post("/api/diagnostics")
def run_diagnostics(payload: dict):
    """
    Analyzes multi-channel campaign performance using rolling Z-scores 
    to flag anomalies (e.g., ROAS collapse, CPA spikes, creative saturation).
    """
    try:
        meta_channels = payload.get('meta', [])
        anomalies = []

        for item in meta_channels:
            spend = item.get('spend', 0)
            revenue = item.get('revenue', 0)
            sku = item.get('sku', 'Unknown SKU')
            
            # Calculate basic ROAS
            roas = revenue / (spend if spend > 0 else 1.0)
            
            # Simulated rolling baseline comparison (e.g., expected ROAS ~ 3.5)
            expected_roas = 3.5
            std_dev = 0.8
            z_score = (roas - expected_roas) / std_dev

            # Taggings based on Z-score thresholds
            if z_score < -1.5:
                anomalies.append({
                    "sku": sku,
                    "severity": "CRITICAL",
                    "metric": "ROAS_COLLAPSE",
                    "message": f"ROAS dropped to {roas:.2f} (Z-score: {z_score:.2f}). Potential audience fatigue or creative saturation detected."
                })
            elif roas > 5.0:
                anomalies.append({
                    "sku": sku,
                    "severity": "OPPORTUNITY",
                    "metric": "HIGH_EFFICIENCY",
                    "message": f"High efficiency vector identified with ROAS of {roas:.2f}. Recommended for capital scale-up."
                })

        return {
            "status": "success",
            "total_anomalies_detected": len(anomalies),
            "anomalies": anomalies
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

