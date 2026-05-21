import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type Severity = "info" | "warning" | "error";
type ValidationIssue = { field: string; message: string; severity: Severity };
type SupabaseClient = ReturnType<typeof createClient>;

const DEFAULT_ORIGINS = [
  "https://cvlad97.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function allowedOrigins() {
  const fromEnv = (Deno.env.get("ANBAYBOT_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ORIGINS;
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = allowedOrigins();
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Anbaybot-Admin-Token",
    "Vary": "Origin",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function routeFromUrl(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("path") || "";
}

function isPublicRoute(path: string) {
  return [
    "health",
    "trading/prices",
    "market/trending",
    "market/dex-movers",
    "market/token-search",
  ].includes(path);
}

function requireAdmin(req: Request, path: string) {
  if (isPublicRoute(path)) return null;
  const expected = Deno.env.get("ANBAYBOT_ADMIN_TOKEN") || "";
  if (!expected) {
    return json(req, {
      error: "ANBAYBOT_ADMIN_TOKEN missing",
      message: "Configure the Edge Function secret before using the real cockpit.",
    }, 503);
  }

  const token = req.headers.get("X-Anbaybot-Admin-Token") || "";
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (token !== expected && bearer !== expected) {
    return json(req, { error: "Unauthorized", message: "Cockpit admin token required." }, 401);
  }
  return null;
}

function supabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  return createClient(url, serviceRole, {
    global: { headers: { "X-Client-Info": "anbaybot-edge" } },
  });
}

async function audit(supabase: SupabaseClient, event: string, meta: Record<string, unknown> = {}) {
  await supabase.from("audit_logs").insert({ event, meta }).throwOnError();
}

function getRiskParams(settingsRow: Record<string, unknown> | null | undefined) {
  return {
    maxTradeSizeEur: 10,
    maxTradesPerDay: 3,
    maxSlippageBps: 100,
    tokenBlacklist: [] as string[],
    minLiquidityUsd: 10000,
    ...((settingsRow?.risk_params as Record<string, unknown> | undefined) || {}),
  };
}

type DexPair = {
  chainId?: string;
  pairAddress?: string;
  url?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  quoteToken?: { address?: string; symbol?: string; name?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
};

function dexscreenerQueries() {
  const raw = Deno.env.get("DEXSCREENER_MOVER_QUERIES");
  if (!raw) return ["SOL/USDC", "SOL/USDT", "BONK", "WIF", "JUP", "RAY"];
  return raw.split(",").map((q) => q.trim()).filter(Boolean);
}

function dexscreenerChainFilter() {
  return (Deno.env.get("DEXSCREENER_CHAIN_FILTER") || "solana").trim().toLowerCase();
}

function pairScore(pair: DexPair) {
  const liquidity = Number(pair.liquidity?.usd || 0);
  const volume = Number(pair.volume?.h24 || 0);
  const change = Math.abs(Number(pair.priceChange?.h24 || 0));
  return liquidity * 0.55 + volume * 0.4 + change * 200;
}

function uniqPairKey(pair: DexPair) {
  return `${pair.chainId || "unknown"}:${pair.pairAddress || pair.url || pair.baseToken?.address || pair.baseToken?.symbol || Math.random().toString(36)}`;
}

function normalizeDexPairs(input: unknown) {
  const rows = Array.isArray(input) ? input : [];
  return rows as DexPair[];
}

async function fetchDexSearchPairs(query: string) {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DexScreener search ${res.status}`);
  const json = await res.json() as { pairs?: unknown[] };
  const pairs = normalizeDexPairs(json.pairs);
  const chain = dexscreenerChainFilter();
  return pairs.filter((pair) => {
    if (!pair.pairAddress) return false;
    if (!chain) return true;
    return String(pair.chainId || "").toLowerCase() === chain;
  });
}

async function fetchDexMovers(limit = 20) {
  const queries = dexscreenerQueries();
  const settled = await Promise.allSettled(queries.map((query) => fetchDexSearchPairs(query)));
  const merged = [] as DexPair[];
  for (const item of settled) {
    if (item.status === "fulfilled") merged.push(...item.value);
  }
  const deduped = new Map<string, DexPair>();
  for (const pair of merged) deduped.set(uniqPairKey(pair), pair);
  return Array.from(deduped.values())
    .sort((a, b) => pairScore(b) - pairScore(a))
    .slice(0, limit);
}

async function getSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: inserted, error: insertError } = await supabase
    .from("settings")
    .insert({
      kill_switch: true,
      risk_params: {
        maxTradeSizeEur: 10,
        maxTradesPerDay: 3,
        maxSlippageBps: 100,
        tokenBlacklist: [],
        minLiquidityUsd: 10000,
      },
      payout_threshold_eur: 150,
    })
    .select("*")
    .single();
  if (insertError) throw insertError;
  return inserted;
}

function binanceBaseUrl() {
  return Deno.env.get("BINANCE_BASE_URL") || "https://api.binance.com";
}

async function hmacSha256(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function binanceSignedRequest(method: "GET" | "POST", path: string, params: Record<string, string | number | boolean> = {}) {
  const apiKey = Deno.env.get("BINANCE_API_KEY");
  const apiSecret = Deno.env.get("BINANCE_API_SECRET");
  if (!apiKey || !apiSecret) {
    throw new Error("BINANCE_API_KEY or BINANCE_API_SECRET missing");
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) search.set(key, String(value));
  search.set("timestamp", String(Date.now()));
  search.set("recvWindow", Deno.env.get("BINANCE_RECV_WINDOW") || "5000");
  const query = search.toString();
  const signature = await hmacSha256(apiSecret, query);
  const url = `${binanceBaseUrl()}${path}?${query}&signature=${signature}`;

  const response = await fetch(url, {
    method,
    headers: { "X-MBX-APIKEY": apiKey },
  });
  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "msg" in payload ? String((payload as { msg: unknown }).msg) : text;
    throw new Error(`Binance ${response.status}: ${message}`);
  }
  return payload;
}

async function getBinancePrices() {
  const symbols = (Deno.env.get("BINANCE_ALLOWED_SYMBOLS") || "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  const prices = [] as Array<{ symbol: string; lastPrice: number; priceChangePercent: number; quoteVolume: number }>;
  for (const symbol of symbols) {
    try {
      const res = await fetch(`${binanceBaseUrl()}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      prices.push({
        symbol,
        lastPrice: Number(data.lastPrice || 0),
        priceChangePercent: Number(data.priceChangePercent || 0),
        quoteVolume: Number(data.quoteVolume || 0),
      });
    } catch {
      prices.push({ symbol, lastPrice: 0, priceChangePercent: 0, quoteVolume: 0 });
    }
  }
  return prices;
}

async function getAllPriceMap() {
  const res = await fetch(`${binanceBaseUrl()}/api/v3/ticker/price`);
  const rows = await res.json() as Array<{ symbol: string; price: string }>;
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.symbol, Number(row.price || 0));
  return map;
}

