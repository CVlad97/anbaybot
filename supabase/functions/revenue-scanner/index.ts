import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ORIGIN = "https://cvlad97.github.io";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Anbaybot-Admin-Token",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });

function db() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("supabase_server_credentials_missing");
  return createClient(url, key, { global: { headers: { "X-Client-Info": "anbaybot-revenue-scanner-v6" } } });
}

async function sha256(value: string) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(raw)).map(x => x.toString(16).padStart(2, "0")).join("");
}

async function authorize(req: Request, client: ReturnType<typeof db>) {
  const token = req.headers.get("X-Anbaybot-Admin-Token") || "";
  if (!token) return false;
  const hash = await sha256(token);
  const { data, error } = await client.from("admin_tokens").select("id").eq("token_hash", hash).eq("active", true).maybeSingle();
  return !error && Boolean(data);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return await res.json() as T;
}

function bucketHour() {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

type FundingRow = { fundingRate: string; fundingTime: number };
type Book = { symbol: string; bid: number; ask: number };
type YieldPool = {
  pool?: string;
  chain?: string;
  project?: string;
  symbol?: string;
  tvlUsd?: number;
  apy?: number;
  apyBase?: number;
  apyReward?: number;
  stablecoin?: boolean;
  ilRisk?: string;
  exposure?: string;
};

type PolymarketMarket = {
  id?: string;
  question?: string;
  slug?: string;
  outcomes?: string;
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

type PolymarketCandidate = {
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

type YieldCandidate = {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  score: number;
};

async function funding(symbol: string) {
  const rows = await fetchJson<FundingRow[]>(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=30`);
  const rates = rows.map(row => Number(row.fundingRate || 0)).filter(Number.isFinite);
  const grossPct = rates.reduce((sum, value) => sum + value, 0) * 100;
  const first = rows[0]?.fundingTime || Date.now();
  const last = rows.at(-1)?.fundingTime || Date.now();
  return {
    symbol,
    count: rates.length,
    grossPct,
    horizonDays: Math.max((last - first) / 86_400_000, 1 / 24),
    lastFundingPct: (rates.at(-1) || 0) * 100,
    windowStart: new Date(first).toISOString(),
    windowEnd: new Date(last).toISOString(),
  };
}

async function ticker(symbol: string) {
  const row = await fetchJson<{ lastPrice?: string; priceChangePercent?: string; quoteVolume?: string }>(`https://api.mexc.com/api/v3/ticker/24hr?symbol=${symbol}`);
  return { symbol, lastPrice: Number(row.lastPrice || 0), change24hPct: Number(row.priceChangePercent || 0), quoteVolume: Number(row.quoteVolume || 0) };
}

async function bookBinance(symbol: string): Promise<Book> {
  const row = await fetchJson<{ bidPrice?: string; askPrice?: string }>(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol}`);
  return { symbol, bid: Number(row.bidPrice || 0), ask: Number(row.askPrice || 0) };
}

async function bookMexc(symbol: string): Promise<Book> {
  const row = await fetchJson<{ bidPrice?: string; askPrice?: string }>(`https://api.mexc.com/api/v3/ticker/bookTicker?symbol=${symbol}`);
  return { symbol, bid: Number(row.bidPrice || 0), ask: Number(row.askPrice || 0) };
}

async function arbitrage(symbol: string) {
  const [binance, mexc] = await Promise.all([bookBinance(symbol), bookMexc(symbol)]);
  const directions = [
    { symbol, buyVenue: "MEXC", sellVenue: "BINANCE", buyPrice: mexc.ask, sellPrice: binance.bid, grossSpreadPct: mexc.ask > 0 ? ((binance.bid - mexc.ask) / mexc.ask) * 100 : -999 },
    { symbol, buyVenue: "BINANCE", sellVenue: "MEXC", buyPrice: binance.ask, sellPrice: mexc.bid, grossSpreadPct: binance.ask > 0 ? ((mexc.bid - binance.ask) / binance.ask) * 100 : -999 },
  ];
  return directions.sort((a, b) => b.grossSpreadPct - a.grossSpreadPct)[0];
}

function normalizeYield(row: YieldPool): YieldCandidate | null {
  const tvlUsd = Number(row.tvlUsd || 0);
  const apy = Number(row.apy || 0);
  if (!Number.isFinite(tvlUsd) || !Number.isFinite(apy) || tvlUsd <= 0 || apy <= 0) return null;
  const symbol = String(row.symbol || "").toUpperCase();
  const stableSymbol = /(USDT|USDC|DAI|USDS|PYUSD|USDE|FRAX)/.test(symbol);
  if (!(row.stablecoin === true || stableSymbol)) return null;
  if (tvlUsd < 5_000_000 || apy > 50) return null;
  const ilRisk = String(row.ilRisk || "unknown").toLowerCase();
  const exposure = String(row.exposure || "unknown").toLowerCase();
  const riskPenalty = ilRisk === "yes" ? 20 : ilRisk === "unknown" ? 5 : 0;
  const score = apy * 2 + Math.log10(Math.max(tvlUsd, 1)) * 4 - riskPenalty;
  return {
    pool: String(row.pool || ""),
    chain: String(row.chain || "unknown"),
    project: String(row.project || "unknown"),
    symbol,
    tvlUsd,
    apy,
    apyBase: Number(row.apyBase || 0),
    apyReward: Number(row.apyReward || 0),
    stablecoin: true,
    ilRisk,
    exposure,
    score,
  };
}


const POLYMARKET_SAFE_INCLUDE = /(bitcoin|btc|ethereum|eth|solana|sol|xrp|doge|crypto|cryptocurrency|price|market cap|sports?|nba|nfl|mlb|nhl|soccer|football|basketball|baseball|tennis|ufc|formula 1|f1|esports?|champions league|premier league|la liga|serie a|bundesliga)/i;
const POLYMARKET_POLITICAL_EXCLUDE = /(election|president|prime minister|parliament|congress|senate|governor|government|cabinet|referendum|politic|geopolit|trump|biden|vance|newsom|macron|le pen|mélenchon|merkel|scholz|starmer|putin|zelensky|xi jinping|netanyahu|iran|israel|ukraine|russia|china invasion|war|ceasefire|sanction)/i;

function parsePolyPrices(raw?: string) {
  try {
    const rows = JSON.parse(raw || "[]");
    return Array.isArray(rows) ? rows.map(Number).filter(Number.isFinite) : [];
  } catch { return []; }
}

function normalizePolymarket(row: PolymarketMarket): PolymarketCandidate | null {
  const question = String(row.question || "").trim();
  const slug = String(row.slug || "").trim();
  const searchable = `${question} ${slug}`;
  if (!question || row.closed === true || row.active === false) return null;
  // Conservative filter: only clearly non-political crypto/sports markets are surfaced.
  if (!POLYMARKET_SAFE_INCLUDE.test(searchable) || POLYMARKET_POLITICAL_EXCLUDE.test(searchable)) return null;
  const liquidityUsd = Number(row.liquidityNum || 0);
  const volume24hUsd = Number(row.volume24hr || 0);
  if (!Number.isFinite(liquidityUsd) || liquidityUsd < 10_000) return null;
  return {
    id: String(row.id || ""),
    question,
    slug,
    outcomePrices: parsePolyPrices(row.outcomePrices),
    liquidityUsd,
    volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : 0,
    spread: Number.isFinite(Number(row.spread)) ? Number(row.spread) : null,
    bestBid: Number.isFinite(Number(row.bestBid)) ? Number(row.bestBid) : null,
    bestAsk: Number.isFinite(Number(row.bestAsk)) ? Number(row.bestAsk) : null,
    lastTradePrice: Number.isFinite(Number(row.lastTradePrice)) ? Number(row.lastTradePrice) : null,
    rewardsDailyRate: (row.clobRewards || []).reduce((sum, x) => sum + Number(x.rewardsDailyRate || 0), 0),
    endDate: row.endDate || null,
    acceptingOrders: Boolean(row.acceptingOrders),
    restricted: Boolean(row.restricted),
  };
}

async function scanPolymarket() {
  const tagIds = [745, 1234];
  const pages = await Promise.all(tagIds.map(async tagId => {
    try {
      const payload = await fetchJson<{markets?: PolymarketMarket[]}>(`https://gamma-api.polymarket.com/markets/keyset?tag_id=${tagId}&closed=false&limit=50`);
      return payload.markets || [];
    } catch { return []; }
  }));
  const rows = pages.flat();
  const candidates = (rows || [])
    .map(normalizePolymarket)
    .filter((x): x is PolymarketCandidate => Boolean(x))
    .sort((a,b) => (b.volume24hUsd + b.liquidityUsd * 0.1) - (a.volume24hUsd + a.liquidityUsd * 0.1))
    .slice(0, 20);
  return {
    candidates,
    top: candidates[0] || null,
    source: "POLYMARKET_GAMMA_PUBLIC",
    execution: "NONE",
    filter: "NON_POLITICAL_CRYPTO_SPORTS_V1",
    geoblockRequiredBeforeTrading: true,
  };
}

async function scanYields() {
  const payload = await fetchJson<{ data?: YieldPool[] }>("https://yields.llama.fi/pools");
  const candidates = (payload.data || []).map(normalizeYield).filter((x): x is YieldCandidate => Boolean(x));
  const earn = candidates
    .filter(row => row.ilRisk !== "yes" && row.apy <= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const farms = candidates
    .filter(row => row.exposure === "multi" || row.ilRisk === "yes")
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  return {
    bestEarn: earn[0] || null,
    bestFarm: farms[0] || candidates.sort((a, b) => b.score - a.score)[0] || null,
    earn,
    farms,
  };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const client = db();
    if (!await authorize(req, client)) return json({ error: "unauthorized" }, 401);
    const bucket = bucketHour();
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

    const fundingSettled = await Promise.allSettled(symbols.map(funding));
    const fundingRows = fundingSettled.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof funding>>> => r.status === "fulfilled").map(r => r.value);
    const fundingErrors = fundingSettled.filter(r => r.status === "rejected").map(r => r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : "");

    const marketSettled = await Promise.allSettled(symbols.map(ticker));
    const market = marketSettled.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof ticker>>> => r.status === "fulfilled").map(r => r.value);
    const marketErrors = marketSettled.filter(r => r.status === "rejected").map(r => r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : "");

    const arbSettled = await Promise.allSettled(symbols.map(arbitrage));
    const arbRows = arbSettled.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof arbitrage>>> => r.status === "fulfilled").map(r => r.value);
    const arbErrors = arbSettled.filter(r => r.status === "rejected").map(r => r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : "");

    let yieldData: Awaited<ReturnType<typeof scanYields>> = { bestEarn: null, bestFarm: null, earn: [], farms: [] };
    let yieldError = "";
    let polymarketData: Awaited<ReturnType<typeof scanPolymarket>> = { candidates: [], top: null, source: "POLYMARKET_GAMMA_PUBLIC", execution: "NONE", filter: "NON_POLITICAL_CRYPTO_SPORTS_V1", geoblockRequiredBeforeTrading: true };
    let polymarketError = "";
    try {
      yieldData = await scanYields();
    } catch (error) {
      yieldError = error instanceof Error ? error.message : String(error);
    }

    try {
      polymarketData = await scanPolymarket();
    } catch (error) {
      polymarketError = error instanceof Error ? error.message : String(error);
    }

    const { data: balances } = await client.from("wallet_balances").select("value_usd");
    const capitalObservedUsd = (balances || []).reduce((sum, row) => sum + Number(row.value_usd || 0), 0);

    const bestFunding = fundingRows.length ? [...fundingRows].sort((a, b) => b.grossPct - a.grossPct)[0] : null;
    const strongest = market.length ? [...market].sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))[0] : null;
    const bestArb = arbRows.length ? [...arbRows].sort((a, b) => b.grossSpreadPct - a.grossSpreadPct)[0] : null;
    const fundingStatus = bestFunding ? "DATA_READY" : "UNVERIFIED";
    const marketStatus = strongest ? "PAPER_READY" : "UNVERIFIED";
    const arbitrageStatus = bestArb ? "DATA_READY" : "UNVERIFIED";
    const yieldStatus = yieldData.bestEarn ? "DATA_READY" : "UNVERIFIED";
    const farmingStatus = yieldData.bestFarm ? "DATA_READY" : "UNVERIFIED";
    const polymarketStatus = polymarketData.candidates.length ? "DATA_READY" : "UNVERIFIED";
    const yieldHourlyGrossUsd = yieldData.bestEarn ? capitalObservedUsd * (yieldData.bestEarn.apy / 100) / 8760 : null;

    const runs = [
      { strategy_key: "funding_capture", mode: "PAPER", source: bestFunding ? "BINANCE_PUBLIC" : "BINANCE_PUBLIC_BLOCKED", status: fundingStatus, expected_return_pct: bestFunding?.grossPct ?? null, metadata: bestFunding ? { assets: fundingRows, best_asset: bestFunding.symbol, costs_included: false } : { errors: fundingErrors } },
      { strategy_key: "futures_directional", mode: "PAPER", source: "MEXC_PUBLIC", status: marketStatus, expected_return_pct: null, metadata: { market, strongest_asset: strongest?.symbol ?? null, strongest_24h_pct: strongest?.change24hPct ?? null, errors: marketErrors, decision: "SCAN_ONLY" } },
      { strategy_key: "spot_momentum", mode: "PAPER", source: "MEXC_PUBLIC", status: marketStatus, expected_return_pct: null, metadata: { market, strongest_asset: strongest?.symbol ?? null, strongest_24h_pct: strongest?.change24hPct ?? null, errors: marketErrors, decision: "SCAN_ONLY" } },
      { strategy_key: "grid_dca", mode: "PAPER", source: "MEXC_PUBLIC", status: marketStatus, expected_return_pct: null, metadata: { market, errors: marketErrors, decision: "SCAN_ONLY" } },
      { strategy_key: "earn_staking", mode: "RESEARCH", source: yieldData.bestEarn ? "DEFILLAMA_YIELDS" : "NO_VERIFIED_CONNECTOR", status: yieldStatus, expected_return_pct: yieldData.bestEarn?.apy ?? null, metadata: yieldData.bestEarn ? { best: yieldData.bestEarn, top: yieldData.earn, apy_is_annualized: true, execution: "NONE" } : { reason: yieldError || "No qualifying stablecoin yield pool." } },
      { strategy_key: "lending", mode: "RESEARCH", source: yieldData.bestEarn ? "DEFILLAMA_YIELDS" : "NO_VERIFIED_CONNECTOR", status: yieldStatus, expected_return_pct: yieldData.bestEarn?.apy ?? null, metadata: yieldData.bestEarn ? { best: yieldData.bestEarn, apy_is_annualized: true, execution: "NONE" } : { reason: yieldError || "No qualifying stablecoin lending candidate." } },
      { strategy_key: "farming_lp", mode: "RESEARCH", source: yieldData.bestFarm ? "DEFILLAMA_YIELDS" : "NO_VERIFIED_CONNECTOR", status: farmingStatus, expected_return_pct: yieldData.bestFarm?.apy ?? null, metadata: yieldData.bestFarm ? { best: yieldData.bestFarm, top: yieldData.farms, apy_is_annualized: true, impermanent_loss_risk: yieldData.bestFarm.ilRisk, execution: "NONE" } : { reason: yieldError || "No qualifying stablecoin farm." } },
      { strategy_key: "arbitrage", mode: "PAPER", source: bestArb ? "BINANCE_MEXC_PUBLIC_BOOK" : "PUBLIC_BOOK_BLOCKED", status: arbitrageStatus, expected_return_pct: bestArb?.grossSpreadPct ?? null, metadata: bestArb ? { quotes: arbRows, best: bestArb, costs_included: false, note: "Gross bid/ask spread only. Fees, slippage, withdrawal cost and latency not included." } : { errors: arbErrors } },
      { strategy_key: "prediction_markets", mode: "RESEARCH", source: polymarketData.candidates.length ? polymarketData.source : "POLYMARKET_PUBLIC_UNAVAILABLE", status: polymarketStatus, expected_return_pct: null, metadata: polymarketData.candidates.length ? { markets: polymarketData.candidates, top_liquid: polymarketData.top, execution: "NONE", geoblock_required_before_trading: true, political_markets_excluded: true, filter: polymarketData.filter } : { reason: polymarketError || "No qualifying non-political Polymarket markets." } },
      { strategy_key: "copy_trading", mode: "PAPER", source: "NO_VERIFIED_TRADER", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "No verified source trader connected." } },
      { strategy_key: "referral", mode: "RESEARCH", source: "ANBAYBOT", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Revenue recognized only after actual commission payment." } },
      { strategy_key: "saas", mode: "RESEARCH", source: "ANBAYBOT", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Revenue recognized only after actual subscription payment." } },
    ].map(run => ({ ...run, run_bucket: bucket }));

    const { error: insertError } = await client.from("strategy_scan_runs").upsert(runs, { onConflict: "run_bucket,strategy_key" });
    if (insertError) throw insertError;

    for (const row of fundingRows) {
      const annualized = row.horizonDays > 0 ? row.grossPct * (365 / row.horizonDays) : null;
      await client.from("revenue_strategy_snapshots").insert({
        environment: "PAPER", strategy: "FUNDING_CAPTURE", source: "BINANCE_PUBLIC", venue: "BINANCE_FUTURES", asset: row.symbol,
        horizon_days: row.horizonDays, gross_return_pct: row.grossPct, total_cost_pct: null, net_return_pct: null,
        annualized_simple_pct: annualized, evidence_quality: "HISTORICAL_VERIFIED",
        inputs: { funding_count: row.count, last_funding_pct: row.lastFundingPct, window_start: row.windowStart, window_end: row.windowEnd },
        notes: "Historical gross funding observed; not net of fees or basis risk and not a future-profit promise.",
      });
    }

    if (yieldData.bestEarn) {
      await client.from("revenue_strategy_snapshots").insert({
        environment: "PAPER", strategy: "EARN", source: "DEFILLAMA_YIELDS", venue: yieldData.bestEarn.project, asset: yieldData.bestEarn.symbol,
        horizon_days: 365, gross_return_pct: yieldData.bestEarn.apy, total_cost_pct: null, net_return_pct: null,
        annualized_simple_pct: yieldData.bestEarn.apy, evidence_quality: "PAPER", capital_eur: null, scenario_pnl_eur: null,
        inputs: { chain: yieldData.bestEarn.chain, pool: yieldData.bestEarn.pool, tvl_usd: yieldData.bestEarn.tvlUsd, il_risk: yieldData.bestEarn.ilRisk },
        notes: "Public APY snapshot only. No deposit executed; smart-contract, stablecoin and protocol risks remain.",
      });
    }

    if (yieldData.bestFarm) {
      await client.from("revenue_strategy_snapshots").insert({
        environment: "PAPER", strategy: "FARMING", source: "DEFILLAMA_YIELDS", venue: yieldData.bestFarm.project, asset: yieldData.bestFarm.symbol,
        horizon_days: 365, gross_return_pct: yieldData.bestFarm.apy, total_cost_pct: null, net_return_pct: null,
        annualized_simple_pct: yieldData.bestFarm.apy, evidence_quality: "PAPER", capital_eur: null, scenario_pnl_eur: null,
        inputs: { chain: yieldData.bestFarm.chain, pool: yieldData.bestFarm.pool, tvl_usd: yieldData.bestFarm.tvlUsd, il_risk: yieldData.bestFarm.ilRisk },
        notes: "Public farming APY snapshot only. No deposit executed; impermanent loss and protocol risks may apply.",
      });
    }

    const now = new Date().toISOString();
    await client.from("strategy_catalog").update({ last_verified_at: now, updated_at: now }).in("strategy_key", ["funding_capture", "futures_directional", "spot_momentum", "grid_dca", "arbitrage", "earn_staking", "lending", "farming_lp"]);
    if (bestArb) await client.from("strategy_catalog").update({ status: "DATA_READY", note: "Bid/ask Binance↔MEXC mesuré. Spread brut seulement; coûts et latence restent à soustraire." }).eq("strategy_key", "arbitrage");
    if (yieldData.bestEarn) await client.from("strategy_catalog").update({ status: "DATA_READY", note: "APY public stablecoin détecté. Analyse seulement; aucun dépôt automatique." }).in("strategy_key", ["earn_staking", "lending"]);
    if (yieldData.bestFarm) await client.from("strategy_catalog").update({ status: "DATA_READY", note: "APY farming public détecté. IL/protocole à évaluer avant toute allocation." }).eq("strategy_key", "farming_lp");
    if (polymarketData.candidates.length) await client.from("strategy_catalog").update({
      status: "DATA_READY",
      execution_mode: "RESEARCH",
      venue: "POLYMARKET",
      connection_required: ["POLYMARKET_GEO_ELIGIBILITY","POLYMARKET_WALLET_AUTH"],
      note: "API publique Polymarket connectée en lecture. Marchés politiques exclus du scanner. Aucun ordre; géoblocage à vérifier côté utilisateur avant toute exécution."
    }).eq("strategy_key", "prediction_markets");

    await client.from("audit_ledger").insert({
      severity: bestFunding || strongest || bestArb || yieldData.bestEarn ? "INFO" : "WARNING",
      event_type: "REVENUE_SCAN_COMPLETED", actor_type: "JOB", source: "revenue-scanner-v6", source_ref: `${bucket}:${Date.now()}`,
      sanitized_payload: {
        bucket,
        strategies: runs.length,
        funding_status: fundingStatus,
        market_status: marketStatus,
        arbitrage_status: arbitrageStatus,
        yield_status: yieldStatus,
        farming_status: farmingStatus,
        polymarket_status: polymarketStatus,
        capital_observed_usd: capitalObservedUsd,
        bestFunding: bestFunding ? { symbol: bestFunding.symbol, grossPct: bestFunding.grossPct } : null,
        strongest24h: strongest ? { symbol: strongest.symbol, changePct: strongest.change24hPct } : null,
        bestArbitrage: bestArb,
        bestYield: yieldData.bestEarn,
        bestFarm: yieldData.bestFarm,
      polymarket: polymarketData,
        polymarket: { count: polymarketData.candidates.length, top: polymarketData.top, political_markets_excluded: true },
      },
    });

    return json({
      status: "ok",
      bucket,
      strategies: runs.length,
      fundingStatus,
      marketStatus,
      arbitrageStatus,
      yieldStatus,
      farmingStatus,
      polymarketStatus,
      capitalObservedUsd,
      yieldHourlyGrossUsd,
      bestFunding: bestFunding ? { symbol: bestFunding.symbol, grossPct: bestFunding.grossPct } : null,
      strongest24h: strongest ? { symbol: strongest.symbol, changePct: strongest.change24hPct } : null,
      bestArbitrage: bestArb,
      bestYield: yieldData.bestEarn,
      bestFarm: yieldData.bestFarm,
      liveExecution: false,
    });
  } catch (error) {
    console.error("[revenue-scanner]", error);
    return json({ error: error instanceof Error ? error.message : "scanner_failed" }, 500);
  }
});
