import React, { useEffect, useRef, useState } from 'react';
import { api, validateMonths, validateComparison } from '../api';
import { money, amount, percent, stockDays } from '../format';
import { toIngestionPayload } from '../source-import';

const metrics = [['revenue', 'Attributed revenue'], ['spend', 'Ad spend'], ['contribution', 'Net contribution'], ['margin', 'Contribution margin'], ['roas', 'ROAS']];
const display = (key, value) => value == null ? 'Not defined' : key === 'margin' ? percent(value * 100) : key === 'roas' ? amount(value) + '×' : money(value);
export function MonthResults({ result }) {
  const first = new Map(result.month1.products.map(row => [row.sku, row]));
  const second = new Map(result.month2.products.map(row => [row.sku, row]));
  const skus = [...new Set([...first.keys(), ...second.keys()])].sort();
  return <>
    <div className="month-column-labels"><span>Metric</span><b>Month 1 · {result.month1.reporting_month}</b><b>Month 2 · {result.month2.reporting_month}</b><span>Change: Month 2 − Month 1</span></div>
    {metrics.map(([key, label]) => {
      const before = result.month1.totals[key], after = result.month2.totals[key];
      const maximum = Math.max(Math.abs(before || 0), Math.abs(after || 0), 1);
      const change = result.changes[key];
      return <div className="month-metric-row" key={key}><span>{label}</span>
        {[before, after].map((value, i) => <div className="month-value" key={i}><strong>{display(key, value)}</strong>
          {['revenue', 'spend', 'contribution'].includes(key) && <div className="bar-track"><i className={i === 0 ? 'month-before' : 'month-after'} style={{width: `${Math.abs(value || 0) / maximum * 100}%`}}/></div>}</div>)}
        <div className="month-change">{change ? <><b>{change.absolute > 0 ? '+' : ''}{key === 'margin' ? amount(change.absolute * 100) + ' pp' : display(key, change.absolute)}</b>
          <small>{change.percent === null ? 'Zero baseline: percentage undefined' : percent(change.percent)}</small></> : 'Not defined'}</div></div>;
    })}
    <p className="fine-print">Margin changes use percentage points (pp). Percentage change uses the absolute Month 1 baseline. Bars show magnitude; signed numbers show losses.</p>
    <div className="month-report-meta">{[result.month1, result.month2].map((month, i) => <span key={i}>Month {i + 1}: {month.data_mode.toUpperCase()} · Report #{month.report_id}</span>)}</div>
    <h3 className="month-products-title">SKU comparison</h3>
    <div className="month-product-grid">{skus.map(sku => <article className="month-product-card" key={sku}><h3>{sku}</h3>
      <div className="month-product-pair">{[first.get(sku), second.get(sku)].map((row, i) => <div key={i}><b>Month {i + 1}</b>
        {row ? <><span>Revenue <strong>{money(row.revenue)}</strong></span><span>Spend <strong>{money(row.spend)}</strong></span><span>Contribution <strong>{money(row.contribution)}</strong></span>
          <span>Margin <strong>{display('margin', row.margin)}</strong></span><span>ROAS <strong>{display('roas', row.roas)}</strong></span>
          <span>Stock cover <strong>{row.inventory_data_missing ? 'Not supplied' : row.stock_days === null ? 'No recent velocity' : stockDays(row.stock_days)}</strong></span></>
          : <p className="muted">Not reported this month</p>}</div>)}</div>
      {first.has(sku) && second.has(sku) && <p className="fine-print">Contribution change: {money(second.get(sku).contribution - first.get(sku).contribution)}</p>}
    </article>)}</div>
  </>;
}

export default function MonthComparison({ session = null, disabled = false, onAuthError = () => {} }) {
  const [months, setMonths] = useState([]), [month1, setMonth1] = useState(''), [month2, setMonth2] = useState('');
  const [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const inputs = [useRef(null), useRef(null)];
  const alive = useRef(true), inFlight = useRef(false), controller = useRef(null);
  const validMonth = value => /^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/.test(value);
  function failure(e) { if (!alive.current) return; if (e.status === 401) onAuthError(e); else setError(e.message); }
  async function loadMonths(signal) {
    const rows = validateMonths(await api('/sync/months', { session, signal }));
    if (!alive.current || signal.aborted) return;
    setMonths(rows);
    setMonth1(value => value || rows[1]?.reporting_month || rows[0]?.reporting_month || '');
    setMonth2(value => value || rows[0]?.reporting_month || '');
  }
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    if (session) loadMonths(abort.signal).catch(e => { if (!abort.signal.aborted) failure(e); });
    return () => { alive.current = false; abort.abort(); controller.current?.abort(); };
  }, [session]);
  async function perform(task) {
    if (inFlight.current || !session) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice(''); setResult(null);
    controller.current = new AbortController();
    try { await task(controller.current.signal); } catch (e) { failure(e); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  async function upload(event, month) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !validMonth(month)) return;
    await perform(async signal => {
      if (file.size > 4 * 1024 * 1024) throw new Error('Choose a JSON report smaller than 4 MB.');
      let payload;
      try { payload = JSON.parse(await file.text()); } catch { throw new Error('The selected report is not valid JSON.'); }

      payload = toIngestionPayload(payload, {reportingMonth: month});
      validateMonths([await api('/sync/monthly', { session, signal, method: 'POST', body: payload })]);
      await loadMonths(signal);
      if (alive.current && !signal.aborted) setNotice(`Saved complete report for ${month}. Your daily optimization data is unchanged.`);
    });
  }
  async function compare(event) {
    event.preventDefault();
    await perform(async signal => {
      const value = validateComparison(await api(`/sync/compare?month1=${encodeURIComponent(month1)}&month2=${encodeURIComponent(month2)}`, {session, signal}));
      if (value.month1.reporting_month !== month1 || value.month2.reporting_month !== month2) throw new Error('The server returned different reporting months. Retry comparison.');
      if (alive.current && !signal.aborted) setResult(value);
    });
  }
  const locked = busy || disabled;
  return <section className="panel month-comparison" id="monthly">
    <div className="section-heading"><h2 className="eyebrow section-title">Month Comparison</h2></div>
    <form onSubmit={compare}><div className="month-select-pair">{[month1, month2].map((month, i) => <div className="month-selector" key={i}>
      <label>Month {i + 1}<input type="month" min="1000-01" max="9999-12" value={month} required disabled={locked}
        onChange={e => { (i === 0 ? setMonth1 : setMonth2)(e.target.value); setResult(null); setNotice(''); }}/></label>
      <input type="file" ref={inputs[i]} accept=".json,application/json" hidden onChange={e => upload(e, month)}/>
      <button type="button" className="button" disabled={locked || !session || !validMonth(month)} onClick={() => inputs[i].current?.click()}>Import Month {i + 1} JSON</button>
      <small className="muted">{months.some(row => row.reporting_month === month) ? 'Report available' : 'No report imported for this month'}</small>
    </div>)}</div><button className="button primary" disabled={locked || !session || !validMonth(month1) || !validMonth(month2) || month1 === month2}>{busy ? 'Loading...' : 'Compare months'}</button></form>
    {error && <p className="notice error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    {result ? <MonthResults result={result}/> : <p className="muted month-empty">Note: Select two different months and compare their stored reports.</p>}
  </section>;
}

