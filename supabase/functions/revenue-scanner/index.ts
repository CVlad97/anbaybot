import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function db() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("supabase_server_credentials_missing");
  return createClient(url, key, { global: { headers: { "X-Client-Info": "anbaybot-revenue-scanner-v2" } } });
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
  const row = await fetchJson<{ lastPrice?: string; priceChangePercent?: string; quoteVolume?: string }>(
    `https://api.mexc.com/api/v3/ticker/24hr?symbol=${symbol}`,
  );
  return {
    symbol,
    lastPrice: Number(row.lastPrice || 0),
    change24hPct: Number(row.priceChangePercent || 0),
    quoteVolume: Number(row.quoteVolume || 0),
  };
}

Deno.serve(async req => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const client = db();
    const bucket = bucketHour();
    const { data: existing, error: existingError } = await client.from("strategy_scan_runs").select("strategy_key").eq("run_bucket", bucket);
    if (existingError) throw existingError;
    if ((existing || []).length >= 12) return json({ status: "already_scanned", bucket, count: existing?.length || 0 });

    const fundingSettled = await Promise.allSettled(["BTCUSDT", "ETHUSDT", "SOLUSDT"].map(funding));
    const fundingRows = fundingSettled
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof funding>>> => r.status === "fulfilled")
      .map(r => r.value);
    const fundingErrors = fundingSettled
      .filter(r => r.status === "rejected")
      .map(r => r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : "");

    const marketSettled = await Promise.allSettled(["BTCUSDT", "ETHUSDT", "SOLUSDT"].map(ticker));
    const market = marketSettled
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof ticker>>> => r.status === "fulfilled")
      .map(r => r.value);
    const marketErrors = marketSettled
      .filter(r => r.status === "rejected")
      .map(r => r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : "");

    const best = fundingRows.length ? [...fundingRows].sort((a, b) => b.grossPct - a.grossPct)[0] : null;
    const strongest = market.length ? [...market].sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))[0] : null;
    const fundingStatus = best ? "DATA_READY" : "UNVERIFIED";
    const marketStatus = strongest ? "PAPER_READY" : "UNVERIFIED";

    const runs = [
      { strategy_key: "funding_capture", mode: "PAPER", source: best ? "BINANCE_PUBLIC" : "BINANCE_PUBLIC_BLOCKED", status: fundingStatus, expected_return_pct: best?.grossPct ?? null, metadata: best ? { assets: fundingRows, best_asset: best.symbol, costs_included: false } : { errors: fundingErrors, reason: "Funding source unavailable from scanner region; no return inferred." } },
      { strategy_key: "futures_directional", mode: "PAPER", source: "MEXC_PUBLIC", status: marketStatus, expected_return_pct: null, metadata: { market, strongest_asset: strongest?.symbol ?? null, strongest_24h_pct: strongest?.change24hPct ?? null, errors: marketErrors, decision: "SCAN_ONLY" } },
      { strategy_key: "spot_momentum", mode: "PAPER", source: "MEXC_PUBLIC", status: marketStatus, expected_return_pct: null, metadata: { market, strongest_asset: strongest?.symbol ?? null, strongest_24h_pct: strongest?.change24hPct ?? null, errors: marketErrors, decision: "SCAN_ONLY" } },
      { strategy_key: "grid_dca", mode: "PAPER", source: "MEXC_PUBLIC", status: marketStatus, expected_return_pct: null, metadata: { market, errors: marketErrors, decision: "SCAN_ONLY" } },
      { strategy_key: "earn_staking", mode: "RESEARCH", source: "NO_VERIFIED_CONNECTOR", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Current verified APY source not connected." } },
      { strategy_key: "lending", mode: "RESEARCH", source: "NO_VERIFIED_CONNECTOR", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Current lending APY source not connected." } },
      { strategy_key: "farming_lp", mode: "RESEARCH", source: "NO_VERIFIED_CONNECTOR", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Current APR, IL and protocol risk source not connected." } },
      { strategy_key: "arbitrage", mode: "PAPER", source: "PARTIAL_MARKET_DATA", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Executable quotes plus all fees and transfer latency are required." } },
      { strategy_key: "prediction_markets", mode: "RESEARCH", source: "NO_VERIFIED_CONNECTOR", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Polymarket/prediction live connector not verified." } },
      { strategy_key: "copy_trading", mode: "PAPER", source: "NO_VERIFIED_TRADER", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "No verified source trader connected." } },
      { strategy_key: "referral", mode: "RESEARCH", source: "ANBAYBOT", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Revenue recognized only after actual commission payment." } },
      { strategy_key: "saas", mode: "RESEARCH", source: "ANBAYBOT", status: "UNVERIFIED", expected_return_pct: null, metadata: { reason: "Revenue recognized only after actual subscription payment." } },
    ].map(run => ({ ...run, run_bucket: bucket }));

    const { error: insertError } = await client.from("strategy_scan_runs").upsert(runs, { onConflict: "run_bucket,strategy_key", ignoreDuplicates: true });
    if (insertError) throw insertError;

    for (const row of fundingRows) {
      const annualized = row.horizonDays > 0 ? row.grossPct * (365 / row.horizonDays) : null;
      await client.from("revenue_strategy_snapshots").insert({
        environment: "HISTORICAL",
        strategy: "FUNDING_CAPTURE",
        source: "BINANCE_PUBLIC",
        venue: "BINANCE_FUTURES",
        asset: row.symbol,
        horizon_days: row.horizonDays,
        gross_return_pct: row.grossPct,
        total_cost_pct: null,
        net_return_pct: null,
        annualized_simple_pct: annualized,
        evidence_quality: "HISTORICAL_VERIFIED",
        inputs: { funding_count: row.count, last_funding_pct: row.lastFundingPct, window_start: row.windowStart, window_end: row.windowEnd },
        notes: "Gross funding only; not net of fees or basis risk and not a future-profit promise.",
      });
    }

    await client.from("strategy_catalog").update({ last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in("strategy_key", ["funding_capture", "futures_directional", "spot_momentum", "grid_dca"]);
    await client.from("audit_ledger").insert({
      severity: best || strongest ? "INFO" : "WARNING",
      event_type: "REVENUE_SCAN_COMPLETED",
      actor_type: "JOB",
      source: "revenue-scanner",
      source_ref: bucket,
      sanitized_payload: {
        bucket,
        strategies: runs.length,
        funding_status: fundingStatus,
        market_status: marketStatus,
        bestFunding: best ? { symbol: best.symbol, grossPct: best.grossPct } : null,
        strongest24h: strongest ? { symbol: strongest.symbol, changePct: strongest.change24hPct } : null,
      },
    });

    return json({
      status: "ok",
      bucket,
      strategies: runs.length,
      fundingStatus,
      marketStatus,
      bestFunding: best ? { symbol: best.symbol, grossPct: best.grossPct } : null,
      strongest24h: strongest ? { symbol: strongest.symbol, changePct: strongest.change24hPct } : null,
      liveExecution: false,
    });
  } catch (error) {
    console.error("[revenue-scanner]", error);
    return json({ error: error instanceof Error ? error.message : "scanner_failed" }, 500);
  }
});
