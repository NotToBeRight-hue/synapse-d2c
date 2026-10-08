import React, {useEffect, useState} from 'react';
import {api, validateHistory} from '../api';
import {ThemeToggle} from '../App';
import History from './History';
import SidebarFooter from './SidebarFooter';

export function DecisionResults({rows = [], error = '', loaded = false}) {
  return <>{error && <p className="notice error" role="alert">{error}</p>}
    {!loaded ? <p role="status">Loading recorded simulations...</p> : <History rows={rows} />}</>;
}
export default function DecisionWorkspace({session, onLogout, theme, onThemeChange}) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    async function refresh() {
      if (fetching || controller.signal.aborted) return;
      fetching = true; setBusy(true);
      try {
        const history = validateHistory(await api('/simulate/history', {session, signal: controller.signal}));
        if (!controller.signal.aborted) {setRows(history); setError(''); setLoaded(true);}
      } catch (e) {
        if (!controller.signal.aborted) {
          if (e.status === 401) onLogout();
          else setError(e.message);
          setLoaded(true);
        }
      } finally {fetching = false; if (!controller.signal.aborted) setBusy(false);}
    }
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {controller.abort(); clearInterval(timer);};
  }, [session, onLogout, refreshKey]);
  return <div className="shell"><aside className="sidebar">
    <a className="wordmark" href="/index.html">SYNAPSE</a>
    <div className="workspace-label">WORKSPACE</div><strong className="brand-name">{session.brand.name}</strong>
    <nav><a href="/index.html#overview">Overview</a><a href="/index.html#revenue">SKU Performance</a><a href="/index.html#allocation">Budget Allocation</a><a href="/index.html#diagnostics">Diagnostics</a><a href="/index.html#monthly">Month Comparison</a><a href="/decision.html" aria-current="page">Decision Audit</a></nav><SidebarFooter />
  </aside><main className="main"><header className="topbar"><span className="header-context">{session.operator || session.brand.name}</span><ThemeToggle theme={theme} onChange={onThemeChange} /></header>
    <div className="content audit-page" id="audit"><div className="page-heading"><div><span className="eyebrow">{session.brand.name}</span><h1>Decision audit</h1></div>
      <button type="button" className="button" disabled={busy} onClick={() => setRefreshKey(value => value + 1)}>{busy ? 'Refreshing...' : 'Refresh history'}</button></div>
      <DecisionResults rows={rows} error={error} loaded={loaded} />
      <a className="button" href="/index.html" onClick={event => {
        try {
          if (window.opener && !window.opener.closed && window.opener.location.origin === window.location.origin) {
            event.preventDefault(); window.opener.focus(); window.close();
          }
        } catch { /* Directly opened pages use the normal dashboard link. */ }
      }}>Back to dashboard</a>
    </div></main></div>;
}

