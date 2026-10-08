import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {stockDays, horizon} from '../src/format.js';

test('stock-day labels round up at twelve hours without changing safety calculations', () => {
 assert.equal(stockDays(1.15), '1 day');
 assert.equal(stockDays(1.4999), '1 day');
 assert.equal(stockDays(1.5), '2 days');
 assert.equal(stockDays(13.5), '14 days');
 assert.equal(stockDays(0), '0 days');
 assert.equal(stockDays(null), 'Not available');
 assert.equal(horizon({stock_units: 135, daily_velocity: 10}), 13.5);
});

test('compact headings, shared export position and sidebar page links render correctly', async () => {
 const server = await createServer({configFile:false,resolve:{preserveSymlinks:true},appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
 try {
  const {Workspace} = await server.ssrLoadModule('/src/App.jsx');
  const html = renderToStaticMarkup(React.createElement(Workspace, {session:{brand:{id:1,name:'My Brand'}},theme:'light'}));
  assert.ok(!html.includes('BRAND ='));
  assert.ok(html.includes('SKU Performance'));
  assert.ok(html.includes('/terms.html'));
  assert.ok(html.includes('/establishment.html'));
  assert.equal((html.match(/Export JSON/g) || []).length,1);
  assert.ok(html.indexOf('Export JSON') < html.indexOf('id="allocation"'));
  for (const removed of ['Budget allocation</h2>','SKU contribution</h2>','SciPy / SLSQP','simulations/hour','Include Gemini recommendation','Inventory &amp; contribution checks','MONTHLY REPORTING / INR','Compare two months','Import full-month totals','Projections are modeled estimates']) assert.ok(!html.includes(removed),removed);
  assert.ok(html.includes('Include Synapse AI recommendation'));
  assert.ok(html.includes('Month comparization'));
  const {default: Cards} = await server.ssrLoadModule('/src/components/RevenueProfitView.jsx');
  const cards = renderToStaticMarkup(React.createElement(Cards,{campaigns:[{sku:'A',channel:'meta',revenue:100,spend:10,margin:.5,stock_units:135,daily_velocity:10}]}));
  assert.ok(cards.includes('14 days'));
  assert.ok(cards.includes('Low Stock · Ad Shield Active'), 'Safety uses exact 13.5 days even if label rounds to 14');
  const {InformationPage} = await server.ssrLoadModule('/src/components/InformationPage.jsx');
  assert.ok(renderToStaticMarkup(React.createElement(InformationPage)).includes('Terms &amp; Conditions'));
  assert.ok(renderToStaticMarkup(React.createElement(InformationPage,{page:'establishment'})).includes('Project purpose'));
  const source = await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.ok(source.indexOf('<InventoryEditor') < source.indexOf('SKU(s) have missing inventory'));
 } finally {await server.close();}
});