function stableUsdValue(asset: string, amount: number) {
  return ["USDT", "USDC", "BUSD", "FDUSD", "TUSD", "DAI"].includes(asset) ? amount : null;
}

async function getBinanceAccountSnapshot() {
  const apiKey = Deno.env.get("BINANCE_API_KEY");
  const apiSecret = Deno.env.get("BINANCE_API_SECRET");
  if (!apiKey || !apiSecret) {
    return {
      totalAccountValueUsd: 0,
      freeStableUsd: 0,
      tradableCapitalUsd: 0,
      canTradeLive: false,
      missingConfig: true,
      assets: [],
      note: "Binance server credentials missing. Configure Edge Function secrets; never put keys in GitHub Pages.",
    };
  }

  const [account, priceMap] = await Promise.all([
    binanceSignedRequest("GET", "/api/v3/account"),
    getAllPriceMap(),
  ]);
  const balances = ((account as { balances?: Array<{ asset: string; free: string; locked: string }> }).balances || [])
    .map((row) => ({
      asset: row.asset,
      free: Number(row.free || 0),
      locked: Number(row.locked || 0),
    }))
    .filter((row) => row.free > 0 || row.locked > 0);

  let totalAccountValueUsd = 0;
  let freeStableUsd = 0;
  const assets = [] as Array<{ asset: string; free: number; locked: number; usdValue: number; priceUsd: number }>;

  for (const balance of balances) {
    const total = balance.free + balance.locked;
    const stable = stableUsdValue(balance.asset, total);
    const freeStable = stableUsdValue(balance.asset, balance.free);
    const priceUsd = stable !== null ? 1 : priceMap.get(`${balance.asset}USDT`) || 0;
    const usdValue = total * priceUsd;
    if (freeStable !== null) freeStableUsd += freeStable;
    if (usdValue > 0) {
      totalAccountValueUsd += usdValue;
      assets.push({ ...balance, usdValue, priceUsd });
    }
  }

  const maxCapitalPct = Number(Deno.env.get("ANBAYBOT_MAX_STABLE_CAPITAL_PCT") || "0.9");
  return {
    totalAccountValueUsd,
    freeStableUsd,
    tradableCapitalUsd: Math.max(0, freeStableUsd * maxCapitalPct),
    canTradeLive: Deno.env.get("ALLOW_LIVE_TRADING") === "true",
    missingConfig: false,
    assets: assets.sort((a, b) => b.usdValue - a.usdValue).slice(0, 30),
    note: Deno.env.get("ALLOW_LIVE_TRADING") === "true"
      ? "Live trading switch enabled server-side; each live order still requires explicit confirmation."
      : "Real Binance account connected in server mode. Live trading remains disabled unless ALLOW_LIVE_TRADING=true.",
  };
}

function baseSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/USDT$/, "");
}

function computeRecommendation(
  prices: Array<{ symbol: string; lastPrice: number; priceChangePercent: number; quoteVolume: number }>,
  tradableCapitalUsd: number,
) {
  const liquid = prices.filter((row) => row.lastPrice > 0 && row.quoteVolume > 0);
  const sorted = [...liquid].sort((a, b) => b.priceChangePercent - a.priceChangePercent);
  const selected = sorted[0] || { symbol: "BTCUSDT", priceChangePercent: 0, lastPrice: 0, quoteVolume: 0 };
  const action = tradableCapitalUsd > 0 && selected.priceChangePercent >= Number(Deno.env.get("ANBAYBOT_MIN_MOMENTUM_PCT") || "2")
    ? "BUY"
    : "WAIT";

  return {
    action,
    symbol: baseSymbol(selected.symbol),
    side: action === "BUY" ? "BUY" : "HOLD",
    amountUsd: action === "BUY" ? Math.min(tradableCapitalUsd, Number(Deno.env.get("MAX_TRADE_USDT") || "10")) : 0,
    confidence: Math.max(35, Math.min(80, Math.round(Math.abs(selected.priceChangePercent) * 8 + 35))),
    momentum: Number(selected.priceChangePercent.toFixed(2)),
    reasoning: [
      `${selected.symbol} 24h change ${selected.priceChangePercent.toFixed(2)}%`,
      `Quote volume ${Math.round(selected.quoteVolume).toLocaleString()} USDT`,
      action === "WAIT" ? "No server-approved trade edge right now" : "Momentum candidate only; risk gates still apply",
    ],
    timestamp: new Date().toISOString(),
  };
}

async function getTradingSnapshot(supabase: SupabaseClient) {
  const settings = await getSettings(supabase);
  const prices = await getBinancePrices();
  const account = await getBinanceAccountSnapshot();
  const risk = getRiskParams(settings);
  const maxOrderUsd = Math.max(0, Math.min(account.tradableCapitalUsd, Number(risk.maxTradeSizeEur)));
  const recommendation = computeRecommendation(prices, account.tradableCapitalUsd);
  const liveCredentialsPresent = !account.missingConfig;
  const liveTradingEnabled = liveCredentialsPresent && Deno.env.get("ALLOW_LIVE_TRADING") === "true";
  const issues: ValidationIssue[] = [
    ...(settings.kill_switch ? [{ field: "killSwitch", message: "Kill switch active", severity: "error" as const }] : []),
    ...(liveCredentialsPresent ? [] : [{ field: "binance", message: "Binance server credentials missing", severity: "error" as const }]),
    ...(account.tradableCapitalUsd <= 0 ? [{ field: "capital", message: "No free stable capital available", severity: "warning" as const }] : []),
  ];

  return {
    updatedAt: new Date().toISOString(),
    settings,
    prices,
    account,
    recommendation,
    validation: {
      passed: issues.every((issue) => issue.severity !== "error"),
      canSubmit: issues.every((issue) => issue.severity !== "error") && maxOrderUsd > 0,
      killSwitchActive: Boolean(settings.kill_switch),
      liveTradingEnabled,
      tradableCapitalUsd: account.tradableCapitalUsd,
      maxOrderUsd,
      symbol: recommendation.symbol,
      side: recommendation.side === "HOLD" ? "BUY" : recommendation.side,
      amountUsd: recommendation.amountUsd,
      issues,
    },
    pnl: {
      totalValueUsd: account.totalAccountValueUsd,
      pnlUsd: 0,
      pnlPct: 0,
      sinceLabel: "real-account",
    },
    liveTradingReady: liveTradingEnabled && !settings.kill_switch && account.tradableCapitalUsd > 0,
  };
}

