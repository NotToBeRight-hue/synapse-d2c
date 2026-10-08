import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api, validateHistory} from '../src/api.js';
import config from '../vite.config.js';

test('both HTML pages have independent Vite entries', async () => {
 const dashboard = await readFile(new URL('../index.html', import.meta.url), 'utf8');
 const decision = await readFile(new URL('../decision.html', import.meta.url), 'utf8');
 assert.ok(dashboard.includes('/src/main.jsx'));
 assert.ok(!dashboard.includes('/src/decision.jsx'));
 assert.ok(decision.includes('/src/decision.jsx'));
 assert.ok(config.build.rollupOptions.input.dashboard.endsWith('index.html'));
 assert.ok(config.build.rollupOptions.input.decision.endsWith('decision.html'));
});

test('audit API requests retain brand authentication and validate history', async () => {
 const prior = globalThis.fetch;
 const record = {id: 3, snapshot_id: 4, created_at: '2026-10-08T00:00:00Z', net_contribution_profit: 45, baseline_profit: 30, lift_multiplier: 1.5};
 try {
  globalThis.fetch = async (url, options) => {
   assert.ok(url.endsWith('/api/simulate/history'));
   assert.equal(options.headers.Authorization, 'Bearer test-only-token');
   assert.equal(options.headers['X-Brand-ID'], '7');
   return {ok: true, json: async () => [record]};
  };
  const rows = validateHistory(await api('/simulate/history', {session: {brand: {id: 7}, token: 'test-only-token'}}));
  assert.equal(rows[0].net_contribution_profit, 45);
  assert.throws(() => validateHistory([{...record, lift_multiplier: undefined}]));
  globalThis.fetch = async () => ({ok: false, status: 401, json: async () => ({detail: 'Unauthorized'})});
  await assert.rejects(api('/simulate/history'), error => error.status === 401);
 } finally {globalThis.fetch = prior;}
});
