import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('supabase/functions/anbaybot-public/index.ts', 'utf8')
  .replace(/^import .*;\n/gm, '');
function backend(fetchImpl, rows = [], fastTimers = false) {
  const ctx = vm.createContext({
    fetch: fetchImpl, AbortController, Response, URL, console,
    setTimeout: (fn, ms) => setTimeout(fn, fastTimers ? Math.min(ms, 20) : ms),
    clearTimeout, Deno: { serve: () => {}, env: { get: () => '' } },
  });
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, ctx);
  ctx.client = { from: () => ({ select: () => ({ eq: async () => ({ data: rows, error: null }) }) }) };
  return { call: expr => vm.runInContext(expr, ctx), ctx };
}
const wallet = id => ({ id, chain: 'tron', address: 'test-address-' + id, label: id, platform: 'TEST', enabled: true });
const json = d => Promise.resolve(new Response(JSON.stringify(d), { headers: { 'content-type': 'application/json' } }));

test('MEXC price field values native TRX correctly', async () => {
  const b = backend(url => url.includes('ticker/price') ? json({ price: '0.3343' }) : json({ data: [{ balance: 2e6 }] }), [wallet('a')]);
  const result = await b.call('portfolio(client)');
  assert.equal(result.complete, true);
  assert.equal(result.totalValueUsd, 0.6686);
});
test('slow source aborts with explicit timeout', async () => {
  let aborted = false;
  const b = backend((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); })), [], true);
  await assert.rejects(b.call('fetchJson("https://example.test")'), /source_timeout/);
  assert.equal(aborted, true);
});
test('wallet failure preserves successful balances and marks partial', async () => {
  const b = backend(url => url.includes('ticker/price') ? json({ price: '1' }) : url.endsWith('-bad') ? Promise.reject(new Error('offline')) : json({ data: [{ balance: 2e6 }] }), [wallet('ok'), wallet('bad')]);
  const result = await b.call('portfolio(client)');
  assert.equal(result.totalValueUsd, 2);
  assert.equal(result.complete, false);
  assert.equal(result.failedWallets, 1);
});
test('concurrent portfolio reads share work and complete responses are cached', async () => {
  let calls = 0;
  const b = backend(url => { calls++; return url.includes('ticker/price') ? json({ price: '1' }) : json({ data: [{ balance: 1e6 }] }); }, [wallet('a')]);
  await Promise.all([b.call('portfolio(client)'), b.call('portfolio(client)')]);
  const firstCount = calls;
  await b.call('portfolio(client)');
  assert.equal(calls, firstCount);
  assert.equal(calls, 5);
});
test('partial responses are retried instead of cached as complete', async () => {
  let calls = 0;
  const b = backend(url => { calls++; return url.includes('ticker/price') ? json({ price: '1' }) : Promise.reject(new Error('offline')); }, [wallet('a')]);
  await b.call('portfolio(client)'); const count = calls;
  await b.call('portfolio(client)'); assert.ok(calls > count);
});
test('missing native price cannot certify a complete portfolio', async () => {
  const b = backend(url => url.includes('ticker/price') ? json({}) : json({ data: [{ balance: 2e6 }] }), [wallet('a')]);
  const result = await b.call('portfolio(client)');
  assert.equal(result.complete, false);
  assert.equal(result.wallets[0].error, 'unpriced_assets');
});
test('Ethereum alias uses Ethereum explorer, not Base', async () => {
  const urls = [];
  const b = backend(url => { urls.push(url); return url.endsWith('token-balances') ? json([]) : json({ coin_balance: '0' }); });
  await b.call('readEvm({chain:"ethereum",address:"example",id:"a"})');
  assert.ok(urls.every(u => u.startsWith('https://eth.blockscout.com/')));
});
test('a token name cannot fabricate a dollar valuation', async () => {
  const b = backend(url => url.endsWith('token-balances') ? json([{ value:'1000000',token:{symbol:'USDC',decimals:6} }]) : json({ coin_balance:'0' }));
  const result = await b.call('readEvm({chain:"base",address:"example",id:"a"})');
  assert.equal(result.totalValueUsd, 0);
});
test('freshness rejects stale, invalid, missing and future timestamps', () => {
  const ctx = vm.createContext({ exports: {} });
  vm.runInContext(ts.transpileModule(fs.readFileSync('src/lib/dataHealth.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, ctx);
  const check = ctx.exports.isFreshTimestamp;
  const now = Date.parse('2026-09-28T15:00:00Z');
  assert.equal(check('2026-09-28T14:45:00Z',now), true);
  for (const stamp of [null,'invalid','2026-09-21T14:00:00Z','2026-09-29T00:00:00Z']) assert.equal(check(stamp,now), false);
});
const apiSource = fs.readFileSync('src/lib/api.ts','utf8');
function apiContext(fetchImpl, cooling = false) {
  let demoCalls = 0;
  const chunk = apiSource.slice(apiSource.indexOf('const RAW_BACKEND_API_URL'), apiSource.indexOf('async function fetchBinancePrices'))
    .replace('import.meta.env.VITE_BACKEND_API_URL', '"https://example.test"');
  const ctx = vm.createContext({
    fetch:fetchImpl, AbortController, setTimeout, clearTimeout,
    supabaseUrl:'', supabaseAnonKey:'', isDemoSupabase:false, getAdminToken:()=> '',
    isRuntimeFallbackCoolingDown:()=>cooling, setRuntimeBackendMode:()=>{}, clearRuntimeBackendFallback:()=>{},
    demoRequest:()=>{ demoCalls++; return { simulated:true }; },
  });
  vm.runInContext(ts.transpileModule(chunk,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  return { call:()=>vm.runInContext('request("/business/revenue", {method:"POST"})',ctx), demos:()=>demoCalls };
}
for (const [name, implementation, cooling] of [
  ['HTTP 503',()=>Promise.resolve(new Response('{}',{status:503})),false],
  ['network loss',()=>Promise.reject(new Error('offline')),false],
  ['invalid JSON',()=>Promise.resolve(new Response('not json')),false],
  ['cooldown',()=>{ throw new Error('must not fetch'); },true],
]) test('business revenue never becomes a demo success on '+name, async () => {
  const api = apiContext(implementation,cooling);
  await assert.rejects(api.call());
  assert.equal(api.demos(),0);
});
