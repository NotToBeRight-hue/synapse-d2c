import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { validateComparison, validateMonths } from '../src/api.js';

const first = { reporting_month: '2026-08', report_id: 1, created_at: '2026-09-01T00:00:00Z', data_mode: 'uploaded',
  totals: { revenue: 1000, spend: 100, contribution: 400, margin: 0.5, roas: 10 },
  products: [{ sku: 'SKU-A', revenue: 1000, spend: 100, contribution: 400, margin: 0.5, roas: 10, stock_days: 20, inventory_data_missing: false }] };
const second = { ...first, reporting_month: '2026-09', report_id: 2, totals: { ...first.totals, revenue: 0, spend: 0, contribution: 0, margin: null, roas: null }, products: [] };
const result = { month1: first, month2: second, changes: { revenue: { absolute: -1000, percent: -100 }, spend: {absolute: -100, percent: -100}, contribution: {absolute: -400, percent: -100} } };

test('monthly response validation accepts undefined ratios and rejects malformed financial fields', () => {
  assert.equal(validateComparison(result), result);
  assert.throws(() => validateMonths([{ ...first, reporting_month: '2026-13' }]));
  assert.throws(() => validateComparison({ ...result, month1: {...first, totals: {...first.totals, revenue: NaN}} }));
  assert.throws(() => validateComparison({ ...result, changes: {} }));
});

test('monthly panel renders side-by-side values, absent products and safe empty controls', async () => {
  const server = await createServer({ configFile: false, resolve: {preserveSymlinks: true}, appType: 'custom', logLevel: 'silent', server: {middlewareMode: true} });
  try {
    const {MonthResults, default: MonthComparison} = await server.ssrLoadModule('/src/components/MonthComparison.jsx');
    const html = renderToStaticMarkup(React.createElement(MonthResults, {result}));
    assert.ok(html.includes('Month 1 · 2026-08'));
    assert.ok(html.includes('Month 2 · 2026-09'));
    assert.ok(html.includes('₹1,000'));
    assert.ok(html.includes('Not reported this month'));
    assert.ok(html.includes('month-product-pair'));
    assert.ok(html.includes('Not defined'));
    const {default: App, Workspace} = await server.ssrLoadModule('/src/App.jsx');
    assert.ok(renderToStaticMarkup(React.createElement(App)).includes('Operator access'));
    const workspaceProps = {session: {brand: {id: 1, name: 'Test'}, operator: 'Test'}, theme: 'dark'};
    const dashboard = renderToStaticMarkup(React.createElement(Workspace, workspaceProps));
    assert.ok(!dashboard.includes('id="audit"'));
    assert.ok(!dashboard.includes('Recorded simulations'), 'History must not appear on the dashboard');
    assert.ok(dashboard.includes('href="/decision.html"'));
    const {default: DecisionWorkspace, DecisionResults} = await server.ssrLoadModule('/src/components/DecisionWorkspace.jsx');
    const audit = renderToStaticMarkup(React.createElement(DecisionWorkspace, workspaceProps));
    assert.ok(audit.includes('id="audit"'));
    assert.ok(audit.includes('Back to dashboard'));
    assert.ok(!audit.includes('id="overview"'));
    assert.ok(audit.includes('Loading recorded simulations'));
    const auditResults = renderToStaticMarkup(React.createElement(DecisionResults, {loaded: true, rows: [{id: 1, snapshot_id: 2, created_at: '2026-10-07T00:00:00Z', net_contribution_profit: 40, baseline_profit: 20, lift_multiplier: 2}]}));
    assert.ok(auditResults.includes('Recorded simulations'));
    assert.ok(auditResults.includes('2×'));
    assert.ok(auditResults.includes('Run #1'));
    const empty = renderToStaticMarkup(React.createElement(MonthComparison));
    assert.ok(empty.includes('Import Month 1 JSON'));
    assert.ok(empty.includes('Import Month 2 JSON'));
    assert.ok(!empty.includes('undefined'));
  } finally { await server.close(); }
});
