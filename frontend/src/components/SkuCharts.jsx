import React, { useState } from 'react';
import { aggregateProducts } from '../dashboard-utils';
import { amount, money, horizon, stockDays } from '../format';

export const metricOptions = [['contribution', 'Net contribution'], ['roas', 'ROAS'], ['revenue', 'Revenue'], ['spend', 'Ad spend']];
export function chartData(campaigns, metric) {
  const products = aggregateProducts(campaigns).map(row => ({ ...row, value: metric === 'roas' ? row.spend > 0 ? row.revenue / row.spend : null : row[metric] }));
  const scale = Math.max(1, ...products.map(row => Number.isFinite(row.value) ? Math.abs(row.value) : 0));
  return products.map(row => ({ ...row, width: Number.isFinite(row.value) ? Math.abs(row.value) / scale * 50 : 0 }));
}
export default function SkuCharts({ campaigns = [], snapshot = null, onInspect = () => {}, initialMetric = 'contribution' }) {
  const [metric, setMetric] = useState(metricOptions.some(([key]) => key === initialMetric) ? initialMetric : 'contribution');
  const products = chartData(campaigns, metric);
  const label = metricOptions.find(([key]) => key === metric)[1];
  return <section id="revenue" className="product-section">
    <div className="section-heading"><h2 className="eyebrow section-title">PORTFOLIO HEALTH</h2></div>
    <div className="chart-controls" aria-label="Chart metric">{metricOptions.map(([key, title]) => <button key={key} type="button" className="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>{title}</button>)}</div>
    <p className="fine-print">{label} across imported products. Bars share one scale; values left of zero are negative. This is a source-data comparison, not a historical price chart.</p>
    <div className="sku-chart-grid">{products.map(row => {
      const days = horizon(row);
      const valueText = row.value === null ? 'Not defined: no ad spend' : metric === 'roas' ? `${amount(row.value)}×` : money(row.value);
      const stock = row.inventory_data_missing ? 'Inventory missing' : days === null ? 'No recent velocity' : days < 14 ? 'Low stock: ads paused' : `${stockDays(days)} cover`;
      return <article className="sku-chart-card" key={row.sku}>
        <div className="sku-chart-heading"><h3>{row.sku}</h3><button type="button" className="button" onClick={() => onInspect(row)} aria-label={`Inspect ${row.sku}`}>Details</button></div>
        <span className="muted">{label}</span><strong className={row.value < 0 ? 'negative-value' : ''}>{valueText}</strong>
        <div className="signed-chart" role="img" aria-label={`${row.sku}: ${label} ${valueText}`}><span className="chart-zero"/><i className={row.value < 0 ? 'chart-negative' : 'chart-positive'} style={{width: `${row.width}%`, left: `${row.value < 0 ? 50 - row.width : 50}%`}} /></div>
        <div className="chart-scale"><span>Negative</span><span>0</span><span>Positive</span></div>
        <div className="sku-chart-footer"><span>Margin {amount(row.margin * 100)}%</span><span className={row.inventory_data_missing || days !== null && days < 14 ? 'warning' : 'muted'}>{stock}</span></div>
      </article>;
    })}</div>
    {!products.length && <p className="empty-state">Import source data to calculate product charts.</p>}
  </section>;
}
