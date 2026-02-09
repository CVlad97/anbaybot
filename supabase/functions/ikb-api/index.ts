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
          "https://api.dexscreener.com/latest/dex/tokens/TOKEN_IN_PLACEHOLDER"
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
          "https://api.dexscreener.com/latest/dex/tokens/TOKEN_IN_PLACEHOLDER"
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
            !riskParams.tokenBlacklist?.includes(tokenAddress) &&
            (todayCount || 0) + actionsCreated < (riskParams.maxTradesPerDay || 10)
          ) {
            await supabase.from("actions").insert({
              type: "ENTRY_PREPARED",
              status: "PREPARED",
              chain: "solana",
              strategy_id: "momentum_dex",
              payload: {
                tokenAddress,
                symbol: tokenSymbol,
                priceUsd: pair.priceUsd,
                priceChange24h: priceChange,
                volume24h: volume,
                liquidity,
                reason: `Momentum: +${priceChange.toFixed(1)}% / Vol $${(volume / 1000).toFixed(0)}K`,
              },
              risk_checks: [
                {
                  rule: "liquidity_check",
                  passed: true,
                  detail: `Liq: $${(liquidity / 1000).toFixed(0)}K`,
                },
                {
                  rule: "volume_check",
                  passed: true,
                  detail: `Vol: $${(volume / 1000).toFixed(0)}K`,
                },
                {
                  rule: "max_trades_per_day",
                  passed: true,
                  detail: `${(todayCount || 0) + actionsCreated}/${riskParams.maxTradesPerDay} today`,
                },
              ],
            });
            actionsCreated++;
          }
        }

        await supabase.from("audit_logs").insert({
          event: "signal_run_completed",
          meta: { signalsCreated, actionsCreated },
        });

        return json({ signalsCreated, actionsCreated });
      } catch (err) {
        return json({ error: String(err), signalsCreated: 0, actionsCreated: 0 }, 500);
      }
    }

    if (path === "actions/list") {
      const { data } = await supabase
        .from("actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return json({ data: data || [] });
    }

    if (path === "portfolio/balances") {
      const { data: wallets } = await supabase
        .from("managed_wallets")
        .select("*")
        .eq("enabled", true);

      if (!wallets || wallets.length === 0) {
        return json({ balances: [], totalValueUsd: 0, prices: { sol: 0, eth: 0 } });
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
          }, { onConflict: "wallet_id,token_address" });
        } catch {
          balances.push({
            walletId: wallet.id,
            walletLabel: wallet.label,
            chain: wallet.chain,
            platform: wallet.platform,
            address: wallet.address,
            tokens: [],
            totalValueUsd: 0,
            error: "Failed to fetch balance",
          });
        }
      }

      const { data: lastSnapshot } = await supabase
        .from("portfolio_snapshots")
        .select("total_value_usd")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevValue = lastSnapshot?.total_value_usd || 0;
      const pnlUsd = prevValue > 0 ? totalValueUsd - prevValue : 0;
      const pnlPct = prevValue > 0 ? ((totalValueUsd - prevValue) / prevValue) * 100 : 0;

      await supabase.from("portfolio_snapshots").insert({
        total_value_usd: totalValueUsd,
        total_pnl_usd: pnlUsd,
        pnl_pct: pnlPct,
        wallet_breakdown: balances,
      });

      return json({
        balances,
        totalValueUsd,
        pnlUsd,
        pnlPct,
        prices: { sol: prices.sol, eth: prices.eth },
      });
    }

    if (path === "portfolio/history") {
      const limit = parseInt(url.searchParams.get("limit") || "24");
      const { data } = await supabase
        .from("portfolio_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      return json({ data: data || [] });
    }

    if (path === "portfolio/cached") {
      const { data: balances } = await supabase
        .from("wallet_balances")
        .select("*, managed_wallets(label, chain, platform, address)")
        .order("value_usd", { ascending: false });

      const totalValueUsd = (balances || []).reduce(
        (sum: number, b: { value_usd: number }) => sum + (b.value_usd || 0), 0
      );

      return json({ balances: balances || [], totalValueUsd });
    }

    if (path === "portfolio/summary") {
      const { count: totalActions } = await supabase
        .from("actions")
        .select("*", { count: "exact", head: true });
      const { count: confirmed } = await supabase
        .from("actions")
        .select("*", { count: "exact", head: true })
        .eq("status", "CONFIRMED");
      const { count: totalTx } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true });

      const { data: latestSnapshot } = await supabase
        .from("portfolio_snapshots")
        .select("total_value_usd, total_pnl_usd, pnl_pct")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return json({
        data: {
          totalActions: totalActions || 0,
          confirmedActions: confirmed || 0,
          totalTransactions: totalTx || 0,
          totalValueUsd: latestSnapshot?.total_value_usd || 0,
          pnlUsd: latestSnapshot?.total_pnl_usd || 0,
          pnlPct: latestSnapshot?.pnl_pct || 0,
        },
      });
    }

    if (path === "ai/config") {
      if (req.method === "PUT") {
        const body = await req.json();
        const { data: existing } = await supabase
          .from("ai_config")
          .select("id")
          .limit(1)
          .maybeSingle();
        if (existing) {
          await supabase.from("ai_config").update({
            ...body,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        }
        return json({ success: true });
      }
      const { data } = await supabase
        .from("ai_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      return json({ data });
    }

    if (path === "ai/analyze") {
      const { data: wallets } = await supabase
        .from("managed_wallets")
        .select("*")
        .eq("enabled", true);

      const { data: signals } = await supabase
        .from("signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: snapshots } = await supabase
        .from("portfolio_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: aiConf } = await supabase
        .from("ai_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      const { data: settingsRow } = await supabase
        .from("settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      const walletCount = wallets?.length || 0;
      const signalCount = signals?.length || 0;
      const latestValue = snapshots?.[0]?.total_value_usd || 0;
      const prevValue = snapshots?.[1]?.total_value_usd || 0;
      const trend = prevValue > 0 ? ((latestValue - prevValue) / prevValue) * 100 : 0;

      const riskTolerance = aiConf?.risk_tolerance || "moderate";
      const riskMultiplier = riskTolerance === "aggressive" ? 1.5 : riskTolerance === "conservative" ? 0.5 : 1;

      const bullishSignals = (signals || []).filter(
        (s: { meta: { priceChange24h?: number } }) => (s.meta?.priceChange24h || 0) > 5
      ).length;

      const bearishSignals = (signals || []).filter(
        (s: { meta: { priceChange24h?: number } }) => (s.meta?.priceChange24h || 0) < -5
      ).length;

      const marketSentiment = bullishSignals > bearishSignals ? "bullish" :
        bearishSignals > bullishSignals ? "bearish" : "neutral";

      let action = "HOLD";
      let confidence = 50;
      const reasoning: string[] = [];

      if (marketSentiment === "bullish" && trend >= 0) {
        action = "INCREASE_EXPOSURE";
        confidence = Math.min(85, 50 + bullishSignals * 5);
        reasoning.push(`Market sentiment bullish (${bullishSignals} positive signals)`);
        reasoning.push(`Portfolio trend positive: +${trend.toFixed(2)}%`);
      } else if (marketSentiment === "bearish" || trend < -5) {
        action = "REDUCE_EXPOSURE";
        confidence = Math.min(90, 50 + bearishSignals * 5);
        reasoning.push(`Market showing bearish signals (${bearishSignals} negative)`);
        if (trend < -5) reasoning.push(`Portfolio declining: ${trend.toFixed(2)}%`);
      } else {
        reasoning.push("Market conditions neutral, maintaining current positions");
        reasoning.push(`${signalCount} signals analyzed, no strong directional bias`);
      }

      if (settingsRow?.kill_switch) {
        action = "EMERGENCY_STOP";
        confidence = 100;
        reasoning.unshift("Kill switch is ACTIVE - all operations halted");
      }

      const suggestedAllocations: Record<string, number> = {
        copy_swap_filtered: action === "INCREASE_EXPOSURE" ? 25 * riskMultiplier : 10,
        momentum_dex: action === "INCREASE_EXPOSURE" ? 30 * riskMultiplier : 15,
        defensive_exit: action === "REDUCE_EXPOSURE" ? 40 : 20,
        payout_150_eur: 10,
      };

      const recommendation = {
        action,
        confidence,
        reasoning: reasoning.join(". "),
        suggestedAllocations,
        marketSentiment,
        walletCount,
        portfolioValueUsd: latestValue,
        trend,
        timestamp: new Date().toISOString(),
      };

      if (aiConf) {
        await supabase.from("ai_config").update({
          last_recommendation: recommendation,
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", aiConf.id);
      }

      await supabase.from("audit_logs").insert({
        event: "ai_analysis_completed",
        meta: { action, confidence, marketSentiment },
      });

      return json({ recommendation });
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
