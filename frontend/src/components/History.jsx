import React from 'react';
import { amount } from '../format';
export default function History({ rows = [] }) {
  return <section className="panel" id="history"><div className="section-heading"><div><span className="eyebrow">DECISION AUDIT</span><h2>Recorded simulations</h2></div><span className="muted">Latest 20 requested</span></div>
    {rows.length ? <ol className="history-list">{rows.map(row => <li className="history-item" key={row.id}>
      <strong className="history-multiple">{row.lift_multiplier === null ? 'No ratio' : amount(row.lift_multiplier) + '×'}</strong>
      <div><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time><small>Run #{row.id} · Snapshot #{row.snapshot_id} · Simulation recorded</small></div>
      <div className="history-profit">{amount(row.net_contribution_profit)}<small>Projected profit · Standard {amount(row.baseline_profit)}{row.lift_multiplier === null && <span> · Baseline not positive</span>}</small></div>
    </li>)}</ol> : <p className="empty-state">Completed simulations will appear here.</p>}
    <p className="execution-status">Platform execution is not connected. These records audit simulations; no advertising budget changes were executed.</p>
  </section>;
}
