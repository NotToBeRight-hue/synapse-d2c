api token to login GxUBGVhbh0pPCzHH61FP4NMY6dP4aLh1EnlOgpuODfk


# Synapse D2C

Starter scaffold for a FastAPI optimization engine and React dashboard, following the requested directory layout.

## Status

The backend health endpoint and frontend welcome screen are implemented. Ingestion and simulation routes return HTTP 501. Database entities, provider adapters, Gemini recommendations and the mathematical solver remain explicit implementation stubs. No live integrations or optimization results are supplied.

## Run with Docker

Install Docker with Compose and Node.js 22 or later. From this directory:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Backend docs: http://localhost:8000/docs

Health endpoint: http://localhost:8000/health

Compose starts the backend and PostgreSQL; database tables are not created yet. Credentials and loopback ports are for local development only. Set deployment secrets separately before hosting.

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. The dashboard is a placeholder and does not call the backend yet.

## Run backend without Docker

Use Python 3.12 or later, with a reachable PostgreSQL instance when persistence is added:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload
```

Configuration reads process environment variables. The root `.env` is read by Compose; for a local Python run, set `$env:DATABASE_URL` and `$env:GEMINI_API_KEY` explicitly as needed.

## Checks

```powershell
cd backend
.\.venv\Scripts\python -m pytest
```

The solver test is intentionally skipped until implementation. Add numerical convergence, feasibility and API tests when implementing the engine.

```powershell
cd frontend
npm run build
```

## Next implementation steps

1. Define Brand, Campaign, Inventory and Metric entities and database migrations.
2. Implement mock ingestion, followed by authenticated provider adapters.
3. Specify campaign response curves, margins and budget/inventory constraints; implement and test SLSQP optimization.
4. Connect simulation routes and Gemini recommendations to validated results.
5. Replace the dashboard placeholder with metrics, scenario controls and allocation charts.

SLSQP does not itself guarantee convexity; that property depends on the objective and constraints.
