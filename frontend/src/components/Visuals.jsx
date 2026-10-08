import React from 'react';
import { amount } from '../format';

export function ShieldIcon({ className = '' }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" stroke="currentColor" strokeWidth="1.5"/><path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.5"/></svg>;
}

export function LiftGauge({ multiple = null, pending = false }) {
  const available = Number.isFinite(multiple);
  const progress = available ? Math.max(0, Math.min(1, multiple / 3)) : 0;
  return <div className={'lift-gauge' + (available && multiple > 1 ? ' lift-positive' : '')}>
    <svg viewBox="0 0 260 160" role="img" aria-label={available ? `Projected profit multiple ${amount(multiple)} times. Gauge scale zero to three times.` : 'Profit multiple not available'}>
      <path d="M26 130a104 104 0 0 1 208 0" fill="none" stroke="var(--line)" strokeWidth="9"/>
      <path className="gauge-value" d="M26 130a104 104 0 0 1 208 0" pathLength="100" fill="none" stroke="var(--accent)" strokeWidth="9" strokeDasharray={`${progress * 100} 100`}/>
      <text x="130" y="109" textAnchor="middle" className="gauge-number">{available ? amount(multiple) + '×' : 'N/A'}</text>
      <text x="130" y="135" textAnchor="middle" className="gauge-caption">{pending ? 'RUN A SIMULATION' : available ? 'PROJECTED PROFIT MULTIPLE' : 'BASELINE NOT POSITIVE'}</text>
      <text x="23" y="155" className="gauge-tick">0×</text><text x="221" y="155" className="gauge-tick">3×+</text>
    </svg>
  </div>;
}

