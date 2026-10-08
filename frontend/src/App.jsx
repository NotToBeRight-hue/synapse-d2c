import React, { useCallback, useEffect, useRef, useState } from 'react';
import './dashboard.css';
import synapseLogo from './assets/sys.png';
import { api, validateSnapshot, validateSimulation, validateHistory, validateBrands, validateSession } from './api';
import { amount, horizon } from './format';
import { resolveOperator, initialTheme } from './dashboard-utils';
import RevenueProfitView from './components/RevenueProfitView';
import BudgetAllocationPanel from './components/BudgetAllocationPanel';
import SourcePanel from './components/SourcePanel';
import History from './components/History';
import InventoryEditor from './components/InventoryEditor';
import Diagnostics from './components/Diagnostics';

export function Workspace({ session, onLogout, onRefresh, onSessionVerified, theme, onThemeChange }) {
  const [snapshot, setSnapshot] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [operatorInput, setOperatorInput] = useState(session.operator || String(session.brand.id));
  const [operatorVerified, setOperatorVerified] = useState(true);
  
  // View mode toggle & modal popup state
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
    const responses = await Promise.allSettled([
      api('/sync/latest', { session, signal }).then(validateSnapshot),
      api('/simulate/history', { session, signal }).then(validateHistory),
    ]);
    if (signal.aborted || !alive.current || version !== requestVersion.current) return;
    const [source, audit] = responses;
    if (source.status === 'fulfilled') {
      setSnapshot(source.value);
      if (currentSnapshot.current !== source.value.snapshot_id) {
        setSimulation(null); currentSnapshot.current = source.value.snapshot_id;
      }
    } else if (source.reason.status !== 404) handleError(source.reason);
    if (audit.status === 'fulfilled') setHistory(audit.value); else handleError(audit.reason);
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
      const updatedHistory = validateHistory(await api('/simulate/history', { session }));
      if (alive.current) setHistory(updatedHistory);
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
  const protectedCount = new Set(rows.filter(row => horizon(row) !== null && horizon(row) < 14).map(row => row.sku)).size;
  
  return <div className="shell"><aside className="sidebar"><button type="button" className="wordmark" onClick={onRefresh} disabled={busy} aria-label="Refresh dashboard" title="Refresh dashboard">SYNAPSE<span aria-hidden="true">&nbsp;</span></button>
    <div className="workspace-label">WORKSPACE</div><strong className="brand-name">{session.brand.name}</strong>
    <nav><a href="#overview">Overview</a><a href="#revenue">SKU performance</a><a href="#allocation">Budget allocation</a><a href="#diagnostics">Diagnostics</a><a href="#history">Decision audit</a></nav>
  </aside><main className="main"><header className="topbar"><div><span className="eyebrow">DATAQUEST 3.0</span><span className="header-context">Advertising decision cockpit</span></div><div className="header-controls">
    <form className="operator-control" onSubmit={verifyOperator}>
      <label htmlFor="header-operator">Operator / workspace ID</label><input id="header-operator" type="text" value={operatorInput}
        onChange={event => { setOperatorInput(event.target.value); setOperatorVerified(false); }} maxLength={100} autoComplete="off" spellCheck={false} disabled={busy} required
        title="Enter this workspace's provisioned ID or profile name. Sign in again to change workspace access." />
      <button className="button" disabled={busy || !operatorInput.trim()}>Verify</button>
      <span className={'operator-confirmation ' + (operatorVerified ? 'healthy' : 'muted')} role="status">{operatorVerified ? 'Workspace verified' : 'Edit pending verification'}</span>
    </form><span className="limit-indicator">AI limit: {session.ai_limit_per_day}/day</span><ThemeToggle theme={theme} onChange={onThemeChange} /></div></header>
    <div className="content" id="overview"><div className="page-heading"><div><span className="eyebrow">BRAND / {session.brand.name}</span><h1>Contribution & allocation</h1>
      <p className="muted">SKU economics, inventory constraints and SciPy recommendations.</p></div><SourcePanel busy={busy} onSync={sync} onError={setError} /></div>
      {error && <div className="notice error" role="alert">{error}</div>}
      <div className="snapshot-line"><span className="label">{snapshot ? snapshot.data_mode === 'mock' ? 'MOCK DATA' : 'UPLOADED SNAPSHOT' : 'NO DATA'}</span>
        <span className="muted">{snapshot ? 'Snapshot #' + snapshot.snapshot_id + ' / checked every 30 seconds' : loaded ? 'Import your source data to begin.' : 'Loading workspace...'}</span></div>
      <section className="stats-grid" aria-label="Current snapshot metrics">{[
        ['Attributed revenue', revenue], ['Ad spend', spend], ['Net contribution', profit], ['Protected SKUs', protectedCount],
      ].map(([label, value]) => <article className="stat-card" key={label}><span>{label}</span><strong>{snapshot ? amount(value) : 'No data'}</strong>
        <small>{label === 'Protected SKUs' ? 'Missing inventory or below 14 days' : 'Current source snapshot'}</small></article>)}</section>
      {protectedCount > 0 && <p className="notice warning" role="status">{protectedCount} SKU(s) have missing inventory or stock cover below 14 days. Their optimized allocation is fixed at zero.</p>}
      <InventoryEditor key={'inventory-' + (snapshot?.snapshot_id || 'empty')} snapshot={snapshot} busy={busy}
        onSave={payload => sync(payload, '/sync/inventory', 'PATCH')} onError={setError} />
      
      {/* View Mode Toggle Controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <div style={{ display: 'inline-flex', background: 'var(--panel-bg, #1e293b)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border-color, #334155)' }}>
          <button 
            type="button" 
            onClick={() => setViewMode('cards')}
            style={{ padding: '6px 14px', background: viewMode === 'cards' ? 'var(--accent-bg, #0f172a)' : 'transparent', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            Card View
          </button>
          <button 
            type="button" 
            onClick={() => setViewMode('charts')}
            style={{ padding: '6px 14px', background: viewMode === 'charts' ? 'var(--accent-bg, #0f172a)' : 'transparent', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            Comparative Performance View
          </button>
        </div>
      </div>

      {viewMode === 'charts' ? (
        <section id="revenue" style={{ marginBottom: '24px' }}>
          <h2>SKU Comparative Efficiency Grid</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {rows.map((item, idx) => {
              const maxVal = Math.max(...rows.map(r => Math.max(r.revenue, r.spend * 5)), 1);
              const revWidth = Math.min(Math.max((item.revenue / maxVal) * 100, 5), 100);
              const spendWidth = Math.min(Math.max(((item.spend * 5) / maxVal) * 100, 5), 100);
              const roas = item.spend > 0 ? (item.revenue / item.spend).toFixed(2) : '0.00';

              return (
                <div 
                  key={idx} 
                  onClick={() => setActiveModalItem(item)}
                  style={{ 
                    background: 'var(--panel-bg, #0f172a)', 
                    border: '1px solid var(--border-color, #334155)', 
                    borderRadius: '6px', 
                    padding: '18px', 
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main, #f8fafc)' }}>{item.sku}</span>
                    <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px' }}>
                      ROAS: {roas}×
                    </span>
                  </div>

                  {/* Proportional Comparative Bar Graphs (Spend vs Revenue) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px', fontSize: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: '3px' }}>
                        <span>Revenue</span>
                        <span style={{ color: '#f8fafc', fontWeight: 500 }}>{amount(item.revenue)}</span>
                      </div>
                      <div style={{ width: '100%', background: '#1e293b', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${revWidth}%`, background: '#38bdf8', height: '100%', borderRadius: '3px' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: '3px' }}>
                        <span>Ad Spend</span>
                        <span style={{ color: '#f8fafc', fontWeight: 500 }}>{amount(item.spend)}</span>
                      </div>
                      <div style={{ width: '100%', background: '#1e293b', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${spendWidth}%`, background: '#f43f5e', height: '100%', borderRadius: '3px' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: '10px', fontSize: '12px', color: '#94a3b8' }}>
                    <span>Margin: <strong style={{ color: '#f8fafc' }}>{Math.round(item.margin * 100)}%</strong></span>
                    <span style={{ color: '#38bdf8' }}>Click for Inspector →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <RevenueProfitView campaigns={rows} />
      )}

      <BudgetAllocationPanel key={snapshot?.snapshot_id || 'empty'} snapshot={snapshot} simulation={simulation} busy={busy} onRun={run} limits={session} />
      <Diagnostics snapshot={snapshot} />
      <History rows={history} />
      <footer>Projections are modeled estimates. No ad-platform budgets are changed automatically.</footer>
    </div></main>

    {/* Floating Modal Popup for Clicked SKU Details */}
    {activeModalItem && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', padding: '24px', borderRadius: '6px', width: '420px', color: '#f8fafc' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>Channel Inspector: {activeModalItem.sku}</h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>Detailed financial breakdown and metrics snapshot.</p>
          
          <div style={{ background: '#1e293b', padding: '12px', borderRadius: '4px', fontSize: '13px', marginBottom: '16px' }}>
            <p style={{ margin: '6px 0', display: 'flex', justifyContent: 'space-between' }}><span>Revenue:</span> <strong>{amount(activeModalItem.revenue)}</strong></p>
            <p style={{ margin: '6px 0', display: 'flex', justifyContent: 'space-between' }}><span>Ad Spend:</span> <strong>{amount(activeModalItem.spend)}</strong></p>
            <p style={{ margin: '6px 0', display: 'flex', justifyContent: 'space-between' }}><span>Contribution Margin:</span> <strong>{Math.round(activeModalItem.margin * 100)}%</strong></p>
            <p style={{ margin: '6px 0', display: 'flex', justifyContent: 'space-between' }}><span>Stock Cover Horizon:</span> <strong>{horizon(activeModalItem) !== null ? `${horizon(activeModalItem)} days` : 'Not supplied'}</strong></p>
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
    <span className="eyebrow">SYNAPSE / DATAQUEST 3.0</span><h1>Operator access</h1>
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
    <p className="portal-security">Brand-scoped authentication. Credentials remain in memory for this session.</p>
  </form></div></main>;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [theme, setTheme] = useState(initialTheme);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const logout = useCallback(() => setSession(null), []);
  const refreshWorkspace = useCallback(() => setWorkspaceRevision(value => value + 1), []);
  const toggleTheme = useCallback(() => setTheme(value => value === 'dark' ? 'light' : 'dark'), []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('synapse-theme', theme); } catch { /* Storage can be unavailable. */ }
  }, [theme]);
  return <div className="app-root" data-theme={theme}>
    {session ? <Workspace key={workspaceRevision} session={session} onLogout={logout} onRefresh={refreshWorkspace}
      onSessionVerified={setSession} theme={theme} onThemeChange={toggleTheme} /> : <><header className="login-header"><span>SYNAPSE</span>
      <ThemeToggle theme={theme} onChange={toggleTheme}/></header><OperatorLogin onLogin={setSession}/></>}
    {session ? <button type="button" className="logo-dock" onClick={logout} aria-label="Sign out" title="Sign out"><img src={synapseLogo} alt="Synapse" /></button>
      : <aside className="logo-dock" aria-label="Synapse brand"><img src={synapseLogo} alt="Synapse" /></aside>}
  </div>;
}