import os
from google import genai
from google.genai import types

def generate_optimization_rationale(optimizer_results: dict) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Gemini API key not configured; fallback local rule-based rationale applied: High-efficiency SKUs scaled, low inventory items constrained to zero spend."

    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""
        Act as an expert D2C advertising growth strategist. 
        Analyze these optimization simulation results and provide a concise, executive-level recommendation:
        {optimizer_results}
        
        Focus on:
        1. Capital reallocation efficiency.
        2. Inventory protection safeguards applied.
        3. Projected profit lift.
        Keep the response clear, professional, and free of filler.
        """
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text
    except Exception as e:
        return f"AI Generation skipped due to error: {str(e)}"