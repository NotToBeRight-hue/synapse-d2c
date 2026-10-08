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

