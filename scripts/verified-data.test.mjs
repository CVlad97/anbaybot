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
  assert.equal(check('2026-09-28T14:00:00Z',now), true);
  assert.equal(check('2026-09-28T13:29:00Z',now), false);
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
  return { call:()=>vm.runInContext('request("/business/revenue", {method:"POST"})',ctx), callPath:path=>vm.runInContext('request('+JSON.stringify(path)+')',ctx), demos:()=>demoCalls };
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

const proofCtx = vm.createContext({ exports: {} });
vm.runInContext(ts.transpileModule(fs.readFileSync('src/lib/revenueProof.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,proofCtx);
test('hypothetical yield includes compounded APY, costs and losses',()=>{
  const calc=proofCtx.exports.yieldScenario;
  assert.ok(calc(100,5,30,1).net < 0);
  assert.ok(Math.abs(calc(100,5,365,1).net-4) < 1e-8);
  assert.equal(calc(0,5,30,1).net,-1);
  assert.ok(calc(100,-5,365,0).net < 0);
  for(const args of [[-1,5,30,0],[100,-100,30,0],[100,5,-1,0],[100,5,30,-1],[NaN,5,30,0]]) assert.equal(calc(...args),null);
});
test('unknown accounts and recorded entries never become verified gains',()=>{
  assert.equal(proofCtx.exports.evidenceLabel(null),'Compte non lu');
  assert.equal(proofCtx.exports.evidenceLabel({ledger:{count:0}}),'Aucune écriture LIVE');
  assert.equal(proofCtx.exports.evidenceLabel({ledger:{count:5}}),'Écritures à rapprocher');
});
test('catalogue covers every existing module with explicit evidence and automation',()=>{
  const all=proofCtx.exports.REVENUE_MODULES;
  assert.equal(all.length,19);
  assert.equal(new Set(all.map(m=>m.id)).size,19);
  for(const id of ['arbitrage','copy_trading','earn_staking','farming_lp','funding_capture','futures_directional','grid_dca','lending','prediction_markets','referral','saas','spot_momentum']) assert.ok(all.some(m=>m.id===id));
  for(const m of all) { assert.ok(m.evidence.length>20); assert.ok(m.automation.length>15); assert.ok(m.next.length>20); }
});
function privateReadHarness() {
  let handler;
  const ctx=vm.createContext({
    fetch:()=>{throw Error('external fetch forbidden');},Request,Response,URL,console,AbortController,setTimeout,clearTimeout,
    createClient:()=>({from:()=>{throw Error('database read before authorization');}}),
    Deno:{serve:fn=>{handler=fn;},env:{get:()=> 'test-placeholder'}},
  });
  vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  return handler;
}
test('every personal endpoint denies anonymous access before data reads',async()=>{
  const handle=privateReadHarness();
  for(const path of ['portfolio','exchanges','strategies','pnl','opportunities','readiness','goal','challenge','proof']) {
    const res=await handle(new Request('https://example.test/?path='+path));
    assert.equal(res.status,401,path);
    assert.equal((await res.json()).error,'owner_auth_required');
    assert.match(res.headers.get('Access-Control-Allow-Headers'),/X-Anbaybot-Admin-Token/);
  }
  assert.equal((await handle(new Request('https://example.test/?path=health'))).status,200);
});
test('private reads require an active matching token and fail closed on DB error',async()=>{
  const {webcrypto}=await import('node:crypto');
  const ctx=vm.createContext({crypto:webcrypto,TextEncoder,Request,Response,URL,console,setTimeout,clearTimeout,AbortController,Deno:{serve:()=>{},env:{get:()=>''}}});
  vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  ctx.req=new Request('https://example.test',{headers:{'X-Anbaybot-Admin-Token':'test-only-token'}});
  for(const [row,error,expected] of [[null,null,false],[{id:'fixture'},null,true],[{id:'fixture'},{message:'failure'},false]]) {
    const filters=[];
    const chain={eq:(key,value)=>{filters.push([key,value]);return chain;},maybeSingle:async()=>({data:row,error})};
    ctx.client={from:table=>{assert.equal(table,'admin_tokens');return {select:()=>chain};}};
    assert.equal(await vm.runInContext('authorizePersonalRead(req,"proof",client)',ctx),expected);
    assert.equal(filters.find(x=>x[0]==='active')[1],true);
    assert.match(filters.find(x=>x[0]==='token_hash')[1],/^[0-9a-f]{64}$/);
  }
});
test('exchange account health denies anonymous calls before signed exchange reads',async()=>{
  let handler;
  const raw=fs.readFileSync('supabase/functions/ikb-api/index.ts','utf8').replace(/^import .*;\n/gm,'');
  const ctx=vm.createContext({Request,Response,URL,console,Deno:{serve:fn=>{handler=fn;},env:{get:()=> 'test-placeholder'}},createClient:()=>({from:()=>{throw Error('data read before auth');}})});
  vm.runInContext(ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  assert.equal((await handler(new Request('https://example.test/?path=exchange/health'))).status,401);
});
for (const path of ['/trading/pnl','/wallets','/business/revenue']) {
  test('configured backend reads never become demo data on failure: '+path,async()=>{
    const api=apiContext(()=>Promise.resolve(new Response('{}',{status:503})));
    await assert.rejects(api.callPath(path));
    assert.equal(api.demos(),0);
  });
}


test('scheduler credential is limited to scanner auth and errors fail closed',async()=>{
 const raw=fs.readFileSync('supabase/functions/revenue-scanner/index.ts','utf8').replace(/^import .*;\n/gm,'');
 const ctx=vm.createContext({Request,Response,URL,console,Deno:{serve:()=>{},env:{get:()=>''}}});
 vm.runInContext(ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 ctx.req=new Request('https://example.test',{headers:{'X-Anbaybot-Scan-Token':'fixture-scheduler-token'}});
 for(const [data,error,expected] of [[true,null,true],[false,null,false],[true,{message:'failure'},false]]) {
  ctx.client={rpc:async(name,args)=>{assert.equal(name,'authorize_revenue_scan');assert.equal(args.p_token,'fixture-scheduler-token');return {data,error};}};
  assert.equal(await vm.runInContext('authorize(req,client)',ctx),expected);
 }
});

test('scanner retries preserve immutable observations instead of updating them',async()=>{
 const raw=fs.readFileSync('supabase/functions/revenue-scanner/index.ts','utf8').replace(/^import .*;\n/gm,'');
 const ctx=vm.createContext({Response,console,Deno:{serve:()=>{},env:{get:()=>''}}});
 vm.runInContext(ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 for(const count of [0,12]){
  ctx.client={from:table=>{assert.equal(table,'strategy_scan_runs');return {upsert:(_rows,options)=>{assert.equal(options.ignoreDuplicates,true);assert.equal(options.onConflict,'run_bucket,strategy_key');return {select:async()=>({data:Array(count).fill({strategy_key:'fixture'}),error:null})};}};}};
  assert.equal(await vm.runInContext('persistScanRuns(client,[])',ctx),count);
 }
 ctx.client={from:()=>({upsert:()=>({select:async()=>({data:null,error:{message:'database offline'}})})})};
 await assert.rejects(vm.runInContext('persistScanRuns(client,[])',ctx),/scan_persistence_failed/);
});
