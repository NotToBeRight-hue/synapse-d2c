import React from 'react';
import { snapshotDiagnostics } from '../dashboard-utils';
import { amount, stockDays } from '../format';

export default function Diagnostics({ snapshot = null }) {
  const rows = snapshotDiagnostics(snapshot?.campaigns || []);
  return <section className="panel diagnostics-panel" id="diagnostics">
    <div className="section-heading"><h2 className="eyebrow section-title">SOURCE DIAGNOSTICS</h2>
      <span className="muted">{snapshot ? `${rows.length} findings` : 'No data loaded'}</span></div>
    {rows.length ? <ul className="diagnostics-list">{rows.map(row => <li key={row.sku + ':' + row.code}>
      <span className={`diagnostic-tag ${row.severity}`}>{row.code === 'contribution-outlier' ? `Z ${row.z >= 0 ? '+' : ''}${amount(row.z)}`
        : row.code === 'missing-inventory' ? 'Inventory missing' : stockDays(row.days)}</span>
      <div><strong>{row.sku}</strong><p>{row.text}</p></div>
    </li>)}</ul> : <p className="empty-state">{snapshot ? 'No inventory buffer violations or contribution cohort outliers found.' : 'Import data to calculate diagnostics.'}</p>}
  </section>;
}
