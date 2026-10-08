# Monthly comparison patch notes: OneDrive project

Implemented directly in C:\Users\Abhishek Srinivasan\OneDrive\Documents\synapse-d2c on 8 October 2026.

- Add MonthComparison.jsx with explicit Month 1 and Month 2 selection, independent JSON uploads, side-by-side INR totals and SKU values, comparative bars, and signed changes.
- Keep monthly reports separate from daily operating snapshots. Pick the latest full report per month; never add duplicate uploads.
- Add authenticated POST /api/sync/monthly, GET /api/sync/months and GET /api/sync/compare endpoints.
- Add supporting database/security/normalization modules because this local backend did not contain them. Populate its empty models and sync files. Preserve existing database configuration and provider key environment handling.
- Add non-destructive revision 2 monthly_reports migration and database startup initialization.
- Preserve existing simulation, diagnostics, execution and scenario handler logic. Repair package import paths needed for startup, plus two pre-existing optimizer syntax errors (comment marker and indentation); do not change its algorithm.
- Keep the frontend API base URL and existing daily components. Add monthly CSS and numeric currency formatter.
- Save source backups before replacing files; no brand credentials, database data or actual monthly financial records were generated or changed.
- Verification in this OneDrive source: 9 backend tests and 2 frontend tests passed. Tests cover month validation, latest-report selection, channel aggregation, daily snapshot preservation, authentication/isolation, undefined ratios and migration preservation. Existing routes remain registered. This is a monthly feature verification, not a fresh audit of all legacy handler behavior.
- Add scripts/apply-monthly-comparison.ps1 in this actual folder. It backs up and extends the authenticated running backend without replacing its main.py wholesale, applies the migration, restarts only that backend and checks health/OpenAPI. It does not rebuild images or restart PostgreSQL.
- Live activation remains pending because Docker's local control pipe denies the agent access. Run the script from the normal user terminal.
- A container-source patch persists across restart but requires incorporation into a later image release before recreating that container.
- Final entry-point check also found and removed one pre-existing unmatched closing span in App.jsx. The frontend test now loads the complete App entry point and confirms the operator login renders. No frontend build was run.

- Add Export JSON beside SKU contribution. Downloads currently displayed aggregated SKU financials, stock coverage, Z-scores and snapshot metadata in INR. No credentials exported, no backend mutation, no rebuild. This is a reporting JSON document, not a raw ingestion snapshot.

- Move Decision audit to a dedicated #audit view with sidebar navigation and Back to dashboard. Legacy #history links also open that view. Keep dashboard components mounted while hidden so budget/monthly form state is preserved. History data and polling continue through the same authenticated API. No rebuild or backend changes.

## SKU chart and label corrections
- Added 16px separation between stock status and contribution Z-score, with wrapping on narrow cards.
- Removed visible snapshot wording and identifiers; retained stored data and API revision safeguards.
- Replaced fabricated candlesticks and inactive date controls with SKU-aggregated, selectable financial comparison bars. Negative contributions render left of zero; ROAS with zero spend is undefined.
- Preserved authentication, ingestion, simulations, monthly reports, audit navigation, and JSON exports.
- Source-only update, no image or frontend rebuild.

## Separate decision.html audit page
- Removed dashboard hash-based audit view and history polling.
- Added decision.html, its React entry, authenticated decision workspace and existing validated /api/simulate/history polling with manual refresh.
- Added Vite multi-page inputs for future builds. No rebuild performed.
- Dashboard opens audit in a separate tab, transfers credentials only in memory to the tracked same-origin child window, and revalidates /api/auth/me. Direct opening supports the existing login gateway. Tokens never enter URL or browser storage.