function normalizeOrderSymbol(symbol: string) {
  const raw = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.endsWith("USDT") ? raw : `${raw}USDT`;
}

function validateOrderBody(
  body: Record<string, unknown>,
  snapshot: Awaited<ReturnType<typeof getTradingSnapshot>>,
) {
  const symbol = normalizeOrderSymbol(String(body.symbol || ""));
  const side = String(body.side || "BUY").toUpperCase();
  const amountUsd = Number(body.amountUsd || 0);
  const allowedSymbols = (Deno.env.get("BINANCE_ALLOWED_SYMBOLS") || "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT")
    .split(",")
    .map((item) => item.trim().toUpperCase());
  const issues: ValidationIssue[] = [...snapshot.validation.issues];

  if (!allowedSymbols.includes(symbol)) issues.push({ field: "symbol", message: `${symbol} is not allowed`, severity: "error" });
  if (!["BUY", "SELL"].includes(side)) issues.push({ field: "side", message: "Only BUY or SELL is supported", severity: "error" });
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) issues.push({ field: "amountUsd", message: "Amount must be positive", severity: "error" });
  if (amountUsd > snapshot.validation.maxOrderUsd) issues.push({ field: "amountUsd", message: "Order exceeds max server-side limit", severity: "error" });
  if (amountUsd > snapshot.account.tradableCapitalUsd) issues.push({ field: "capital", message: "Not enough free stable capital", severity: "error" });
  if (side === "SELL") issues.push({ field: "side", message: "SELL by USD amount is blocked until exact quantity handling is implemented", severity: "error" });

  return {
    symbol,
    side: side as "BUY" | "SELL",
    amountUsd,
    issues,
    passed: issues.every((issue) => issue.severity !== "error"),
  };
}

async function listTable(supabase: SupabaseClient, table: string, orderColumn = "created_at", ascending = false, limit = 100) {
  const { data, error } = await supabase.from(table).select("*").order(orderColumn, { ascending }).limit(limit);
  if (error) throw error;
  return data || [];
}

