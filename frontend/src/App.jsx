import React, { useCallback, useEffect, useRef, useState } from 'react';
import './dashboard.css';
import synapseLogo from './assets/sys.png';
import { api, validateSnapshot, validateSimulation, validateBrands, validateSession } from './api';
import { amount, horizon, stockDays } from './format';
import { resolveOperator, initialTheme } from './dashboard-utils';
import RevenueProfitView from './components/RevenueProfitView';
import BudgetAllocationPanel from './components/BudgetAllocationPanel';
import SourcePanel from './components/SourcePanel';
import InventoryEditor from './components/InventoryEditor';
import Diagnostics from './components/Diagnostics';
import MonthComparison from './components/MonthComparison';
import SkuCharts from './components/SkuCharts';
import SkuExport from './components/SkuExport';
import SidebarFooter from './components/SidebarFooter';

export function Workspace({ session, onLogout, onRefresh, onSessionVerified, theme, onThemeChange, onOpenAudit }) {
  const [snapshot, setSnapshot] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [operatorInput, setOperatorInput] = useState(session.operator || String(session.brand.id));
  const [operatorVerified, setOperatorVerified] = useState(true);
  
  // View mode, Metric Tab, and Horizon state
  const [viewMode, setViewMode] = useState("cards"); // "cards" or "charts"
  const [activeModalItem, setActiveModalItem] = useState(null);

  const currentSnapshot = useRef(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const requestVersion = useRef(0);
  const handleError = useCallback(e => {
    if (!alive.current) return;
    if (e.status === 401) onLogout();
    else setError(e.message);
  }, [onLogout]);

  const refresh = useCallback(async signal => {
    const version = requestVersion.current;
    try {
      const source = validateSnapshot(await api('/sync/latest', { session, signal }));
      if (signal.aborted || !alive.current || version !== requestVersion.current) return;
      setSnapshot(source);
      if (currentSnapshot.current !== source.snapshot_id) {
        setSimulation(null); currentSnapshot.current = source.snapshot_id;
      }
    } catch (e) {
      if (signal.aborted || !alive.current || version !== requestVersion.current) return;
      if (e.status !== 404) handleError(e);
    }
    setLoaded(true);
  }, [session, handleError]);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    let refreshing = false;
    const update = async () => {
      if (inFlight.current || refreshing) return;
      refreshing = true;
      try { await refresh(controller.signal); } finally { refreshing = false; }
    };
    update();
    const timer = setInterval(update, 30000);
    return () => { alive.current = false; controller.abort(); clearInterval(timer); };
  }, [refresh]);

  async function sync(payload, path = '/sync', method = 'POST') {
    if (inFlight.current) return;
    requestVersion.current += 1;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const data = validateSnapshot(await api(path, { session, method, body: payload }));
      if (alive.current) { currentSnapshot.current = data.snapshot_id; setSnapshot(data); setSimulation(null); }
    } catch (e) { handleError(e); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  async function run(body) {
    if (inFlight.current || !snapshot) return;
    requestVersion.current += 1;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = validateSimulation(await api('/simulate', {
        session, method: 'POST', body: { ...body, snapshot_id: snapshot.snapshot_id },
      }), snapshot.snapshot_id);
      if (!alive.current) return;
      setSimulation(result);
    } catch (e) { handleError(e); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  async function verifyOperator(event) {
    event.preventDefault();
    if (inFlight.current || !operatorInput.trim()) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      resolveOperator(operatorInput, [session.brand]);
      const profile = validateSession(await api('/auth/me', { session }));
      if (profile.brand.id !== session.brand.id) throw new Error('Workspace verification failed. Sign in again.');
      if (alive.current) {
        setOperatorVerified(true);
        onSessionVerified({ ...profile, token: session.token, operator: operatorInput.trim() });
      }
    } catch (e) { handleError(e); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  const rows = snapshot?.campaigns || [];
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const profit = rows.reduce((sum, row) => sum + row.revenue * row.margin - row.spend, 0);
  const protectedCount = new Set(rows.filter(row => row.inventory_data_missing || horizon(row) !== null && horizon(row) < 14).map(row => row.sku)).size;
  
  return <div className="shell"><aside className="sidebar"><button type="button" className="wordmark" onClick={onRefresh} disabled={busy} aria-label="Refresh dashboard" title="Refresh dashboard">SYNAPSE<span aria-hidden="true">&nbsp;</span></button>
    <div className="workspace-label">WORKSPACE</div><strong className="brand-name">{session.brand.name}</strong>
    <nav><a href="#overview">Overview</a><a href="#revenue">SKU Performance</a><a href="#allocation">Budget Allocation</a><a href="#diagnostics">Diagnostics</a><a href="#monthly">Month Comparison</a><a href="/decision.html" onClick={onOpenAudit}>Decision Audit</a></nav><SidebarFooter />
  </aside><main className="main"><header className="topbar"><div><span className="header-context">Advertising Decision Cockpit</span></div><div className="header-controls">
    <form className="operator-control" onSubmit={verifyOperator}>
      <label htmlFor="header-operator">Operator / workspace ID</label><input id="header-operator" type="text" value={operatorInput}
        onChange={event => { setOperatorInput(event.target.value); setOperatorVerified(false); }} maxLength={100} autoComplete="off" spellCheck={false} disabled={busy} required
        title="Enter this workspace's provisioned ID or profile name. Sign in again to change workspace access." />
      <button className="button" disabled={busy || !operatorInput.trim()}>Verify</button>
      <span className={'operator-confirmation ' + (operatorVerified ? 'healthy' : 'muted')} role="status">{operatorVerified ? 'Workspace verified' : 'Edit pending verification'}</span>
    </form><ThemeToggle theme={theme} onChange={onThemeChange} /></div></header>
    <div className="content" id="overview"><div className="page-heading"><div><h1>Contribution & allocation</h1>
      </div><SourcePanel busy={busy} onSync={sync} onError={setError} /></div>
      {error && <div className="notice error" role="alert">{error}</div>}
      <div className="snapshot-line"><span className="label">{snapshot ? snapshot.data_mode === 'mock' ? 'MOCK DATA' : 'UPLOADED DATA' : 'NO DATA'}</span>
        <span className="muted">{snapshot ? 'Source data loaded' : loaded ? 'Import your source data to begin.' : 'Loading workspace...'}</span></div>
      <section className="stats-grid" aria-label="Current source metrics">{[
        ['Attributed revenue', revenue], ['Ad spend', spend], ['Net contribution', profit], ['Protected SKUs', protectedCount],
      ].map(([label, value]) => <article className="stat-card" key={label}><span>{label}</span><strong>{snapshot ? amount(value) : 'No data'}</strong>
        <small>{label === 'Protected SKUs' ? 'Missing inventory or below 14 days' : 'Imported data'}</small></article>)}</section>
      <InventoryEditor key={'inventory-' + (snapshot?.snapshot_id || 'empty')} snapshot={snapshot} busy={busy}
        onSave={payload => sync(payload, '/sync/inventory', 'PATCH')} onError={setError} />
      {protectedCount > 0 && <p className="notice warning" role="status">{protectedCount} SKU(s) have missing inventory or stock cover below 14 days. Their optimized allocation is fixed at zero.</p>}
      
      <div className="chart-controls view-controls" aria-label="SKU view">
        <button type="button" className="button" aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}>Card view</button>
        <button type="button" className="button" aria-pressed={viewMode === 'charts'} onClick={() => setViewMode('charts')}>Chart view</button>
      </div>
      {viewMode === 'charts' ? <SkuCharts campaigns={rows} snapshot={snapshot} onInspect={setActiveModalItem} />
        : <RevenueProfitView campaigns={rows} snapshot={snapshot} />}

      <SkuExport campaigns={rows} snapshot={snapshot} />
      <BudgetAllocationPanel key={snapshot?.snapshot_id || 'empty'} snapshot={snapshot} simulation={simulation} busy={busy} onRun={run} limits={session} />
      <Diagnostics snapshot={snapshot} />
      <MonthComparison session={session} disabled={busy} onAuthError={handleError} />

    </div>
    </main>

    {/* Floating Modal Inspector */}
    {activeModalItem && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', padding: '24px', borderRadius: '6px', width: '420px', color: '#f8fafc' }}>
          <h3 style={{ margin: '0 0 4px 0', color: '#f8fafc' }}>Product inspector: {activeModalItem.sku}</h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>Detailed financial breakdown from imported data.</p>
          
          <div style={{ background: '#1e293b', padding: '16px', borderRadius: '4px', fontSize: '13px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Revenue:</span> <strong>{amount(activeModalItem.revenue)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Ad Spend:</span> <strong>{amount(activeModalItem.spend)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Contribution Margin:</span> <strong>{Math.round(activeModalItem.margin * 100)}%</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Stock Cover Horizon:</span> <strong>{horizon(activeModalItem) !== null ? stockDays(horizon(activeModalItem)) : activeModalItem.inventory_data_missing ? 'Not supplied' : 'No recent velocity'}</strong></div>
          </div>

          <button 
            type="button"
            onClick={() => setActiveModalItem(null)}
            style={{ width: '100%', padding: '10px', background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
          >
            Close Inspector
          </button>
        </div>
      </div>
    )}
  </div>;
}

export function ThemeToggle({ theme = 'dark', onChange = () => {} }) {
  return <button type="button" className="theme-toggle" role="switch" aria-label="Dark mode"
    aria-checked={theme === 'dark'} onClick={onChange}>
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="6" stroke="currentColor"/><path d="M10 4v12a6 6 0 0 0 0-12Z" fill="currentColor"/></svg>
    {theme === 'dark' ? 'Dark' : 'Light'}
  </button>;
}

export function OperatorLogin({ onLogin = () => {} }) {
  const [brands, setBrands] = useState([]);
  const [operator, setOperator] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    api('/auth/brands', { signal: controller.signal }).then(validateBrands).then(rows => {
      if (!controller.signal.aborted) setBrands(rows);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current || loading) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const brand = resolveOperator(operator, brands);
      const profile = validateSession(await api('/auth/me', { session: { brand, token } }));
      if (profile.brand.id !== brand.id) throw new Error('The server returned a different workspace. Retry sign-in.');
      onLogin({ ...profile, operator: operator.trim(), token });
      setToken('');
    } catch (e) { setError(e.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <main className="login-page"><div className="login-layout"><form className="panel login-form" onSubmit={submit}>
    <span className="eyebrow">SYNAPSE</span><h1>Operator access</h1>
    <p className="muted">Authenticate with your provisioned workspace ID or name and API token.</p>
    <label>Operator / workspace ID<input type="text" name="operator" value={operator} onChange={e => setOperator(e.target.value)}
      autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={100} disabled={loading || busy} required
      aria-describedby="operator-help" /></label>
    <small id="operator-help" className="muted">Enter the brand ID or profile name assigned to your workspace.</small>
    <label>API token<input type="password" name="token" value={token} onChange={e => setToken(e.target.value)}
      autoComplete="off" maxLength={512} disabled={busy} required /></label>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button primary" disabled={loading || busy || !operator.trim() || !token.trim()}>
      {loading ? 'Loading workspaces...' : busy ? 'Verifying access...' : 'Sign in'}
    </button>
    {!loading && !brands.length && <p className="muted">No workspaces provisioned. Create a brand using the README instructions.</p>}

  </form></div></main>;
}

export default function App({ WorkspaceView = Workspace, decisionPage = false }) {
  const [session, setSession] = useState(null);
  const [theme, setTheme] = useState(initialTheme);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const auditWindows = useRef(new Set());
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const authGeneration = useRef(0);
  const logout = useCallback(() => {
    authGeneration.current += 1;
    setSession(null);
    for (const child of auditWindows.current) if (!child.closed) child.postMessage({type: 'synapse:signout'}, window.location.origin);
    auditWindows.current.clear();
    if (decisionPage && window.opener) window.opener.postMessage({type: 'synapse:audit-signout'}, window.location.origin);
  }, [decisionPage]);
  function openAudit(event) {
    const child = window.open('/decision.html', '_blank');
    if (child) { auditWindows.current.add(child); event.preventDefault(); }
  }
  useEffect(() => {
    const controller = new AbortController();
    const origin = window.location.origin;
    async function receive(event) {
      if (event.origin !== origin) return;
      if (!decisionPage) {
        if (!auditWindows.current.has(event.source)) return;
        if (event.data?.type === 'synapse:audit-ready' && sessionRef.current) {
          event.source.postMessage({type: 'synapse:audit-session', session: sessionRef.current}, origin);
        } else if (event.data?.type === 'synapse:audit-signout') logout();
      } else if (event.source === window.opener) {
        if (event.data?.type === 'synapse:signout') { authGeneration.current += 1; setSession(null); return; }
        if (event.data?.type !== 'synapse:audit-session') return;
        const candidate = event.data.session;
        const generation = ++authGeneration.current;
        try {
          if (!candidate || typeof candidate.token !== 'string') return;
          validateSession(candidate);
          const profile = validateSession(await api('/auth/me', {session: candidate, signal: controller.signal}));
          if (!controller.signal.aborted && generation === authGeneration.current && profile.brand.id === candidate.brand.id) setSession({...profile, token: candidate.token, operator: candidate.operator});
        } catch { /* Manual sign-in stays available if session verification fails. */ }
      }
    }
    window.addEventListener('message', receive);
    if (decisionPage && window.opener) window.opener.postMessage({type: 'synapse:audit-ready'}, origin);
    return () => { controller.abort(); window.removeEventListener('message', receive); };
  }, [decisionPage, logout]);
  const refreshWorkspace = useCallback(() => setWorkspaceRevision(value => value + 1), []);
  const toggleTheme = useCallback(() => setTheme(value => value === 'dark' ? 'light' : 'dark'), []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('synapse-theme', theme); } catch { /* Storage can be unavailable. */ }
  }, [theme]);
  return <div className="app-root" data-theme={theme}>
    {session ? <WorkspaceView key={workspaceRevision} session={session} onLogout={logout} onRefresh={refreshWorkspace}
      onSessionVerified={setSession} onOpenAudit={openAudit} theme={theme} onThemeChange={toggleTheme} /> : <><header className="login-header"><span>SYNAPSE</span>
      <ThemeToggle theme={theme} onChange={toggleTheme}/></header><OperatorLogin onLogin={setSession}/></>}
    {session ? <button type="button" className="logo-dock" onClick={logout} aria-label="Sign out" title="Sign out"><img src={synapseLogo} alt="Synapse" /></button>
      : <aside className="logo-dock" aria-label="Synapse brand"><img src={synapseLogo} alt="Synapse" /></aside>}
  </div>;
}

