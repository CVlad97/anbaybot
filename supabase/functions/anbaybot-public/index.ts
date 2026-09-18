import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ORIGIN = "https://cvlad97.github.io";
const TRON_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const SOLANA_USDC = "EPjFWdd5AufqSSqeM2q1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,apikey",
  "Cache-Control": "no-store, max-age=0",
  "Vary": "Origin",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function db() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("supabase_server_credentials_missing");
  return createClient(url, key, { global: { headers: { "X-Client-Info": "anbaybot-public-v6" } } });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return await res.json() as T;
    if (res.status === 429 && attempt < 2) { await sleep(450 * (attempt + 1)); continue; }
    throw new Error(`http_${res.status}`);
  }
  throw new Error("http_retry_exhausted");
}

async function eurUsdRate() {
  try {
    const row = await fetchJson<{price?: string}>("https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT");
    const value = Number(row.price || 0);
    if (value > 0) return { eurUsd: value, source: "BINANCE_EURUSDT" };
  } catch { /* try the next FX source */ }
  try {
    const row = await fetchJson<{rates?: {USD?: number}}>("https://api.frankfurter.app/latest?from=EUR&to=USD");
    const value = Number(row.rates?.USD || 0);
    if (value > 0) return { eurUsd: value, source: "FRANKFURTER_ECB" };
  } catch { /* use approximate FX fallback */ }
  return { eurUsd: 1.15, source: "FALLBACK_APPROX" };
}

