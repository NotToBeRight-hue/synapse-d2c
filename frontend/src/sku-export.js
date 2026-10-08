import { aggregateProducts, contributionScores } from './dashboard-utils.js';
import { horizon } from './format.js';
import { campaignSourcePayload } from './source-import.js';

/** Export a reporting document, with no tokens or application session data. */
export function skuContributionReport(campaigns = [], snapshot = null) {
  const products = aggregateProducts(campaigns);
  const scores = contributionScores(products);
  return {
    report_type: 'sku_contribution', schema_version: 1, currency: 'INR',
    snapshot_id: snapshot?.snapshot_id ?? null,
    source_created_at: snapshot?.created_at ?? null,
    data_mode: snapshot?.data_mode ?? null,
    exported_at: new Date().toISOString(),
    contribution_formula: 'attributed_revenue * contribution_margin - ad_spend',
    source_payload: campaignSourcePayload(campaigns, snapshot),
    products: products.map(row => {
      const missing = Boolean(row.inventory_data_missing);
      const days = missing ? null : horizon(row);
      return {
        sku: row.sku,
        channels: [...new Set(campaigns.filter(item => item.sku === row.sku).map(item => item.channel))].sort(),
        attributed_revenue: row.revenue, ad_spend: row.spend,
        contribution_margin: row.margin, net_contribution: row.contribution,
        roas: row.spend > 0 ? row.revenue / row.spend : null,
        contribution_z_score: scores.get(row.sku) ?? null,
        stock_units: missing ? null : row.stock_units,
        daily_velocity: missing ? null : row.daily_velocity,
        stock_cover_days: Number.isFinite(days) ? days : null,
        inventory_data_missing: missing,
        inventory_protected: missing || (days !== null && days < 14),
      };
    }),
  };
}

export function downloadSkuContribution(campaigns, snapshot) {
  const report = skuContributionReport(campaigns, snapshot);
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `synapse-sku-contribution-${snapshot?.snapshot_id ?? 'current'}-${new Date().toISOString().slice(0, 10)}.json`;
  link.hidden = true;
  try { document.body.appendChild(link); link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
