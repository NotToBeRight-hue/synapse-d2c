import React, {useEffect, useState} from 'react';

import '../dashboard.css';
import {initialTheme} from '../dashboard-utils';
import SidebarFooter from './SidebarFooter';
import logo from '../assets/sys.png';

export function InformationPage({page = 'terms'}) {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {localStorage.setItem('synapse-theme', theme);} catch { /* Theme still works. */ }
  }, [theme]);
  const terms = page === 'terms';
  return <div className="app-root" data-theme={theme}><div className="shell"><aside className="sidebar">
    <a className="wordmark" href="/index.html"><img src={logo} alt="Synapse" /></a>
    <nav><a href="/index.html">Overview</a><a href="/terms.html" aria-current={terms ? 'page' : undefined}>Terms &amp; Conditions</a><a href="/establishment.html" aria-current={!terms ? 'page' : undefined}>Establishment</a></nav><SidebarFooter />
    </aside><main className="main"><header className="topbar"><a className="button" href="/index.html">Back to dashboard</a><button type="button" className="theme-toggle" role="switch" aria-label="Dark mode" aria-checked={theme === 'dark'} onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Dark' : 'Light'}</button></header>
      <div className="content information-page"><section className="panel"><h1>{terms ? 'Terms & Conditions' : 'Establishment'}</h1>
      {terms ? <>
        <h2>Workspace access</h2><p>Use the workspace ID and API token provisioned for your brand. Keep credentials private and import only data you are authorized to use.</p>
        <h2>Data and recommendations</h2><p>Financial reports depend on the revenue, spend and margin supplied. Inventory safeguards depend on stock units and daily sales velocity. Review imported values and recommendations before making operational decisions.</p>
        <h2>Simulations and execution</h2><p>Optimization results are projections. A simulation does not automatically change advertising-platform budgets.</p>
        <h2>AI and usage limits</h2><p>When requested and available, an AI provider receives the simulation results to generate a recommendation. A local summary is used when AI is unavailable. Server-side usage limits still apply.</p>
      </> : <>
        <h2>Project purpose</h2><p>Synapse supports advertising contribution analysis, inventory-aware budget simulation and comparison of imported monthly reports.</p>
        <h2>System foundation</h2><p>The application combines a React dashboard, FastAPI services, SQLAlchemy persistence and SciPy optimization. AI recommendations explain calculated results in plain language.</p>
        <h2>Operating workflow</h2><p>Authenticate to a brand workspace, import advertising and commerce records, update inventory, inspect product contribution, and run a budget simulation. The decision audit records completed simulations.</p>
      </>}
      </section></div></main></div></div>;
}