async function prices() {
  const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "TRXUSDT"];
  const rows = await Promise.all(symbols.map(async symbol => {
    try {
      const d = await fetchJson<{lastPrice?: string}>(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`);
      return [symbol, Number(d.lastPrice || 0)] as const;
    } catch { return [symbol, 0] as const; }
  }));
  return new Map(rows);
}

function maskAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type WalletRow = { id: string; chain: string; label: string; address: string; platform: string; enabled: boolean };
type Token = { symbol: string; balance: number; priceUsd: number; valueUsd: number };
type PublicWallet = { walletId: string; label: string; chain: string; platform: string; addressMasked: string; totalValueUsd: number; tokens: Token[]; error?: string };

type PublicPolymarketMarket = {
  id: string;
  question: string;
  slug: string;
  outcomePrices: number[];
  liquidityUsd: number;
  volume24hUsd: number;
  spread: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  lastTradePrice: number | null;
  rewardsDailyRate: number;
  endDate: string | null;
  acceptingOrders: boolean;
  restricted: boolean;
};

type RawPolymarketMarket = {
  id?: string;
  question?: string;
  slug?: string;
  outcomePrices?: string;
  liquidityNum?: number;
  volume24hr?: number;
  spread?: number;
  bestBid?: number;
  bestAsk?: number;
  lastTradePrice?: number;
  acceptingOrders?: boolean;
  active?: boolean;
  closed?: boolean;
  restricted?: boolean;
  endDate?: string;
  clobRewards?: Array<{ rewardsDailyRate?: number }>;
};

async function readTron(w: WalletRow, px: Map<string, number>): Promise<PublicWallet> {
  const data = await fetchJson<{data?: Array<{balance?: number; trc20?: Array<Record<string,string>>}>}>(`https://api.trongrid.io/v1/accounts/${w.address}`);
  const account = data.data?.[0] || {};
  const tokens: Token[] = [];
  const trx = Number(account.balance || 0) / 1e6;
  if (trx > 0) tokens.push({ symbol: "TRX", balance: trx, priceUsd: px.get("TRXUSDT") || 0, valueUsd: trx * (px.get("TRXUSDT") || 0) });
  let rawUsdt = 0;
  for (const entry of account.trc20 || []) rawUsdt += Number(entry[TRON_USDT] || 0);
  const usdt = rawUsdt / 1e6;
  if (usdt > 0) tokens.push({ symbol: "USDT", balance: usdt, priceUsd: 1, valueUsd: usdt });
  return { walletId: w.id, label: w.label, chain: w.chain, platform: w.platform, addressMasked: maskAddress(w.address), tokens, totalValueUsd: tokens.reduce((s,t)=>s+t.valueUsd,0) };
}

async function readEvm(w: WalletRow): Promise<PublicWallet> {
  const base = w.chain === "eth" ? "https://eth.blockscout.com/api/v2" : "https://base.blockscout.com/api/v2";
  const [a, tokenRows] = await Promise.all([
    fetchJson<{coin_balance?: string; exchange_rate?: string}>(`${base}/addresses/${w.address}`),
    fetchJson<Array<{value?: string; balance?: string; token?: {symbol?: string; decimals?: string|number; exchange_rate?: string; fiat_value?: string}}>>(`${base}/addresses/${w.address}/token-balances`),
  ]);
  const tokens: Token[] = [];
  const native = Number(a.coin_balance || 0) / 1e18;
  const ethPrice = Number(a.exchange_rate || 0);
  if (native > 0) tokens.push({ symbol: "ETH", balance: native, priceUsd: ethPrice, valueUsd: native * ethPrice });
  for (const row of tokenRows || []) {
    const symbol = String(row.token?.symbol || "TOKEN");
    const decimals = Number(row.token?.decimals || 0);
    const raw = Number(row.value ?? row.balance ?? 0);
    const balance = decimals > 0 ? raw / 10 ** decimals : raw;
    if (!Number.isFinite(balance) || balance <= 0) continue;
    let price = Number(row.token?.exchange_rate ?? row.token?.fiat_value ?? 0);
    if (!price && ["USDC","USDbC","USDT","DAI"].includes(symbol)) price = 1;
    const valueUsd = balance * price;
    if (valueUsd > 0) tokens.push({ symbol, balance, priceUsd: price, valueUsd });
  }
  return { walletId: w.id, label: w.label, chain: w.chain, platform: w.platform, addressMasked: maskAddress(w.address), tokens, totalValueUsd: tokens.reduce((s,t)=>s+t.valueUsd,0) };
}

async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
  const d = await fetchJson<{result?: T}>(SOLANA_RPC, { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ jsonrpc:"2.0", id:1, method, params }) });
  if (!d.result) throw new Error(`solana_${method}_missing_result`);
  return d.result;
}

async function readSolana(w: WalletRow, px: Map<string, number>): Promise<PublicWallet> {
  const [native, tokenAccounts] = await Promise.all([
    solanaRpc<{value:number}>("getBalance", [w.address, { commitment:"confirmed" }]),
    solanaRpc<{value:Array<{account?:{data?:{parsed?:{info?:{mint?:string; tokenAmount?:{uiAmount?:number|null; uiAmountString?:string}}}}}}>}>("getTokenAccountsByOwner", [w.address, { programId:"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding:"jsonParsed", commitment:"confirmed" }]),
  ]);
  const tokens: Token[] = [];
  const sol = Number(native.value || 0) / 1e9;
  const solPrice = px.get("SOLUSDT") || 0;
  if (sol > 0) tokens.push({ symbol:"SOL", balance:sol, priceUsd:solPrice, valueUsd:sol*solPrice });
  for (const row of tokenAccounts.value || []) {
    const info = row.account?.data?.parsed?.info;
    if (info?.mint !== SOLANA_USDC) continue;
    const amount = Number(info.tokenAmount?.uiAmount ?? info.tokenAmount?.uiAmountString ?? 0);
    if (amount > 0) tokens.push({ symbol:"USDC", balance:amount, priceUsd:1, valueUsd:amount });
  }
  return { walletId:w.id, label:w.label, chain:w.chain, platform:w.platform, addressMasked:maskAddress(w.address), tokens, totalValueUsd:tokens.reduce((s,t)=>s+t.valueUsd,0) };
}

async function portfolio(s: ReturnType<typeof db>) {
  const [{data: wallets, error}, px] = await Promise.all([
    s.from("managed_wallets").select("id,chain,label,address,platform,enabled").eq("enabled", true),
    prices(),
  ]);
  if (error) throw error;
  const output: PublicWallet[] = [];
  for (const w of (wallets || []) as WalletRow[]) {
    try {
      const chain = w.chain.toLowerCase();
      if (chain === "tron") output.push(await readTron(w, px));
      else if (chain === "solana") output.push(await readSolana(w, px));
      else if (["base","eth","ethereum"].includes(chain)) output.push(await readEvm(w));
      else output.push({ walletId:w.id,label:w.label,chain:w.chain,platform:w.platform,addressMasked:maskAddress(w.address),tokens:[],totalValueUsd:0,error:"unsupported_chain" });
    } catch (e) {
      output.push({ walletId:w.id,label:w.label,chain:w.chain,platform:w.platform,addressMasked:maskAddress(w.address),tokens:[],totalValueUsd:0,error:e instanceof Error?e.message:"balance_fetch_failed" });
    }
    if (w.chain.toLowerCase() === "tron") await sleep(350);
  }
  return { wallets: output, totalValueUsd: output.reduce((s,w)=>s+w.totalValueUsd,0), updatedAt: new Date().toISOString() };
}

const POLY_SAFE_INCLUDE = /(bitcoin|btc|ethereum|eth|solana|sol|xrp|doge|crypto|cryptocurrency|price|market cap|sports?|nba|nfl|mlb|nhl|soccer|football|basketball|baseball|tennis|ufc|formula 1|f1|esports?|champions league|premier league|la liga|serie a|bundesliga)/i;
const POLY_POLITICAL_EXCLUDE = /(election|president|prime minister|parliament|congress|senate|governor|government|cabinet|referendum|politic|geopolit|trump|biden|vance|newsom|macron|le pen|mélenchon|merkel|scholz|starmer|putin|zelensky|xi jinping|netanyahu|iran|israel|ukraine|russia|china invasion|war|ceasefire|sanction)/i;

function parsePrices(raw?: string) {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
  } catch { return []; }
}

async function polymarket() {
  const tagIds = [745, 1234];
  const pages = await Promise.all(tagIds.map(async tagId => {
    try {
      const payload = await fetchJson<{markets?: RawPolymarketMarket[]}>(`https://gamma-api.polymarket.com/markets/keyset?tag_id=${tagId}&closed=false&limit=50`);
      return payload.markets || [];
    } catch { return []; }
  }));
  const rows = pages.flat();
  const markets: PublicPolymarketMarket[] = [];
  for (const row of rows || []) {
    const question = String(row.question || "").trim();
    const slug = String(row.slug || "").trim();
    const searchable = `${question} ${slug}`;
    if (!question || row.closed === true || row.active === false) continue;
    if (!POLY_SAFE_INCLUDE.test(searchable) || POLY_POLITICAL_EXCLUDE.test(searchable)) continue;
    const liquidityUsd = Number(row.liquidityNum || 0);
    if (!Number.isFinite(liquidityUsd) || liquidityUsd < 10_000) continue;
    markets.push({
      id: String(row.id || ""),
      question,
      slug,
      outcomePrices: parsePrices(row.outcomePrices),
      liquidityUsd,
      volume24hUsd: Number(row.volume24hr || 0),
      spread: Number.isFinite(Number(row.spread)) ? Number(row.spread) : null,
      bestBid: Number.isFinite(Number(row.bestBid)) ? Number(row.bestBid) : null,
      bestAsk: Number.isFinite(Number(row.bestAsk)) ? Number(row.bestAsk) : null,
      lastTradePrice: Number.isFinite(Number(row.lastTradePrice)) ? Number(row.lastTradePrice) : null,
      rewardsDailyRate: (row.clobRewards || []).reduce((sum,x)=>sum+Number(x.rewardsDailyRate||0),0),
      endDate: row.endDate || null,
      acceptingOrders: Boolean(row.acceptingOrders),
      restricted: Boolean(row.restricted),
    });
  }
  markets.sort((a,b)=>(b.volume24hUsd+b.liquidityUsd*0.1)-(a.volume24hUsd+a.liquidityUsd*0.1));
  return {
    source:"POLYMARKET_GAMMA_PUBLIC",
    mode:"READ_ONLY",
    politicalMarketsExcluded:true,
    geoblockCheckUrl:"https://polymarket.com/api/geoblock",
    markets:markets.slice(0,20),
    updatedAt:new Date().toISOString(),
  };
}

async function exchanges(s: ReturnType<typeof db>) {
  const {data, error} = await s.from("exchange_accounts")
    .select("exchange,label,enabled,connection_status,balance_usd,live_trading_enabled,last_checked_at,note")
    .order("exchange");
  if (error) throw error;
  const rows = data || [];
  return { exchanges: rows, totalExchangeUsd: rows.reduce((sum,row)=>sum+Number(row.balance_usd||0),0), updatedAt:new Date().toISOString() };
}

async function strategies(s: ReturnType<typeof db>) {
  const {data, error} = await s.from("strategy_catalog")
    .select("strategy_key,name,category,venue,scan_enabled,execution_mode,status,connection_required,last_verified_at,note")
    .order("category").order("name");
  if (error) throw error;
  return { strategies: data || [], updatedAt:new Date().toISOString() };
}

async function pnl(s: ReturnType<typeof db>) {
  const {data, error} = await s.from("pnl_ledger").select("id,occurred_at,venue,market,pnl_type,gross_pnl_usd,fees_usd,funding_usd,net_pnl_usd,source").eq("environment","LIVE").order("occurred_at",{ascending:false}).limit(100);
  if (error) throw error;
  const rows = data || [];
  const totalNetPnlUsd = rows.reduce((sum, r) => sum + Number(r.net_pnl_usd || 0), 0);
  return { environment:"LIVE", totalNetPnlUsd, count:rows.length, rows, updatedAt:new Date().toISOString() };
}

async function opportunities(s: ReturnType<typeof db>) {
  const { data: latest, error: latestError } = await s.from("strategy_scan_runs")
    .select("run_bucket,created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;
  if (!latest?.run_bucket) return { bucket:null, rows:[], updatedAt:new Date().toISOString() };

  const { data, error } = await s.from("strategy_scan_runs")
    .select("strategy_key,mode,status,expected_return_pct,metadata,created_at")
    .eq("run_bucket", latest.run_bucket)
    .order("strategy_key");
  if (error) throw error;
  return { bucket: latest.run_bucket, rows:data || [], updatedAt:new Date().toISOString() };
}

async function weeklyGoal(s: ReturnType<typeof db>) {
  const [{ totalValueUsd }, fx] = await Promise.all([portfolio(s), eurUsdRate()]);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ data: pnlRows, error: pnlError }, { data: businessRows, error: businessError }] = await Promise.all([
    s.from("pnl_ledger").select("net_pnl_usd").eq("environment","LIVE").gte("occurred_at", since),
    s.from("business_revenue_ledger").select("net_eur").gte("occurred_at", since),
  ]);
  if (pnlError) throw pnlError;
  if (businessError && !String(businessError.message || "").includes("business_revenue_ledger")) throw businessError;

  const marketPnlUsd7d = (pnlRows || []).reduce((sum,row)=>sum+Number(row.net_pnl_usd||0),0);
  const marketPnlEur7d = marketPnlUsd7d / fx.eurUsd;
  const businessEur7d = (businessRows || []).reduce((sum,row)=>sum+Number(row.net_eur||0),0);
  const actualEur7d = marketPnlEur7d + businessEur7d;

  const capitalEur = totalValueUsd / fx.eurUsd;
  const targetWeeklyEur = 1000;
  const targetDailyEur = targetWeeklyEur / 7;
  const requiredWeeklyReturnPct = capitalEur > 0 ? (targetWeeklyEur / capitalEur) * 100 : null;

  const scenarioPcts = [0.25, 1, 2];
  const marketScenarios = scenarioPcts.map(weeklyPct => ({
    weeklyPct,
    weeklyEur: capitalEur * weeklyPct / 100,
    targetCoveragePct: targetWeeklyEur > 0 ? (capitalEur * weeklyPct / 100) / targetWeeklyEur * 100 : 0,
  }));

  const referenceMarketEur = capitalEur * 0.02;
  const businessGapEur = Math.max(0, targetWeeklyEur - referenceMarketEur);
  const monthlyRevenueNeeded = targetWeeklyEur * 52 / 12;
  const subscriptionTargets = [49,149].map(priceMonthlyEur => ({
    priceMonthlyEur,
    subscribersNeeded: Math.ceil(monthlyRevenueNeeded / priceMonthlyEur),
    monthlyRevenueNeeded,
  }));
  const commercialMix = {
    proPriceMonthlyEur: 49,
    enterprisePriceMonthlyEur: 149,
    proSubscribers: 30,
    enterpriseSubscribers: 20,
    monthlyRevenueEur: 30 * 49 + 20 * 149,
    weeklyRevenueEur: (30 * 49 + 20 * 149) * 12 / 52,
  };

  return {
    targetWeeklyEur,
    targetDailyEur,
    capitalUsd: totalValueUsd,
    capitalEur,
    fx,
    actualEur7d,
    marketPnlEur7d,
    businessEur7d,
    gapEur7d: Math.max(0, targetWeeklyEur - actualEur7d),
    progressPct: Math.max(0, Math.min(100, targetWeeklyEur ? actualEur7d / targetWeeklyEur * 100 : 0)),
    requiredWeeklyReturnPct,
    marketScenarios,
    referenceMarketEur,
    businessGapEur,
    subscriptionTargets,
    commercialMix,
    note: "Les scénarios de marché sont des références mathématiques, pas des prévisions ni des promesses de rendement.",
    updatedAt: new Date().toISOString(),
  };
}

async function readiness(s: ReturnType<typeof db>) {
  const [
    { data: settings, error: settingsError },
    { data: ai, error: aiError },
    { data: exchangeRows, error: exchangeError },
    { data: scan, error: scanError },
    { data: livePnl, error: pnlError },
  ] = await Promise.all([
    s.from("settings").select("kill_switch,risk_params,payout_threshold_eur,updated_at").limit(1).maybeSingle(),
    s.from("ai_config").select("enabled,risk_tolerance,auto_rebalance,rebalance_interval_hours,last_run_at,updated_at").limit(1).maybeSingle(),
    s.from("exchange_accounts").select("exchange,connection_status,live_trading_enabled,last_checked_at").order("exchange"),
    s.from("strategy_scan_runs").select("created_at").order("created_at",{ascending:false}).limit(1).maybeSingle(),
    s.from("pnl_ledger").select("net_pnl_usd").eq("environment","LIVE"),
  ]);
  if (settingsError) throw settingsError;
  if (aiError) throw aiError;
  if (exchangeError) throw exchangeError;
  if (scanError) throw scanError;
  if (pnlError) throw pnlError;

  const exchanges = exchangeRows || [];
  const privateReady = exchanges.length > 0 && exchanges.every(row => ["READ_ONLY","TEST_READY","LIVE_READY"].includes(row.connection_status));
  const liveEnabled = exchanges.some(row => row.connection_status === "LIVE_READY" && row.live_trading_enabled);
  const totalNetPnlUsd = (livePnl || []).reduce((sum,row)=>sum+Number(row.net_pnl_usd||0),0);

  return {
    killSwitch: Boolean(settings?.kill_switch ?? true),
    riskParams: settings?.risk_params || {},
    ai: ai || null,
    exchanges,
    privateReady,
    liveEnabled,
    latestScanAt: scan?.created_at || null,
    livePnlUsd: totalNetPnlUsd,
    updatedAt: new Date().toISOString(),
  };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "GET") return json({ error:"method_not_allowed" }, 405);
  try {
    const s = db();
    const path = new URL(req.url).searchParams.get("path") || "health";
    if (path === "health") return json({ status:"ok", mode:"public_read_only", timestamp:new Date().toISOString() });
    if (path === "portfolio") return json(await portfolio(s));
    if (path === "exchanges") return json(await exchanges(s));
    if (path === "strategies") return json(await strategies(s));
    if (path === "pnl") return json(await pnl(s));
    if (path === "opportunities") return json(await opportunities(s));
    if (path === "readiness") return json(await readiness(s));
    if (path === "goal") return json(await weeklyGoal(s));
    if (path === "polymarket") return json(await polymarket());
    return json({ error:"not_found" }, 404);
  } catch (e) {
    console.error("[anbaybot-public]", e);
    return json({ error:"internal_error" }, 500);
  }
});
