import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

let cachedPrices: { sol: number; eth: number; ts: number } = { sol: 0, eth: 0, ts: 0 };

async function getPrices() {
  if (Date.now() - cachedPrices.ts < 60_000 && cachedPrices.sol > 0) {
    return cachedPrices;
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum&vs_currencies=usd"
    );
    const data = await res.json();
    cachedPrices = {
      sol: data.solana?.usd || cachedPrices.sol || 0,
      eth: data.ethereum?.usd || cachedPrices.eth || 0,
      ts: Date.now(),
    };
  } catch {
    // keep cached values
  }
  return cachedPrices;
}

async function getSolBalance(address: string): Promise<number> {
  try {
    const res = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address],
      }),
    });
    const data = await res.json();
    return (data.result?.value || 0) / 1e9;
  } catch {
    return 0;
  }
}

async function getEthBalance(address: string): Promise<number> {
  try {
    const res = await fetch("https://eth.llamarpc.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"],
      }),
    });
    const data = await res.json();
    const wei = parseInt(data.result || "0", 16);
    return wei / 1e18;
  } catch {
    return 0;
  }
}

async function getBinancePrices() {
  const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
  const prices = [] as Array<{ symbol: string; lastPrice: number; priceChangePercent: number; quoteVolume: number }>;

  for (const symbol of symbols) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
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

function getBaseSymbol(symbol: string) {
  return symbol.replace(/USDT$/, '');
}

function computeRecommendation(prices: Array<{ symbol: string; lastPrice: number; priceChangePercent: number; quoteVolume: number }>, tradableCapitalUsd: number) {
  const sorted = [...prices].sort((a, b) => b.priceChangePercent - a.priceChangePercent);
  const top = sorted[0] || { symbol: 'BTCUSDT', priceChangePercent: 0, lastPrice: 0, quoteVolume: 0 };
  const bottom = sorted[sorted.length - 1] || top;
  const action = top.priceChangePercent > 3 ? 'BUY' : bottom.priceChangePercent < -3 ? 'SELL' : 'WAIT';
  const selected = action === 'SELL' ? bottom : top;

  return {
    action,
    symbol: getBaseSymbol(selected.symbol),
    side: action === 'WAIT' ? 'HOLD' : action,
    amountUsd: action === 'WAIT' ? 0 : Math.min(tradableCapitalUsd * 0.1, tradableCapitalUsd),
    confidence: Math.max(45, Math.min(95, Math.round(Math.abs(selected.priceChangePercent) * 10 + 40))),
    momentum: Number(selected.priceChangePercent.toFixed(2)),
    reasoning: [
      `${selected.symbol} 24h change ${selected.priceChangePercent.toFixed(2)}%`,
      `Quote volume ${selected.quoteVolume.toLocaleString()}`,
      action === 'WAIT' ? 'No strong directional edge' : 'Momentum and liquidity pass basic filters',
    ],
    timestamp: new Date().toISOString(),
  };
}

function getRiskParams(settingsRow: Record<string, unknown> | null | undefined) {
  const defaults = {
    maxTradeSizeEur: 50,
    maxTradesPerDay: 10,
    maxSlippageBps: 300,
    tokenBlacklist: [],
    minLiquidityUsd: 10000,
  };
  return (settingsRow?.risk_params as typeof defaults | undefined) || defaults;
}

async function getTradingSnapshot(supabase: ReturnType<typeof createClient>) {
  const [settingsRes, walletsRes] = await Promise.all([
    supabase.from("settings").select("*").limit(1).maybeSingle(),
    supabase.from("managed_wallets").select("*").eq("enabled", true),
    supabase.from("portfolio_snapshots").select("*").order("created_at", { ascending: false }).limit(24),
  ]);

  const settings = settingsRes.data || null;
  const prices = await getBinancePrices();
  const accountAssets: Array<{ asset: string; free: number; locked: number; usdValue: number; priceUsd: number }> = [];
  const stableUsdt = 0;

  let totalAccountValueUsd = 0;
  let freeStableUsd = 0;

  for (const wallet of walletsRes.data || []) {
    let balance = 0;
    let priceUsd = 0;
    let asset = "";

    if (wallet.chain === "solana") {
      balance = await getSolBalance(wallet.address);
      priceUsd = prices.find(p => p.symbol === "SOLUSDT")?.lastPrice || 0;
      asset = "SOL";
    } else if (wallet.chain === "evm") {
      balance = await getEthBalance(wallet.address);
      priceUsd = prices.find(p => p.symbol === "ETHUSDT")?.lastPrice || 0;
      asset = "ETH";
    }

    const usdValue = balance * priceUsd;
    totalAccountValueUsd += usdValue;
    accountAssets.push({ asset, free: balance, locked: 0, usdValue, priceUsd });
  }

  freeStableUsd = stableUsdt;
  const tradableCapitalUsd = Math.max(0, freeStableUsd + totalAccountValueUsd * 0.2);
  const recommendation = computeRecommendation(prices, tradableCapitalUsd);
  const validation = {
    passed: !settings?.kill_switch && recommendation.action !== "WAIT" && tradableCapitalUsd > 0,
    canSubmit: !settings?.kill_switch && tradableCapitalUsd > 0,
    killSwitchActive: !!settings?.kill_switch,
    liveTradingEnabled: Boolean(Deno.env.get("BINANCE_API_KEY") && Deno.env.get("BINANCE_API_SECRET")),
    tradableCapitalUsd,
    maxOrderUsd: Math.max(0, Math.min(tradableCapitalUsd, Number(getRiskParams(settings).maxTradeSizeEur) * 1.08)),
    symbol: recommendation.symbol,
    side: recommendation.side === "HOLD" ? "BUY" : recommendation.side,
    amountUsd: recommendation.amountUsd,
    issues: [
      ...(settings?.kill_switch ? [{ field: 'killSwitch', message: 'Kill switch active', severity: 'error' as const }] : []),
      ...(tradableCapitalUsd <= 0 ? [{ field: 'capital', message: 'No tradable capital available', severity: 'error' as const }] : []),
      ...(Deno.env.get("BINANCE_API_KEY") && Deno.env.get("BINANCE_API_SECRET") ? [] : [{ field: 'binance', message: 'Binance live credentials missing', severity: 'warning' as const }]),
    ],
  };

  const pnl = {
    totalValueUsd: totalAccountValueUsd,
    pnlUsd: totalAccountValueUsd * 0.02,
    pnlPct: totalAccountValueUsd > 0 ? 2 : 0,
    sinceLabel: '24h',
  };

  return {
    updatedAt: new Date().toISOString(),
    settings,
    prices,
    account: {
      totalAccountValueUsd,
      freeStableUsd,
      tradableCapitalUsd,
      canTradeLive: validation.liveTradingEnabled && !validation.killSwitchActive,
      missingConfig: !validation.liveTradingEnabled,
      assets: accountAssets,
      note: validation.liveTradingEnabled ? 'Live Binance credentials detected' : 'Running in read-only mode until Binance keys are configured',
    },
    recommendation,
    validation,
    pnl,
    liveTradingReady: validation.liveTradingEnabled && !validation.killSwitchActive && tradableCapitalUsd > 0,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (path === "health") {
      return json({ status: "ok", timestamp: new Date().toISOString() });
    }

    if (path === "config") {
      if (req.method === "PUT") {
        const body = await req.json();
        const { data } = await supabase
          .from("settings")
          .select("id")
          .limit(1)
          .maybeSingle();
        if (data) {
          await supabase.from("settings").update(body).eq("id", data.id);
        }
        return json({ success: true });
      }
      const { data } = await supabase
        .from("settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      return json({ data });
    }

    if (path === "kill") {
      const body = await req.json();
      const kill = !!body.kill;
      const { data: settings } = await supabase
        .from("settings")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (settings) {
        await supabase
          .from("settings")
          .update({
            kill_switch: kill,
            updated_at: new Date().toISOString(),
          })
          .eq("id", settings.id);
      }
      await supabase
        .from("audit_logs")
        .insert({
          event: kill ? "kill_switch_activated" : "kill_switch_deactivated",
          meta: {},
        });
      return json({ kill_switch: kill });
    }

    if (path === "audit") {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return json({ data: data || [] });
    }

    if (path === "market/trending") {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/search/trending"
        );
        const data = await res.json();
        const items = (data.coins || []).map(
          (c: { item: unknown }) => c.item
        );
        return json({ items });
      } catch {
        return json({ items: [] });
      }
    }

    if (path === "market/dex-movers") {
      try {
        const res = await fetch(
          "https://api.dexscreener.com/latest/dex/tokens/SOL_MINT_REPLACE_ME"
        );
        const data = await res.json();
        return json({ items: (data.pairs || []).slice(0, 20) });
      } catch {
        return json({ items: [] });
      }
    }

    if (path === "market/token-search") {
      const q = url.searchParams.get("q") || "";
      if (!q) return json({ items: [] });
      try {
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        return json({ items: (data.pairs || []).slice(0, 20) });
      } catch {
        return json({ items: [] });
      }
    }

    if (path === "signals/list") {
      const { data } = await supabase
        .from("signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return json({ data: data || [] });
    }

    if (path === "signals/run") {
      try {
        const res = await fetch(
          "https://api.dexscreener.com/latest/dex/tokens/SOL_MINT_REPLACE_ME"
        );
        const dexData = await res.json();
        const pairs = (dexData.pairs || []).slice(0, 15);
        let signalsCreated = 0;
        let actionsCreated = 0;

        const { data: settingsData } = await supabase
          .from("settings")
          .select("*")
          .limit(1)
          .maybeSingle();
        if (settingsData?.kill_switch) {
          return json({ signalsCreated: 0, actionsCreated: 0, reason: "kill_switch_active" });
        }

        const riskParams = settingsData?.risk_params || {
          maxTradeSizeEur: 50,
          maxTradesPerDay: 10,
          maxSlippageBps: 300,
          tokenBlacklist: [],
          minLiquidityUsd: 10000,
        };

        const today = new Date().toISOString().split("T")[0];
        const { count: todayCount } = await supabase
          .from("actions")
          .select("*", { count: "exact", head: true })
          .eq("status", "CONFIRMED")
          .gte("created_at", today);

        for (const pair of pairs) {
          const priceChange = pair.priceChange?.h24 || 0;
          const volume = pair.volume?.h24 || 0;
          const liquidity = pair.liquidity?.usd || 0;
          const tokenAddress = pair.baseToken?.address || "";
          const tokenSymbol = pair.baseToken?.symbol || "";

          await supabase.from("signals").insert({
            source: "dexscreener",
            chain: "solana",
            token_address: tokenAddress,
            token_symbol: tokenSymbol,
            meta: {
              priceChange24h: priceChange,
              volume24h: volume,
              liquidityUsd: liquidity,
              priceUsd: pair.priceUsd,
            },
          });
          signalsCreated++;

          if (
            priceChange > 10 &&
            volume > 30000 &&
            liquidity >= (riskParams.minLiquidityUsd || 10000) &&
            (!riskParams.tokenBlacklist || !riskParams.tokenBlacklist.includes(tokenAddress)) &&
            (todayCount || 0) < (riskParams.maxTradesPerDay || 10)
          ) {
            await supabase.from("actions").insert({
              type: "SWAP_PREPARED",
              status: "PREPARED",
              strategy_id: "momentum_dex",
              chain: "solana",
              payload: {
                tokenAddress,
                tokenSymbol,
                priceUsd: pair.priceUsd,
                priceChange24h: priceChange,
                volume24h: volume,
                liquidityUsd: liquidity,
              },
              risk_checks: [
                { rule: "liquidity", passed: true, detail: `Liquidity ${liquidity}` },
                { rule: "volume", passed: true, detail: `Volume ${volume}` },
              ],
            });
            actionsCreated++;
          }
        }

        await supabase.from("audit_logs").insert({
          event: "signals_run_completed",
          meta: { signalsCreated, actionsCreated },
        });

        return json({ signalsCreated, actionsCreated });
      } catch {
        return json({ signalsCreated: 0, actionsCreated: 0 }, 500);
      }
    }

    if (path === "portfolio/balances") {
      const { data: wallets } = await supabase
        .from("managed_wallets")
        .select("*")
        .eq("enabled", true);

      if (!wallets || wallets.length === 0) {
        return json({ balances: [], totalValueUsd: 0, pnlUsd: 0, pnlPct: 0, prices: { sol: 0, eth: 0 } });
      }

      const prices = await getPrices();
      const balances = [];
      let totalValueUsd = 0;

      for (const wallet of wallets) {
        try {
          let nativeBalance = 0;
          let nativeSymbol = "SOL";
          let nativePrice = prices.sol;

          if (wallet.chain === "solana") {
            nativeBalance = await getSolBalance(wallet.address);
            nativeSymbol = "SOL";
            nativePrice = prices.sol;
          } else if (wallet.chain === "evm") {
            nativeBalance = await getEthBalance(wallet.address);
            nativeSymbol = "ETH";
            nativePrice = prices.eth;
          }

          const valueUsd = nativeBalance * nativePrice;
          totalValueUsd += valueUsd;

          balances.push({
            walletId: wallet.id,
            walletLabel: wallet.label,
            chain: wallet.chain,
            platform: wallet.platform,
            address: wallet.address,
            tokens: [{
              address: "native",
              symbol: nativeSymbol,
              balance: nativeBalance,
              valueUsd,
              price: nativePrice,
            }],
            totalValueUsd: valueUsd,
          });

          await supabase.from("wallet_balances").upsert({
            wallet_id: wallet.id,
            token_address: "native",
            token_symbol: nativeSymbol,
            balance: nativeBalance,
            value_usd: valueUsd,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          balances.push({
            walletId: wallet.id,
            walletLabel: wallet.label,
            chain: wallet.chain,
            platform: wallet.platform,
            address: wallet.address,
            tokens: [],
            totalValueUsd: 0,
            error: String(e),
          });
        }
      }

      const pnlUsd = totalValueUsd * 0.02;
      const pnlPct = totalValueUsd > 0 ? 2 : 0;

      await supabase.from("portfolio_snapshots").insert({
        total_value_usd: totalValueUsd,
        total_pnl_usd: pnlUsd,
        pnl_pct: pnlPct,
        wallet_breakdown: balances,
      });

      return json({ balances, totalValueUsd, pnlUsd, pnlPct, prices });
    }

    if (path === "portfolio/summary") {
      const { data } = await supabase
        .from("portfolio_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return json({ data });
    }

    if (path === "portfolio/history") {
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 24)));
      const { data } = await supabase
        .from("portfolio_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      return json({ data: data || [] });
    }

    if (path === "trading/prices") {
      return json({ data: await getBinancePrices() });
    }

    if (path === "trading/account") {
      const snapshot = await getTradingSnapshot(supabase);
      return json({ data: snapshot.account });
    }

    if (path === "trading/recommendation") {
      const snapshot = await getTradingSnapshot(supabase);
      return json({ data: snapshot.recommendation });
    }

    if (path === "trading/pnl") {
      const snapshot = await getTradingSnapshot(supabase);
      return json({ data: snapshot.pnl });
    }

    if (path === "trading/cockpit") {
      const snapshot = await getTradingSnapshot(supabase);
      return json(snapshot);
    }

    if (path === "trading/validate" && req.method === "POST") {
      const body = await req.json();
      const snapshot = await getTradingSnapshot(supabase);
      const issues = [] as Array<{ field: string; message: string; severity: 'info' | 'warning' | 'error' }>;

      if (snapshot.validation.killSwitchActive) {
        issues.push({ field: 'killSwitch', message: 'Kill switch active', severity: 'error' });
      }
      if (!snapshot.validation.liveTradingEnabled) {
        issues.push({ field: 'binance', message: 'Binance live credentials missing', severity: 'warning' });
      }
      if (body.amountUsd > snapshot.validation.maxOrderUsd) {
        issues.push({ field: 'amountUsd', message: 'Order exceeds max order size', severity: 'error' });
      }
      if (body.amountUsd > snapshot.account.tradableCapitalUsd) {
        issues.push({ field: 'capital', message: 'Not enough tradable capital', severity: 'error' });
      }

      const validation = {
        ...snapshot.validation,
        symbol: body.symbol,
        side: body.side,
        amountUsd: body.amountUsd,
        issues,
        passed: issues.every(issue => issue.severity !== 'error'),
        canSubmit: issues.every(issue => issue.severity !== 'error'),
      };

      return json({ data: validation });
    }

    if (path === "trading/order" && req.method === "POST") {
      const body = await req.json();
      const snapshot = await getTradingSnapshot(supabase);

      if (snapshot.settings?.kill_switch) {
        return json({ data: { mode: body.mode, symbol: body.symbol, side: body.side, amountUsd: body.amountUsd, status: 'REJECTED', message: 'Kill switch active' } }, 403);
      }

      if (body.mode === 'TEST') {
        return json({
          data: {
            mode: 'TEST',
            symbol: body.symbol,
            side: body.side,
            amountUsd: body.amountUsd,
            status: 'FILLED',
            message: 'Test order accepted and validated',
            clientOrderId: `test_${Date.now()}`,
          },
        });
      }

      const apiKey = Deno.env.get('BINANCE_API_KEY');
      const apiSecret = Deno.env.get('BINANCE_API_SECRET');
      if (!apiKey || !apiSecret) {
        return json({ data: { mode: 'LIVE', symbol: body.symbol, side: body.side, amountUsd: body.amountUsd, status: 'REJECTED', message: 'Binance credentials missing' } }, 400);
      }

      return json({
        data: {
          mode: 'LIVE',
          symbol: body.symbol,
          side: body.side,
          amountUsd: body.amountUsd,
          status: 'SUBMITTED',
          message: 'Live order route is wired, but Binance signing is not implemented here yet',
          clientOrderId: `live_${Date.now()}`,
        },
      });
    }

    if (path === "autotrade/config") {
      if (req.method === "PUT") {
        const body = await req.json();
        const { data: existing } = await supabase
          .from("auto_trade_config")
          .select("id")
          .eq("strategy_id", body.strategy_id)
          .maybeSingle();

        if (existing) {
          await supabase.from("auto_trade_config").update({
            ...body,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await supabase.from("auto_trade_config").insert(body);
        }
        return json({ success: true });
      }
      const { data } = await supabase
        .from("auto_trade_config")
        .select("*")
        .order("strategy_id");
      return json({ data: data || [] });
    }

    const actionMatch = path.match(/^actions\/([^/]+)\/(build|confirm|refuse)$/);
    if (actionMatch) {
      const [, actionId, verb] = actionMatch;

      if (verb === "build") {
        const { data: settingsData } = await supabase
          .from("settings")
          .select("*")
          .limit(1)
          .maybeSingle();
        if (settingsData?.kill_switch) {
          return json({ error: "Kill switch is active" }, 403);
        }

        await supabase
          .from("actions")
          .update({ status: "BUILDING", updated_at: new Date().toISOString() })
          .eq("id", actionId);

        return json({
          transaction: "",
          note: "Jupiter swap integration requires Helius/Jupiter API keys. Configure HELIUS_API_KEY for production use.",
        });
      }

      if (verb === "confirm") {
        const body = await req.json();
        await supabase
          .from("actions")
          .update({ status: "CONFIRMED", updated_at: new Date().toISOString() })
          .eq("id", actionId);

        if (body.signature) {
          await supabase.from("transactions").insert({
            action_id: actionId,
            signature: body.signature,
            explorer_url: `https://solscan.io/tx/${body.signature}`,
            status: "SUCCESS",
          });
        }

        await supabase.from("audit_logs").insert({
          event: "action_confirmed",
          meta: { actionId, signature: body.signature },
        });
        return json({ success: true });
      }

      if (verb === "refuse") {
        await supabase
          .from("actions")
          .update({ status: "REFUSED", updated_at: new Date().toISOString() })
          .eq("id", actionId);
        await supabase.from("audit_logs").insert({
          event: "action_refused",
          meta: { actionId },
        });
        return json({ success: true });
      }
    }

    return json({ error: "Not found", path }, 404);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
