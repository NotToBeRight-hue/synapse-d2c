import React, { useState } from 'react';
import { amount, percent, horizon } from '../format';
import { LiftGauge, ShieldIcon } from './Visuals';
const fallbackReasons = {
  api_key_missing: 'Gemini is not configured on the server.', ai_disabled: 'Gemini summary was not requested.',
  quota_exhausted: 'The daily Gemini request limit has been reached.', request_too_large: 'The result exceeds the Gemini request size limit.',
  empty_response: 'Gemini returned no summary.', provider_error: 'Gemini was unavailable or rejected the request.',
};
export default function BudgetAllocationPanel({ snapshot = null, simulation = null, busy = false, onRun = () => {} }) {
  const [budget, setBudget] = useState(snapshot?.budget || 1000);
  const [includeAI, setIncludeAI] = useState(true);
  const [view, setView] = useState(1);
  const valid = Number.isFinite(Number(budget)) && Number(budget) > 0 && Number(budget) <= 1e9;
  const sliderMax = Math.min(1e9, Math.max(100, (snapshot?.budget || 1000) * 2, Number(budget) || 0));
  const baseline = new Map((simulation?.baseline.allocations || []).map(row => [row.sku + ':' + row.channel, row]));
  const protectedCount = new Set((snapshot?.campaigns || []).filter(row => horizon(row) !== null && horizon(row) < 14).map(row => row.sku)).size;
  const missingCount = new Set((snapshot?.campaigns || []).filter(row => row.inventory_data_missing).map(row => row.sku)).size;
  const allPaused = simulation?.optimized.allocations.length > 0 && simulation.optimized.allocations.every(row => row.inventory_protected);
  const stale = simulation && Number(budget) !== simulation.budget;
  return <section className="panel engine-panel" id="allocation" aria-busy={busy}>
    <div className="section-heading"><h2 className="eyebrow section-title">OPTIMIZATION</h2></div>
    <div className="engine-grid"><form className="engine-controls" onSubmit={e => { e.preventDefault(); if (valid && snapshot && !busy) onRun({ budget: Number(budget), include_ai: includeAI }); }}>
      <label className="budget-input-label">Maximum daily budget<input type="number" min="0.01" max="1000000000" step="0.01" value={budget} disabled={busy} onChange={e => setBudget(e.target.value)} required /></label>
      <input className="budget-main-slider" aria-label="Maximum daily budget slider" type="range" min="1" max={sliderMax} step="1" value={Math.max(1, Number(budget) || 1)} disabled={busy} onChange={e => setBudget(Number(e.target.value))}/>
      <div className="range-labels"><span>1</span><span>{amount(sliderMax)}</span></div>
      <div className={`guardrail ${protectedCount ? 'guardrail-active' : ''}`}><ShieldIcon/><div><b>Inventory shield</b><span>{!snapshot ? 'Enforced on every simulation' : protectedCount ? `${protectedCount} SKU(s) paused: missing inventory or below 14 days` : 'All products meet the stock buffer'}</span></div><span role="switch" aria-label="Mandatory 14-day inventory guardrail" aria-checked="true" aria-readonly="true" className="shield-switch" title="Always on. Cannot be disabled."><i/></span></div>
      {missingCount > 0 && <p className="warning-text" role="alert">Inventory missing for {missingCount} SKU(s). Import ERP stock_units and daily_velocity in units per day, with exact SKU names. Missing inventory keeps ad allocation at zero.</p>}
      <label className="checkbox-label"><input type="checkbox" checked={includeAI} disabled={busy} onChange={e => setIncludeAI(e.target.checked)}/>Include Synapse AI recommendation</label>
      <button className="button primary simulation-cta" disabled={busy || !snapshot || !valid}>{busy ? 'Running solver...' : 'Run Counterfactual Simulation'}</button>
    </form><div className="lift-panel" aria-live="polite"><span className="eyebrow">PROJECTED NET PROFIT LIFT</span><LiftGauge multiple={simulation?.profit_lift.multiple} pending={!simulation}/>
      {simulation ? <><div className="profit-pair"><div><span>Standard profit</span><strong>{amount(simulation.baseline.net_profit)}</strong></div><div><span>Optimized profit</span><strong>{amount(simulation.optimized.net_profit)}</strong></div></div><span className={`change-badge ${simulation.profit_lift.percent === null || simulation.profit_lift.absolute < 0 ? 'negative' : ''}`}>{allPaused ? 'No eligible inventory: budget unspent' : simulation.profit_lift.percent === null ? 'Zero baseline: percentage unavailable' : `${percent(simulation.profit_lift.percent)} projected change`}</span><p className="fine-print">Budget {amount(simulation.budget)}</p></> : <p className="muted">Your calculated result will appear here.</p>}
      {stale && <p className="warning-text" role="status">Budget changed. Run again to update the result.</p>}
    </div></div>
    {simulation ? <>
      <div className="comparison-heading"><div><span className="eyebrow">BEFORE / AFTER</span><h3>Allocation comparison</h3></div><label className="comparison-control">Compare plans<input aria-label="Compare standard and optimized allocations" aria-valuetext={view ? 'Optimized plan highlighted' : 'Standard plan highlighted'} type="range" min="0" max="1" step="1" value={view} onChange={e => setView(Number(e.target.value))}/><span>{view ? 'Optimized' : 'Standard'}</span></label></div>
      <div className="comparison-legend"><span><i className="before-key"/>Standard unoptimized spend</span><span><i className="after-key"/>Optimized spend</span></div>
      <div className={`allocation-chart ${view ? 'view-after' : 'view-before'}`}>{simulation.optimized.allocations.map(row => {
        const before = baseline.get(row.sku + ':' + row.channel)?.allocated_spend || 0;
        const maximum = Math.max(simulation.budget, 1);
        return <div className="allocation-chart-row" key={row.sku + ':' + row.channel}><div className="chart-product"><b>{row.sku}</b><span>{row.channel}{row.inventory_data_missing ? ' · Inventory missing' : row.inventory_protected ? ' · Below 14 days' : ''}{row.inventory_protected && <ShieldIcon/>}</span></div>
          <div className="chart-bars"><div className="chart-bar before" aria-label={`${row.sku} standard allocation ${amount(before)}`}><div className="bar-track"><span style={{ width: `${Math.min(100, before / maximum * 100)}%` }}/></div><output>{amount(before)}<small>{percent(before / maximum * 100)} of budget</small></output></div><div className="chart-bar after" aria-label={`${row.sku} optimized allocation ${amount(row.allocated_spend)}`}><div className="bar-track"><span style={{ width: `${Math.min(100, row.allocated_spend / maximum * 100)}%` }}/></div><output>{amount(row.allocated_spend)}<small>{percent(row.allocated_spend / maximum * 100)} of budget</small></output></div></div></div>;
      })}</div>
      <div className="recommendation"><div className="recommendation-icon" aria-hidden="true">AI</div><div><span className="eyebrow">{simulation.recommendation.provider === 'gemini' ? 'SYNAPSE AI / EXECUTIVE TAKEAWAY' : 'LOCAL / EXECUTIVE TAKEAWAY'}</span><p>{simulation.recommendation.text}</p>{simulation.recommendation.provider === 'local-fallback' && simulation.recommendation.reason && <small>{fallbackReasons[simulation.recommendation.reason] || 'A local calculation summary is shown.'}</small>}</div></div>
      <details className="model-details"><summary>Model details & remaining budget</summary><p>Unspent: {amount(simulation.optimized.unspent_budget)} · Solver: {simulation.optimized.solver || 'Not reported'} · {amount(simulation.optimized.solve_time_ms)} ms · Convergence: {simulation.optimized.converged === true ? 'Successful' : 'Not confirmed'}</p><p>Both plans enforce inventory safety; standard spend is a uniform benchmark, not historical spend. The comparison control changes the highlighted plan only. Results use a logarithmic response curve and are projections, not guaranteed returns.</p></details>
    </> : <div className="engine-empty"><ShieldIcon/><span>Set your budget and run a simulation to reveal the allocation comparison.</span></div>}
  </section>;
}
