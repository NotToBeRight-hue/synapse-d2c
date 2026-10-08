# Synapse-D2C: Next-Generation Autonomous Advertising Intelligence & Decision Engine
Synapse-D2C is an AI-native advertising intelligence and autonomous decision-making system engineered for Direct-to-Consumer (D2C) brands. It bridges the gap between fragmented multi-channel advertising data and proactive budget optimization, replacing passive analytics dashboards with a closed-loop decision engine.
# 🚀 Key Features & Capabilities
Unified Cross-Platform Intelligence: Ingests, reconciles, and reasons across disparate ad platforms (Meta, Google), sales channels (Shopify), contribution margins, and ERP inventory stock levels.

SciPy Optimization Core: Computes non-linear Hill-saturation diminishing-returns revenue curves using SciPy SLSQP optimization solvers to maximize net contribution profit under global budget ceilings.

Inventory Safety Guardrails: Automatically starves products facing critical stockout risks (< 14 days inventory cover) from ad expenditure ($0.0 allocation floor).

Interactive Trading-Style Ticker Grid: Features compact financial efficiency cards with conditional metric tabs (Net contribution, ROAS, Revenue, Ad spend), time horizon toggles (7D, 30D, 90D), and click-to-open SKU inspector modal windows.

Diagnostic Anomaly Audit: Implements rolling statistical Z-score variance analysis to automatically tag performance shifts and anomalies across brand portfolios.

Enterprise Security & Audit Logging: Built with brand-scoped operator authentication, typable workspace IDs, Pydantic data validation, and persistent PostgreSQL simulation audit history.
# Closed-Loop System Architecture
Synapse-D2C maps the complete autonomous decision journey:
Data -> Intelligence -> Reasoning -> Decision -> Action -> Feedback -> Learning
Data: Structured JSON snapshot ingestion unifying ad spend, sales, margins, and ERP inventory.

Intelligence: Transforming raw multi-channel records into normalized performance vectors and velocity indicators.

Reasoning: Enforcing inventory safety guardrails (< 14 days stock cover threshold) and margin constraints.

Decision: Running mathematical optimization solvers to generate ideal budget distribution curves.

Action: Dispatches structured actuator payloads and auditable decision records.

Feedback: Logging simulation outcomes and baseline-versus-optimized deltas into a persistent PostgreSQL database.

Learning: Auditing historical simulation logs to continuously refine decision models.
# 🛠️ Technology Stack

Backend: Python 3.11+, FastAPI, Pydantic, SciPy, SQLAlchemy, PostgreSQL 16.

Frontend: React 18, Vite, modern CSS custom properties with light/dark theme support.

Deployment: Containerized via Docker Compose.
# ⚙️ Quickstart & Local Deployment
Prerequisites
Docker & Docker Compose installed on your machine.

Node.js 18+ and Python 3.11+ (if running outside containers).

Running via Docker Compose
Clone the public repository:
            git clone https://github.com/your-username/synapse-d2c.git
            cd synapse-d2c
Configure your environment variables based on .env.example:
Bash
cp .env.example .env
Build and launch the container stack:
          docker compose up --build
Access the Frontend Cockpit at http://localhost:5173 and the FastAPI Swagger Docs at http://localhost:8000/docs.

# 📂 Repository Structure
/synapse-d2c
├── backend/                  # FastAPI service, SciPy solvers, database models, and routes
├── frontend/                 # React Vite app, components, App.jsx, and dashboard styling
├── presentation/             # PowerPoint presentation (.pptx) summarizing project architecture
├── docker-compose.yml        # Multi-container orchestration stack
├── README.md                 # System documentation
└── .env.example              # Template for environment configuration

# 📄 Documentation & Presentation
A detailed PowerPoint presentation outlining the 0-to-1 architecture, mathematical model, and business impact is available in the presentation/ directory.


## Two-month reporting comparison

Use **Month comparison** in the sidebar. Select Month 1 and Month 2, upload a complete JSON report for each, then select **Compare months**. Revenue, advertising spend, contribution, revenue-weighted margin, ROAS and SKU inventory cover appear side by side in INR. Each monthly file uses the same Meta/Google/Shopify/ERP source arrays as ingestion, with an explicit `reporting_month` such as `2026-08`. Financial records must cover the entire selected calendar month, use INR consistently, and contain actual source figures. ERP velocity remains units per day and stock represents the report's inventory observation. No default data is generated. `budget` is optional for monthly reports and is not used by the comparison.

Example file structure (replace illustrative values with actual records):

```json
{
  "reporting_month": "2026-08",
  "data_mode": "uploaded",
  "meta": [{"sku": "TEE-01", "spend": 10000, "revenue": 50000}],
  "google": [],
  "shopify": [{"sku": "TEE-01", "revenue": 50000, "margin": 0.4}],
  "erp": [{"sku": "TEE-01", "stock_units": 600, "daily_velocity": 20}]
}
```

Monthly reports are stored separately from daily operating snapshots. Importing reports never replaces current campaigns/inventory, executes the solver, spends AI quota, or creates simulation audit entries. For repeated uploads of the same reporting month, comparison selects the latest report ID, not the sum of uploads. Older versions remain stored. Existing snapshots have no proven reporting month and are not assigned a month based on import time. Import the original monthly source files through the monthly panel.

Protected API additions:

- `POST /api/sync/monthly`: validate and save a complete monthly report.
- `GET /api/sync/months`: latest report metadata for each available month in the authenticated brand.
- `GET /api/sync/compare?month1=2026-08&month2=2026-09`: compare the latest full report for each month.

Change is Month 2 minus Month 1. Percentage is `change / abs(Month 1) * 100`; a baseline within 1e-9 of zero yields null. Margin absolute change is displayed in percentage points. ROAS is null with zero spend and margin is null with zero revenue. An absent SKU is labeled **Not reported this month** rather than treated as a known zero. Comparative bars display magnitude; signed values identify negative contribution. Monthly totals use ad-attributed revenue, avoiding double-counting Shopify revenue.

Schema revision 2 adds only the `monthly_reports` table and migration record. Existing brands, tokens, operating snapshots, audit history and usage counters are preserved. Startup applies the migration automatically; `python -m app.migrate` also runs it explicitly. PostgreSQL and SQLite retain their existing serialized migration path.

For an existing Docker backend with Vite development frontend, apply saved backend files without an image rebuild from normal PowerShell:

```powershell
& "C:\Users\Abhishek Srinivasan\OneDrive\Documents\synapse-d2c\scripts\apply-monthly-comparison.ps1"
```

The script finds the running Compose backend on port 8000, backs up its Python source, copies only the monthly feature files, applies revision 2, restarts that backend and verifies health/OpenAPI. It leaves the database container running. Files copied into a container are preserved on restart but can be lost when the container is recreated; incorporate the source into the next explicitly authorized image build for a permanent image release. The frontend source is picked up by Vite without a build. A compiled Nginx frontend requires a separately authorized asset compilation to show edited source.

