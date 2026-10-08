/** Match typed workspace credentials to the existing brand token gateway. */
export function resolveOperator(input, brands) {
  const value = input.trim();
  const matches = /^\d+$/.test(value)
    ? brands.filter(brand => String(brand.id) === value)
    : brands.filter(brand => brand.name.toLowerCase() === value.toLowerCase());
  if (matches.length !== 1) throw new Error('Enter a provisioned brand ID or exact workspace name. Use the ID for ambiguous names.');
  return matches[0];
}

export function initialTheme() {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem('synapse-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* The toggle still works when storage is blocked. */ }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Population Z-scores across the current SKU contribution cohort, not history. */
export function contributionScores(products) {
  const result = new Map(products.map(row => [row.sku, null]));
  if (products.length < 3) return result;
  const mean = products.reduce((sum, row) => sum + row.contribution, 0) / products.length;
  const variance = products.reduce((sum, row) => sum + (row.contribution - mean) ** 2, 0) / products.length;
  const deviation = Math.sqrt(variance);
  if (!Number.isFinite(deviation) || deviation === 0) return result;
  for (const row of products) result.set(row.sku, (row.contribution - mean) / deviation);
  return result;
}

export function aggregateProducts(campaigns) {
  const products = new Map();
  for (const row of campaigns) {
    const product = products.get(row.sku) || { ...row, spend: 0, revenue: 0, contribution: 0 };
    product.spend += row.spend;
    product.revenue += row.revenue;
    product.contribution += row.revenue * row.margin - row.spend;
    products.set(row.sku, product);
  }
  return [...products.values()];
}

export function snapshotDiagnostics(campaigns) {
  const products = aggregateProducts(campaigns);
  const scores = contributionScores(products);
  const diagnostics = [];
  for (const row of products) {
    if (row.inventory_data_missing) {
      diagnostics.push({ sku: row.sku, code: 'missing-inventory', severity: 'warning',
        text: 'ERP inventory missing. Allocation is paused until stock and daily sales velocity are supplied.' });
    } else {
      const days = row.stock_units === 0 ? 0 : row.daily_velocity > 0 ? row.stock_units / row.daily_velocity : null;
      if (days !== null && days < 14) diagnostics.push({ sku: row.sku, code: 'inventory-buffer',
        severity: days < 7 ? 'critical' : 'warning', days,
        text: 'Stock coverage is below the 14-day allocation buffer.' });
    }
    const z = scores.get(row.sku);
    if (z !== null && Math.abs(z) >= 2) diagnostics.push({ sku: row.sku, code: 'contribution-outlier',
      severity: 'warning', z, text: 'Net contribution is a snapshot cohort outlier. Review source attribution and margins.' });
  }
  return diagnostics.sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical') || a.sku.localeCompare(b.sku));
}
