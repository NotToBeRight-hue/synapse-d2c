import React, { useState } from 'react';

export function inventoryChanges(products, values) {
  const records = [];
  for (const product of products) {
    const value = values[product.sku];
    if (value.stock === '' && value.velocity === '') continue;
    const stock = Number(value.stock), velocity = Number(value.velocity);
    if (value.stock === '' || value.velocity === '' || !Number.isFinite(stock) || !Number.isFinite(velocity)
      || stock < 0 || stock > 1e12 || velocity < 0 || velocity > 1e9) {
      throw new Error(`Enter valid stock units and daily units sold for ${product.sku}.`);
    }
    if (product.inventory_data_missing || stock !== product.stock_units || velocity !== product.daily_velocity) {
      records.push({ sku: product.sku, stock_units: stock, daily_velocity: velocity });
    }
  }
  if (!records.length) throw new Error('Enter actual inventory for at least one product before saving.');
  return records;
}

export default function InventoryEditor({ snapshot = null, busy = false, onSave = async () => {}, onError = () => {} }) {
  const products = [...new Map((snapshot?.campaigns || []).map(row => [row.sku, row])).values()];
  const [values, setValues] = useState(() => Object.fromEntries(products.map(row => [row.sku, {
    stock: row.inventory_data_missing ? '' : String(row.stock_units),
    velocity: row.inventory_data_missing ? '' : String(row.daily_velocity),
  }])));
  const missing = products.filter(row => row.inventory_data_missing).length;
  if (!products.length) return null;
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    try { await onSave({ snapshot_id: snapshot.snapshot_id, erp: inventoryChanges(products, values) }); }
    catch (error) { onError(error.message); }
  }
  function change(sku, field, value) {
    setValues(current => ({ ...current, [sku]: { ...current[sku], [field]: value } }));
  }
  return <details className="panel inventory-editor" open={missing > 0}>
    <summary>{missing ? `Add missing inventory (${missing} products)` : 'Update inventory'}</summary>
    <p className="muted">Enter actual totals across all warehouses. Daily velocity means units sold per day. Leave both fields blank to keep a product unchanged. Ads stay paused below 14 days of stock.</p>
    <form onSubmit={save}>
      <div className="inventory-input-grid">{products.map(row => <fieldset key={row.sku} disabled={busy}>
        <legend>{row.sku}</legend>
        <label>Stock units<input aria-label={`${row.sku} stock units`} type="number" min="0" max="1000000000000" step="any"
          value={values[row.sku].stock} onChange={event => change(row.sku, 'stock', event.target.value)} /></label>
        <label>Units sold per day<input aria-label={`${row.sku} units sold per day`} type="number" min="0" max="1000000000" step="any"
          value={values[row.sku].velocity} onChange={event => change(row.sku, 'velocity', event.target.value)} /></label>
      </fieldset>)}</div>
      <button className="button primary" disabled={busy}>{busy ? 'Saving...' : 'Save inventory'}</button>
      <p className="fine-print">This updates inventory and preserves your ad and sales data. Run the simulation again after saving.</p>
    </form>
  </details>;
}
