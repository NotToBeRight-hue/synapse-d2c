import test from 'node:test';
import assert from 'node:assert/strict';
import {toIngestionPayload} from '../src/source-import.js';
import {skuContributionReport} from '../src/sku-export.js';

const row = {sku: 'Zephyr Oversized Tees', channel: 'meta', revenue: 14000000, spend: 2500000,
  margin: .35, stock_units: 145, daily_velocity: 9, inventory_data_missing: false};

test('new exports round-trip exact channel spend, budget and SKU inventory', () => {
 const second = {...row, channel: 'google', revenue: 1000000, spend: 200000};
 const report = skuContributionReport([row, second], {budget: 15000000, data_mode: 'uploaded'});
 const payload = toIngestionPayload(report);
 assert.deepEqual(payload.meta, [{sku: row.sku, spend: row.spend, revenue: row.revenue}]);
 assert.deepEqual(payload.google, [{sku: row.sku, spend: second.spend, revenue: second.revenue}]);
 assert.equal(payload.shopify[0].revenue, 15000000);
 assert.equal(payload.shopify[0].margin, .35);
 assert.equal(payload.erp.length, 1);
 assert.equal(payload.erp[0].stock_units, 145);
 assert.equal(payload.budget, 15000000);
 assert.ok(!('products' in payload));
 const monthly = toIngestionPayload(report, {reportingMonth: '2026-08'});
 assert.equal(monthly.reporting_month, '2026-08');
 assert.ok(!('snapshot_id' in monthly));
});

test('existing single-channel report imports supplied inventory and ignores derived fields', () => {
 const report = skuContributionReport([row]);
 delete report.source_payload;
 report.products[0].net_contribution = 999; // Recompute from inputs, never trust exported derived values.
 const payload = toIngestionPayload(report);
 assert.equal(payload.budget, 2500000);
 assert.equal(payload.meta[0].revenue, 14000000);
 assert.deepEqual(payload.erp[0], {sku: row.sku, stock_units: 145, daily_velocity: 9});
 assert.equal(payload.shopify[0].margin, .35);
 report.products[0].channels = ['meta', 'google'];
 assert.throws(() => toIngestionPayload(report), /Cannot recover channel spend/);
});

test('missing inventory remains missing and import refuses invalid currency and month', () => {
 const report = skuContributionReport([{...row, inventory_data_missing: true}]);
 delete report.source_payload;
 assert.deepEqual(toIngestionPayload(report).erp, []);
 assert.throws(() => toIngestionPayload({...report, currency: 'USD'}), /Only INR/);
 assert.throws(() => toIngestionPayload({...report, reporting_month: '2026-08'}, {reportingMonth:'2026-09'}), /differs/);
 assert.throws(() => toIngestionPayload(report, {reportingMonth:'2026-13'}), /valid reporting month/);
 assert.throws(() => toIngestionPayload([]), /JSON object/);
 const raw = {budget: 100, data_mode: 'mock', meta: [], google: [], shopify: [], erp: []};
 assert.deepEqual(toIngestionPayload(raw), raw);
 assert.equal(toIngestionPayload(raw, {reportingMonth:'2026-08'}).data_mode, 'mock');
});
