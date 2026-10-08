import React from 'react';
import { snapshotDiagnostics } from '../dashboard-utils';
import { amount } from '../format';

export default function Diagnostics({ snapshot = null }) {
  const rows = snapshotDiagnostics(snapshot?.campaigns || []);
  return <section className="panel diagnostics-panel" id="diagnostics">
    <div className="section-heading"><div><span className="eyebrow">SOURCE DIAGNOSTICS</span><h2>Inventory & contribution checks</h2></div>
      <span className="muted">{snapshot ? `${rows.length} findings / snapshot #${snapshot.snapshot_id}` : 'No snapshot loaded'}</span></div>
    <p className="fine-print">Z-score tags compare SKU contribution within this snapshot. They are not historical anomaly alerts.</p>
    {rows.length ? <ul className="diagnostics-list">{rows.map(row => <li key={row.sku + ':' + row.code}>
      <span className={`diagnostic-tag ${row.severity}`}>{row.code === 'contribution-outlier' ? `Z ${row.z >= 0 ? '+' : ''}${amount(row.z)}`
        : row.code === 'missing-inventory' ? 'Inventory missing' : `${amount(row.days)} days`}</span>
      <div><strong>{row.sku}</strong><p>{row.text}</p></div>
    </li>)}</ul> : <p className="empty-state">{snapshot ? 'No inventory buffer violations or contribution cohort outliers found.' : 'Import a snapshot to calculate diagnostics.'}</p>}
  </section>;
}
