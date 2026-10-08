from fastapi import FastAPI
from backend.app.api import sync, simulate, optimize, diagnostics, execute, scenarios_api  # <-- Import the new optimize module

app = FastAPI(title="Synapse-D2C Engine")

# Include your routers
app.include_router(sync.router)
app.include_router(simulate.router)
app.include_router(optimize.router)  # <-- Register the optimization route
app.include_router(diagnostics.router)  # <-- Register diagnostics route
app.include_router(execute.router)
app.include_router(scenarios_api.router)
@app.get("/")
def read_root():
    return {"status": "Synapse-D2C Autonomous Engine Online"}
