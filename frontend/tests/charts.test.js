import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
test('SKU graphs use channel totals, signed contributions and undefined zero-spend ratios', async () => {
 const server = await createServer({configFile:false,resolve:{preserveSymlinks:true},appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
 try {
  const {chartData,default:Charts} = await server.ssrLoadModule('/src/components/SkuCharts.jsx');
  const campaigns = [
   {sku:'A',revenue:100,spend:20,margin:.5,stock_units:200,daily_velocity:10},
   {sku:'A',revenue:50,spend:10,margin:.5,stock_units:200,daily_velocity:10},
   {sku:'B',revenue:10,spend:50,margin:.5,stock_units:100,daily_velocity:10},
   {sku:'C',revenue:0,spend:0,margin:.5,stock_units:100,daily_velocity:0}
  ];
  const contribution = chartData(campaigns,'contribution');
  assert.equal(contribution.length,3);
  assert.equal(contribution[0].value,45);
  assert.equal(contribution[1].value,-45);
  assert.equal(contribution[1].width,50);
  assert.equal(chartData(campaigns,'revenue')[0].value,150);
  assert.equal(chartData(campaigns,'roas')[0].value,5);
  assert.equal(chartData(campaigns,'roas')[2].value,null);
  assert.deepEqual(chartData([],'revenue'),[]);
  const html = renderToStaticMarkup(React.createElement(Charts,{campaigns}));
  assert.ok(html.includes('chart-negative'));
  assert.ok(!html.includes('<path'));
  assert.ok(html.includes('₹45'));
  assert.ok(!html.includes('7D'));
  const roas = renderToStaticMarkup(React.createElement(Charts,{campaigns,initialMetric:'roas'}));
  assert.ok(roas.includes('Not defined: no ad spend'));
  assert.ok(roas.includes('No recent velocity'));
  const {default:Cards} = await server.ssrLoadModule('/src/components/RevenueProfitView.jsx');
  const cards = renderToStaticMarkup(React.createElement(Cards,{campaigns}));
  assert.ok(cards.includes('product-status-row'));
  assert.ok(!cards.includes('snapshot'));
 } finally {await server.close();}
});
