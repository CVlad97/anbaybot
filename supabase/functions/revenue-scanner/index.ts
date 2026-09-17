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
  return createClient(url, key, { global: { headers: { "X-Client-Info": "anbaybot-revenue-scanner-v3" } } });
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

    const bestFunding = fundingRows.length ? [...fundingRows].sort((a, b) => b.grossPct - a.grossPct)[0] : null;
    const strongest = market.length ? [...market].sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))[0] : null;
    const bestArb = arbRows.length ? [...arbRows].sort((a, b) => b.grossSpreadPct - a.grossSpreadPct)[0] : null;
    const fundingStatus = bestFunding ? "DATA_READY" : "UNVERIFIED";
    const marketStatus = strongest ? "PAPER_READY" : "UNVERIFIED";
    const arbitrageStatus = bestArb ? "DATA_READY" : "UNVERIFIED";

    const runs = [
      { strategy_key: "funding_capture", mode: "PAPER", source: bestFunding ? "BINANCE_PUBLIC" : "BINANCE_PUBLIC_BLOCKED", status: fundingStatus, expected_return_pct: bestFunding?.grossPct ?? null, metadata: bestFunding ? { assets: fundingRows, best_asset: bestFunding.symbol, costs_included: false } : { errors: fundingErrors } },
      { strategy_key: "futures_directional", mode: "PAPER", source: "MEXC_PUBLIC", status: marketStatus, expected_return_pct: null, metadata: { market, strongest_asset: strongest?.symbol ?? null, strongest_24h_pct: strongest?.change24hPct ?? null, errors: marketErrors, decision: "SCAN_ONLY" } },
      { strategy_key: "spot_momentum", mode: "PAPER", source: "MEXC_PUBLIC", status: marketStatus, expected_return_pct: null, metadata: { market, strongest_asset: strongest?.symbol ?? null, strongest_24h_pct: strongest?.change24hPct ?? null, errors: marketErrors, decision: "SCAN_ONLY" } },
      { strategy_key: "grid_dca", mode: "PAPER", source: "MEXC_PUBLIC", status: marketStatus, expected_return_pct: null, metadata: { market, errors: marketErrors, decision: "SCAN_ONLY" } },
      { strategy_key: "earn_staking", mode: "RESEARCH", source: "NO_VERIFIED_CONNECTOR", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Current verified APY source not connected." } },
      { strategy_key: "lending", mode: "RESEARCH", source: "NO_VERIFIED_CONNECTOR", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Current lending APY source not connected." } },
      { strategy_key: "farming_lp", mode: "RESEARCH", source: "NO_VERIFIED_CONNECTOR", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Current APR, IL and protocol risk source not connected." } },
      { strategy_key: "arbitrage", mode: "PAPER", source: bestArb ? "BINANCE_MEXC_PUBLIC_BOOK" : "PUBLIC_BOOK_BLOCKED", status: arbitrageStatus, expected_return_pct: bestArb?.grossSpreadPct ?? null, metadata: bestArb ? { quotes: arbRows, best: bestArb, costs_included: false, note: "Gross bid/ask spread only. Fees, slippage, withdrawal cost and latency not included." } : { errors: arbErrors } },
      { strategy_key: "prediction_markets", mode: "RESEARCH", source: "NO_VERIFIED_CONNECTOR", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Polymarket/prediction live connector not verified." } },
      { strategy_key: "copy_trading", mode: "PAPER", source: "NO_VERIFIED_TRADER", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "No verified source trader connected." } },
      { strategy_key: "referral", mode: "RESEARCH", source: "ANBAYBOT", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Revenue recognized only after actual commission payment." } },
      { strategy_key: "saas", mode: "RESEARCH", source: "ANBAYBOT", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Revenue recognized only after actual subscription payment." } },
    ].map(run => ({ ...run, run_bucket: bucket }));

    const { error: insertError } = await client.from("strategy_scan_runs").upsert(runs, { onConflict: "run_bucket,strategy_key" });
    if (insertError) throw insertError;

    for (const row of fundingRows) {
      const annualized = row.horizonDays > 0 ? row.grossPct * (365 / row.horizonDays) : null;
      await client.from("revenue_strategy_snapshots").insert({
        environment: "HISTORICAL", strategy: "FUNDING_CAPTURE", source: "BINANCE_PUBLIC", venue: "BINANCE_FUTURES", asset: row.symbol,
        horizon_days: row.horizonDays, gross_return_pct: row.grossPct, total_cost_pct: null, net_return_pct: null,
        annualized_simple_pct: annualized, evidence_quality: "HISTORICAL_VERIFIED",
        inputs: { funding_count: row.count, last_funding_pct: row.lastFundingPct, window_start: row.windowStart, window_end: row.windowEnd },
        notes: "Gross funding only; not net of fees or basis risk and not a future-profit promise.",
      });
    }

    const now = new Date().toISOString();
    await client.from("strategy_catalog").update({ last_verified_at: now, updated_at: now }).in("strategy_key", ["funding_capture", "futures_directional", "spot_momentum", "grid_dca", "arbitrage"]);
    if (bestArb) await client.from("strategy_catalog").update({ status: "DATA_READY", note: "Bid/ask Binance↔MEXC mesuré. Spread brut seulement; coûts et latence restent à soustraire." }).eq("strategy_key", "arbitrage");

    await client.from("audit_ledger").insert({
      severity: bestFunding || strongest || bestArb ? "INFO" : "WARNING", event_type: "REVENUE_SCAN_COMPLETED", actor_type: "JOB", source: "revenue-scanner-v3", source_ref: `${bucket}:${Date.now()}`,
      sanitized_payload: { bucket, strategies: runs.length, funding_status: fundingStatus, market_status: marketStatus, arbitrage_status: arbitrageStatus, bestFunding: bestFunding ? { symbol: bestFunding.symbol, grossPct: bestFunding.grossPct } : null, strongest24h: strongest ? { symbol: strongest.symbol, changePct: strongest.change24hPct } : null, bestArbitrage: bestArb },
    });

    return json({
      status: "ok", bucket, strategies: runs.length, fundingStatus, marketStatus, arbitrageStatus,
      bestFunding: bestFunding ? { symbol: bestFunding.symbol, grossPct: bestFunding.grossPct } : null,
      strongest24h: strongest ? { symbol: strongest.symbol, changePct: strongest.change24hPct } : null,
      bestArbitrage: bestArb,
      liveExecution: false,
    });
  } catch (error) {
    console.error("[revenue-scanner]", error);
    return json({ error: error instanceof Error ? error.message : "scanner_failed" }, 500);
  }
});