Deno.serve(async (req: Request) => {
  const path = routeFromUrl(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders(req) });

  const authError = requireAdmin(req, path);
  if (authError) return authError;

  try {
    if (path === "health") {
      return json(req, {
        status: "ok",
        mode: "real_edge",
        supabaseConfigured: Boolean(Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
        adminAuthConfigured: Boolean(Deno.env.get("ANBAYBOT_ADMIN_TOKEN")),
        binanceConfigured: Boolean(Deno.env.get("BINANCE_API_KEY") && Deno.env.get("BINANCE_API_SECRET")),
        liveTradingEnabled: Deno.env.get("ALLOW_LIVE_TRADING") === "true",
        timestamp: new Date().toISOString(),
      });
    }

    if (path === "trading/prices") return json(req, { data: await getBinancePrices() });

    const supabase = supabaseClient();

    if (path === "config") {
      if (req.method === "PUT") {
        const body = await req.json();
        const current = await getSettings(supabase);
        const { error } = await supabase
          .from("settings")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", current.id);
        if (error) throw error;
        await audit(supabase, "settings_updated", body);
        return json(req, { success: true });
      }
      return json(req, { data: await getSettings(supabase) });
    }

    if (path === "kill" && req.method === "POST") {
      const body = await req.json();
      const current = await getSettings(supabase);
      const kill = Boolean(body.kill);
      const { error } = await supabase
        .from("settings")
        .update({ kill_switch: kill, updated_at: new Date().toISOString() })
        .eq("id", current.id);
      if (error) throw error;
      await audit(supabase, kill ? "kill_switch_activated" : "kill_switch_deactivated");
      return json(req, { kill_switch: kill });
    }

    if (path === "audit") return json(req, { data: await listTable(supabase, "audit_logs", "created_at", false, 200) });
    if (path === "wallets/list") return json(req, { data: await listTable(supabase, "managed_wallets") });
    if (path === "followed-wallets/list") return json(req, { data: await listTable(supabase, "followed_wallets", "score", false, 200) });
    if (path === "actions/list") return json(req, { data: await listTable(supabase, "actions", "created_at", false, 100) });
    if (path === "signals/list") return json(req, { data: await listTable(supabase, "signals", "created_at", false, 100) });

    if (path === "transactions/list") {
      const [transactions, actions] = await Promise.all([
        listTable(supabase, "transactions", "created_at", false, 50),
        listTable(supabase, "actions", "created_at", false, 100),
      ]);
      return json(req, { transactions, actions });
    }

    if (path === "wallets" && req.method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase.from("managed_wallets").insert(body).select("*").single();
      if (error) throw error;
      await audit(supabase, "wallet_added", { id: data.id, chain: data.chain, platform: data.platform });
      return json(req, { data }, 201);
    }

    const walletMatch = path.match(/^wallets\/([^/]+)$/);
    if (walletMatch) {
      const id = walletMatch[1];
      if (req.method === "PATCH") {
        const body = await req.json();
        const { error } = await supabase.from("managed_wallets").update(body).eq("id", id);
        if (error) throw error;
        await audit(supabase, "wallet_updated", { id, fields: Object.keys(body) });
        return json(req, { success: true });
      }
      if (req.method === "DELETE") {
        const { error } = await supabase.from("managed_wallets").delete().eq("id", id);
        if (error) throw error;
        await audit(supabase, "wallet_deleted", { id });
        return json(req, { success: true });
      }
    }

    if (path === "followed-wallets" && req.method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase.from("followed_wallets").insert(body).select("*").single();
      if (error) throw error;
      await audit(supabase, "followed_wallet_added", { id: data.id, chain: data.chain });
      return json(req, { data }, 201);
    }

    const followedMatch = path.match(/^followed-wallets\/([^/]+)$/);
    if (followedMatch) {
      const id = followedMatch[1];
      if (req.method === "PATCH") {
        const body = await req.json();
        const { error } = await supabase.from("followed_wallets").update(body).eq("id", id);
        if (error) throw error;
        await audit(supabase, "followed_wallet_updated", { id, fields: Object.keys(body) });
        return json(req, { success: true });
      }
      if (req.method === "DELETE") {
        const { error } = await supabase.from("followed_wallets").delete().eq("id", id);
        if (error) throw error;
        await audit(supabase, "followed_wallet_deleted", { id });
        return json(req, { success: true });
      }
    }

    if (path === "market/trending") {
      const res = await fetch("https://api.coingecko.com/api/v3/search/trending");
      const data = await res.json();
      return json(req, { items: (data.coins || []).map((coin: { item: unknown }) => coin.item) });
    }

    if (path === "market/dex-movers") {
      const items = await fetchDexMovers(20);
      return json(req, { items });
    }

    if (path === "market/token-search") {
      const q = new URL(req.url).searchParams.get("q") || "";
      if (!q) return json(req, { items: [] });
      const items = await fetchDexSearchPairs(q);
      return json(req, { items: items.slice(0, 20) });
    }

    if (path === "signals/run" && req.method === "POST") {
      const settings = await getSettings(supabase);
      if (settings.kill_switch) return json(req, { signalsCreated: 0, actionsCreated: 0, reason: "kill_switch_active" });
      const pairs = await fetchDexMovers(15);
      const risk = getRiskParams(settings);
      let signalsCreated = 0;
      let actionsCreated = 0;

      for (const pair of pairs) {
        const priceChange = Number(pair.priceChange?.h24 || 0);
        const volume = Number(pair.volume?.h24 || 0);
        const liquidity = Number(pair.liquidity?.usd || 0);
        const tokenAddress = pair.baseToken?.address || "";
        const tokenSymbol = pair.baseToken?.symbol || "";
        await supabase.from("signals").insert({
          source: "dexscreener",
          chain: "solana",
          token_address: tokenAddress,
          token_symbol: tokenSymbol,
          meta: { priceChange24h: priceChange, volume24h: volume, liquidityUsd: liquidity, priceUsd: pair.priceUsd },
        }).throwOnError();
        signalsCreated++;

        if (priceChange > 10 && volume > 30000 && liquidity >= Number(risk.minLiquidityUsd) && !risk.tokenBlacklist.includes(tokenAddress)) {
          await supabase.from("actions").insert({
            type: "ENTRY_PREPARED",
            status: "PREPARED",
            strategy_id: "momentum_dex",
            chain: "solana",
            payload: { tokenAddress, symbol: tokenSymbol, priceUsd: pair.priceUsd, priceChange24h: priceChange, volume24h: volume, liquidityUsd: liquidity },
            risk_checks: [
              { rule: "liquidity", passed: true, detail: `Liquidity ${liquidity}` },
              { rule: "volume", passed: true, detail: `Volume ${volume}` },
              { rule: "mode", passed: true, detail: "Prepared only. No autonomous live execution." },
            ],
          }).throwOnError();
          actionsCreated++;
        }
      }
      await audit(supabase, "signals_run_completed", { signalsCreated, actionsCreated });
      return json(req, { signalsCreated, actionsCreated });
    }

    if (path === "portfolio/balances") {
      const snapshot = await getTradingSnapshot(supabase);
      return json(req, {
        balances: [],
        totalValueUsd: snapshot.account.totalAccountValueUsd,
        pnlUsd: snapshot.pnl.pnlUsd,
        pnlPct: snapshot.pnl.pnlPct,
        prices: { sol: 0, eth: 0 },
      });
    }
    if (path === "portfolio/summary") return json(req, { data: null });
    if (path === "portfolio/history") return json(req, { data: [] });
    if (path === "portfolio/cached") return json(req, { balances: [], totalValueUsd: 0 });

    if (path === "trading/account") return json(req, { data: (await getTradingSnapshot(supabase)).account });
    if (path === "trading/recommendation") return json(req, { data: (await getTradingSnapshot(supabase)).recommendation });
    if (path === "trading/pnl") return json(req, { data: (await getTradingSnapshot(supabase)).pnl });
    if (path === "trading/cockpit") return json(req, await getTradingSnapshot(supabase));

    if (path === "earn/flexible/list") {
      const data = await binanceSignedRequest("GET", "/sapi/v1/simple-earn/flexible/list", {
        size: 100,
        current: 1,
      });
      await audit(supabase, "earn_products_listed");
      return json(req, { data });
    }

    if (path === "trading/validate" && req.method === "POST") {
      const body = await req.json();
      const snapshot = await getTradingSnapshot(supabase);
      const validation = validateOrderBody(body, snapshot);
      return json(req, {
        data: {
          ...snapshot.validation,
          symbol: validation.symbol.replace(/USDT$/, ""),
          side: validation.side,
          amountUsd: validation.amountUsd,
          issues: validation.issues,
          passed: validation.passed,
          canSubmit: validation.passed,
        },
      });
    }

    if (path === "trading/order" && req.method === "POST") {
      const body = await req.json();
      const mode = String(body.mode || "TEST").toUpperCase();
      const snapshot = await getTradingSnapshot(supabase);
      const validation = validateOrderBody(body, snapshot);
      if (!validation.passed) {
        await audit(supabase, "order_rejected", { mode, symbol: validation.symbol, issues: validation.issues });
        return json(req, {
          data: {
            mode,
            symbol: validation.symbol.replace(/USDT$/, ""),
            side: validation.side,
            amountUsd: validation.amountUsd,
            status: "REJECTED",
            message: validation.issues.map((issue) => issue.message).join(" | "),
          },
        }, 400);
      }

      if (mode === "TEST") {
        const raw = await binanceSignedRequest("POST", "/api/v3/order/test", {
          symbol: validation.symbol,
          side: validation.side,
          type: "MARKET",
          quoteOrderQty: validation.amountUsd.toFixed(2),
          newClientOrderId: `anbaybot_test_${Date.now()}`,
        });
        await audit(supabase, "binance_test_order_ok", { symbol: validation.symbol, side: validation.side, amountUsd: validation.amountUsd });
        return json(req, {
          data: {
            mode: "TEST",
            symbol: validation.symbol.replace(/USDT$/, ""),
            side: validation.side,
            amountUsd: validation.amountUsd,
            status: "ACCEPTED",
            message: "Real Binance /api/v3/order/test accepted. No asset was bought or sold.",
            clientOrderId: `anbaybot_test_${Date.now()}`,
            raw: raw as Record<string, unknown>,
          },
        });
      }

      if (mode === "LIVE") {
        const phrase = Deno.env.get("CONFIRMATION_PHRASE") || "JE COMPRENDS LE RISQUE ET JE VALIDE CETTE ACTION";
        if (Deno.env.get("ALLOW_LIVE_TRADING") !== "true" || body.confirmationPhrase !== phrase) {
          await audit(supabase, "live_order_blocked", { symbol: validation.symbol, reason: "confirmation_or_server_switch_missing" });
          return json(req, {
            data: {
              mode: "LIVE",
              symbol: validation.symbol.replace(/USDT$/, ""),
              side: validation.side,
              amountUsd: validation.amountUsd,
              status: "REJECTED",
              message: "Live order blocked. Enable ALLOW_LIVE_TRADING server-side and provide the exact confirmation phrase.",
            },
          }, 403);
        }

        const raw = await binanceSignedRequest("POST", "/api/v3/order", {
          symbol: validation.symbol,
          side: validation.side,
          type: "MARKET",
          quoteOrderQty: validation.amountUsd.toFixed(2),
          newClientOrderId: `anbaybot_live_${Date.now()}`,
        });
        await audit(supabase, "binance_live_order_submitted", { symbol: validation.symbol, side: validation.side, amountUsd: validation.amountUsd });
        return json(req, {
          data: {
            mode: "LIVE",
            symbol: validation.symbol.replace(/USDT$/, ""),
            side: validation.side,
            amountUsd: validation.amountUsd,
            status: "SUBMITTED",
            message: "Live Binance market order submitted.",
            raw: raw as Record<string, unknown>,
          },
        });
      }
    }

    if (path === "autotrade/config") {
      if (req.method === "PUT") {
        const body = await req.json();
        const { data: existing } = await supabase.from("auto_trade_config").select("id").eq("strategy_id", body.strategy_id).maybeSingle();
        if (existing) {
          await supabase.from("auto_trade_config").update({ ...body, updated_at: new Date().toISOString() }).eq("id", existing.id).throwOnError();
        } else {
          await supabase.from("auto_trade_config").insert(body).throwOnError();
        }
        await audit(supabase, "auto_trade_config_updated", { strategy_id: body.strategy_id });
        return json(req, { success: true });
      }
      return json(req, { data: await listTable(supabase, "auto_trade_config", "strategy_id", true, 100) });
    }

    if (path === "ai/config") {
      if (req.method === "PUT") {
        const body = await req.json();
        const { data: current } = await supabase.from("ai_config").select("id").limit(1).maybeSingle();
        if (current) await supabase.from("ai_config").update({ ...body, updated_at: new Date().toISOString() }).eq("id", current.id).throwOnError();
        else await supabase.from("ai_config").insert(body).throwOnError();
        await audit(supabase, "ai_config_updated");
        return json(req, { success: true });
      }
      const { data } = await supabase.from("ai_config").select("*").limit(1).maybeSingle();
      return json(req, { data });
    }

    if (path === "ai/analyze" && req.method === "POST") {
      const snapshot = await getTradingSnapshot(supabase);
      await audit(supabase, "ai_analysis_run", { symbol: snapshot.recommendation.symbol, action: snapshot.recommendation.action });
      return json(req, { recommendation: snapshot.recommendation });
    }

    const actionMatch = path.match(/^actions\/([^/]+)\/(build|confirm|refuse)$/);
    if (actionMatch) {
      const [, actionId, verb] = actionMatch;
      if (verb === "build") {
        const settings = await getSettings(supabase);
        if (settings.kill_switch) return json(req, { error: "Kill switch is active" }, 403);
        await supabase.from("actions").update({ status: "BUILDING", updated_at: new Date().toISOString() }).eq("id", actionId).throwOnError();
        await audit(supabase, "action_build_started", { actionId });
        return json(req, { transaction: "", note: "Prepared action only. Wallet signature integration is not enabled for autonomous execution." });
      }
      if (verb === "confirm") {
        const body = await req.json();
        await supabase.from("actions").update({ status: "CONFIRMED", updated_at: new Date().toISOString() }).eq("id", actionId).throwOnError();
        if (body.signature) {
          await supabase.from("transactions").insert({
            action_id: actionId,
            signature: body.signature,
            explorer_url: `https://solscan.io/tx/${body.signature}`,
            status: "SUCCESS",
          }).throwOnError();
        }
        await audit(supabase, "action_confirmed", { actionId, signature: body.signature });
        return json(req, { success: true });
      }
      if (verb === "refuse") {
        await supabase.from("actions").update({ status: "REFUSED", updated_at: new Date().toISOString() }).eq("id", actionId).throwOnError();
        await audit(supabase, "action_refused", { actionId });
        return json(req, { success: true });
      }
    }

    return json(req, { error: "Not found", path }, 404);
  } catch (err) {
    return json(req, { error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
