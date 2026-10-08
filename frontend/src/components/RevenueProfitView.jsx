import React from 'react';
import { amount, horizon, percent } from '../format';
import { ShieldIcon } from './Visuals';
import { aggregateProducts, contributionScores } from '../dashboard-utils';
export default function RevenueProfitView({ campaigns = [] }) {
  const products = aggregateProducts(campaigns);
  const scores = contributionScores(products);
  return <section className="product-section" id="revenue">
    <div className="section-heading"><div><span className="eyebrow">PORTFOLIO HEALTH</span><h2>SKU contribution</h2></div><span className="muted">{products.length ? `${products.length} products in this snapshot` : 'Awaiting source data'}</span></div>
    <p className="fine-print">Contribution Z-scores compare this snapshot’s SKU cohort. They do not represent time-series anomaly detection.</p>
    <div className="product-health-grid">{products.map(row => {
      const days = horizon(row);
      const z = scores.get(row.sku);
      const maximum = Math.max(row.revenue, row.spend, 1);
      const critical = days !== null && days < 7;
      const protectedStock = days !== null && days < 14;
      const tone = row.inventory_data_missing ? 'warning' : critical ? 'critical' : protectedStock || row.contribution < 0 ? 'warning' : 'healthy';
      const status = row.inventory_data_missing ? 'Inventory Missing · Ads Paused' : critical ? 'Critical Stockout Risk' : protectedStock ? 'Low Stock · Ad Shield Active' : row.contribution < 0 ? 'Review Contribution' : 'Optimal';
      const cover = days === null ? 0 : Math.min(100, days / 30 * 100);
      return <article className={`product-health-card status-${tone}`} key={row.sku}>
        <div className="product-image-area"><span className={`health-pill ${tone}`}>{protectedStock && <ShieldIcon/>}{status}</span>
          {z !== null && <span className={`z-tag ${Math.abs(z) >= 2 ? 'warning' : ''}`} title="Population Z-score of net contribution within this snapshot">{Math.abs(z) >= 2 ? 'Cohort outlier / ' : ''}Z {z >= 0 ? '+' : ''}{amount(z)}</span>}
          <div className="financial-chart" role="img" aria-label={`${row.sku}: revenue ${amount(row.revenue)}, spend ${amount(row.spend)}`}>
            <div><span>Revenue</span><div className="bar-track"><i style={{width: `${row.revenue / maximum * 100}%`}} /></div><b>{amount(row.revenue)}</b></div>
            <div><span>Spend</span><div className="bar-track"><i className="spend-fill" style={{width: `${row.spend / maximum * 100}%`}} /></div><b>{amount(row.spend)}</b></div>
          </div>
        </div>
        <div className="product-card-body"><h3>{row.sku}</h3><div className="product-profit"><span>Net contribution</span><strong className={row.contribution < 0 ? 'negative-value' : undefined}>{amount(row.contribution)}</strong></div>
          <div className="product-mini-metrics"><div><span>Revenue</span><b>{amount(row.revenue)}</b></div><div><span>Ad spend</span><b>{amount(row.spend)}</b></div><div><span>Margin</span><b>{percent(row.margin * 100)}</b></div></div>
          <div className="stock-heading"><span>Inventory cover</span><b>{row.inventory_data_missing ? 'Not supplied' : days === null ? 'No recent velocity' : `${amount(days)} days`}</b></div>
          {!row.inventory_data_missing && <><div className={`stock-track stock-${critical ? 'critical' : protectedStock ? 'warning' : 'healthy'}`} role="meter" aria-label={`${row.sku} stock cover, 14-day safety threshold`} aria-valuemin={0} aria-valuemax={30} aria-valuenow={days === null ? 0 : Math.min(days, 30)} aria-valuetext={days === null ? 'No recent sales velocity; horizon undefined' : `${amount(days)} days`}><span style={{ width: `${cover}%` }}/><i title="14-day buffer"/></div>
          <div className="stock-scale"><span>0 days</span><span>14-day buffer</span><span>30+</span></div></>}
          {protectedStock && <p className="shield-note"><ShieldIcon/>Ad allocation locked at zero</p>}
        </div>
      </article>;
    })}</div>
    {!campaigns.length && <div className="visual-empty"><h3>No source snapshot</h3><p>Import source data to calculate SKU contribution and inventory coverage.</p></div>}
  </section>;
}
