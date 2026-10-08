import { aggregateProducts } from './dashboard-utils.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value, name, max = 1e12) => {
  if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`Invalid ${name} in the exported report.`);
  return value;
};

/** Exact normalized channel records, with inventory represented once per SKU. */
export function campaignSourcePayload(campaigns, snapshot = null) {
  const products = aggregateProducts(campaigns);
  const spend = campaigns.reduce((sum, row) => sum + row.spend, 0);
  return {
    data_mode: snapshot?.data_mode === 'mock' ? 'mock' : 'uploaded',
    budget: Number.isFinite(snapshot?.budget) && snapshot.budget > 0 ? snapshot.budget : spend || 1,
    meta: campaigns.filter(row => row.channel === 'meta').map(({sku, spend, revenue}) => ({sku, spend, revenue})),
    google: campaigns.filter(row => row.channel === 'google').map(({sku, spend, revenue}) => ({sku, spend, revenue})),
    shopify: products.map(row => ({sku: row.sku, revenue: row.revenue,
      margin: row.revenue > 0 ? (row.contribution + row.spend) / row.revenue : row.margin})),
    erp: products.filter(row => !row.inventory_data_missing).map(({sku, stock_units, daily_velocity}) => ({sku, stock_units, daily_velocity})),
  };
}

/** Translate reporting documents at the UI boundary; backend schemas stay unchanged. */
export function toIngestionPayload(document, {reportingMonth} = {}) {
  if (!object(document)) throw new Error('Choose a JSON object containing source data or a SKU contribution export.');
  if (document.currency && document.currency !== 'INR') throw new Error('Only INR reports can be imported. Currency conversion is not automatic.');
  let payload = document;
  if (document.report_type === 'sku_contribution') {
    if (document.schema_version !== 1) throw new Error('Unsupported SKU export schema version.');
    if (object(document.source_payload)) payload = document.source_payload;
    else {
      if (!Array.isArray(document.products) || !document.products.length) throw new Error('The exported report has no products.');
      payload = {data_mode: document.data_mode === 'mock' ? 'mock' : 'uploaded', meta: [], google: [], shopify: [], erp: []};
      const names = new Set();
      for (const row of document.products) {
        if (!object(row) || typeof row.sku !== 'string' || !row.sku.trim() || names.has(row.sku)) throw new Error('Exported products must have unique SKU names.');
        names.add(row.sku);
        if (!Array.isArray(row.channels) || row.channels.length !== 1 || !['meta', 'google'].includes(row.channels[0])) {
          throw new Error(`Cannot recover channel spend for ${row.sku}. This older export combines channels. Export again to include exact source records.`);
        }
        const revenue = finite(row.attributed_revenue, 'revenue', 1e9);
        const spend = finite(row.ad_spend, 'spend', 1e9);
        const margin = finite(row.contribution_margin, 'margin', 1);
        payload[row.channels[0]].push({sku: row.sku, revenue, spend});
        payload.shopify.push({sku: row.sku, revenue, margin});
        if (row.inventory_data_missing === false) {
          payload.erp.push({sku: row.sku, stock_units: finite(row.stock_units, 'stock units'), daily_velocity: finite(row.daily_velocity, 'stock velocity', 1e9)});
        }
      }
      const totalSpend = payload.meta.concat(payload.google).reduce((sum, row) => sum + row.spend, 0);
      payload.budget = document.budget ?? (totalSpend || 1);
    }
  }
  if (reportingMonth) {
    if (!/^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/.test(reportingMonth)) throw new Error('Select a valid reporting month.');
    if ([document.reporting_month, payload.reporting_month].some(month => month && month !== reportingMonth)) throw new Error('The file reporting_month differs from the selected month.');
    return {...payload, reporting_month: reportingMonth};
  }
  return {...payload};
}
