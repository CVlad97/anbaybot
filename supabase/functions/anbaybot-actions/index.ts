import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ORIGIN = "https://cvlad97.github.io";
const TRON_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Anbaybot-Admin-Token",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });

function db() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("supabase_server_credentials_missing");
  return createClient(url, key, { global: { headers: { "X-Client-Info": "anbaybot-actions-v1" } } });
}

async function sha256(value: string) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(raw)).map(x => x.toString(16).padStart(2, "0")).join("");
}

async function authorize(req: Request, s: ReturnType<typeof db>) {
  const token = req.headers.get("X-Anbaybot-Admin-Token") || "";
  if (!token) return false;
  const hash = await sha256(token);
  const { data, error } = await s.from("admin_tokens").select("id").eq("token_hash", hash).eq("active", true).maybeSingle();
  return !error && Boolean(data);
}

function isTronAddress(value: string) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value);
}

async function tronBalances(address: string) {
  const headers: Record<string, string> = {};
  const key = Deno.env.get("TRONGRID_API_KEY") || "";
  if (key) headers["TRON-PRO-API-KEY"] = key;
  const res = await fetch(`https://api.trongrid.io/v1/accounts/${address}`, { headers });
  if (!res.ok) throw new Error(`trongrid_${res.status}`);
  const payload = await res.json() as { data?: Array<{ balance?: number; trc20?: Array<Record<string, string>> }> };
  const account = payload.data?.[0] || {};
  const trx = Number(account.balance || 0) / 1e6;
  let rawUsdt = 0;
  for (const row of account.trc20 || []) rawUsdt += Number(row[TRON_USDT] || 0);
  return { TRX: trx, USDT: rawUsdt / 1e6 };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  const s = db();
  if (!await authorize(req, s)) return json({ error: "unauthorized" }, 401);
  const path = new URL(req.url).searchParams.get("path") || "prepared";

  try {
    if (req.method === "GET" && path === "prepared") {
      const { data, error } = await s.from("actions").select("id,type,status,chain,strategy_id,payload,risk_checks,created_at,updated_at").in("type", ["TRANSFER_PREPARED", "ARBITRAGE_PREPARED"]).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ data: data || [] });
    }

    if (req.method === "POST" && path === "transfer/prepare") {
      const body = await req.json() as { sourceWalletId?: string; asset?: string; amount?: number; destinationAddress?: string; note?: string };
      const asset = String(body.asset || "USDT").toUpperCase();
      const amount = Number(body.amount || 0);
      const destination = String(body.destinationAddress || "").trim();
      if (!body.sourceWalletId || !["USDT", "TRX"].includes(asset) || !Number.isFinite(amount) || amount <= 0) return json({ error: "invalid_request" }, 400);
      if (!isTronAddress(destination)) return json({ error: "invalid_destination", message: "Un transfert TRON/TRC20 exige une adresse TRON commençant par T. Une adresse 0x EVM n'est pas compatible." }, 400);

      const { data: wallet, error: walletError } = await s.from("managed_wallets").select("id,chain,label,address,platform,enabled").eq("id", body.sourceWalletId).eq("enabled", true).maybeSingle();
      if (walletError) throw walletError;
      if (!wallet || String(wallet.chain).toLowerCase() !== "tron") return json({ error: "source_wallet_not_tron" }, 400);

      const balances = await tronBalances(wallet.address);
      const available = asset === "USDT" ? balances.USDT : balances.TRX;
      const enough = amount <= available;
      const reserveOkay = asset !== "USDT" || balances.TRX >= 5;
      const riskChecks = [
        { rule: "destination_network", passed: true, detail: "Adresse TRON valide" },
        { rule: "available_balance", passed: enough, detail: `${available.toFixed(6)} ${asset} disponible` },
        { rule: "trx_fee_buffer", passed: reserveOkay, detail: `${balances.TRX.toFixed(6)} TRX disponible pour frais/énergie; le wallet calculera le coût réel` },
        { rule: "wallet_signature", passed: false, detail: "Signature utilisateur requise avant diffusion" },
      ];
      if (!enough) return json({ error: "insufficient_balance", balances, riskChecks }, 400);

      const payload = {
        sourceWalletId: wallet.id,
        sourceLabel: wallet.label,
        sourceAddress: wallet.address,
        destinationAddress: destination,
        asset,
        amount,
        balancesAtPreparation: balances,
        note: String(body.note || ""),
        requiresWalletSignature: true,
        execution: "NOT_BROADCAST",
      };
      const { data: action, error: insertError } = await s.from("actions").insert({
        type: "TRANSFER_PREPARED",
        status: "PREPARED",
        chain: "tron",
        strategy_id: "profit_sweep",
        payload,
        risk_checks: riskChecks,
      }).select("id,type,status,chain,strategy_id,payload,risk_checks,created_at").single();
      if (insertError) throw insertError;
      await s.from("audit_ledger").insert({ severity: "INFO", event_type: "TRANSFER_INTENT_PREPARED", actor_type: "USER", source: "anbaybot-actions", source_ref: action.id, sanitized_payload: { sourceWalletId: wallet.id, asset, amount, destinationMasked: `${destination.slice(0,6)}…${destination.slice(-4)}` } });
      return json({ data: action, balances, broadcast: false }, 201);
    }

    if (req.method === "POST" && path === "arbitrage/prepare") {
      const body = await req.json() as { symbol?: string; buyVenue?: string; sellVenue?: string; amountUsd?: number; grossSpreadPct?: number };
      const symbol = String(body.symbol || "").toUpperCase();
      const amountUsd = Number(body.amountUsd || 0);
      if (!symbol || !Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 10) return json({ error: "invalid_request", message: "Le montant PAPER préparé est limité à 10 USD tant que les comptes privés ne sont pas connectés." }, 400);
      const payload = { symbol, buyVenue: body.buyVenue, sellVenue: body.sellVenue, amountUsd, grossSpreadPct: Number(body.grossSpreadPct || 0), execution: "PAPER_ONLY", requiresUserConfirmationForLive: true };
      const { data, error } = await s.from("actions").insert({ type: "ARBITRAGE_PREPARED", status: "PREPARED", chain: "cex", strategy_id: "arbitrage", payload, risk_checks: [{ rule: "paper_only", passed: true, detail: "Aucun ordre LIVE diffusé" }, { rule: "private_exchange_accounts", passed: false, detail: "Binance/MEXC privés non connectés" }] }).select("*").single();
      if (error) throw error;
      return json({ data, broadcast: false }, 201);
    }

    return json({ error: "not_found" }, 404);
  } catch (e) {
    console.error("[anbaybot-actions]", e);
    return json({ error: e instanceof Error ? e.message : "internal_error" }, 500);
  }
});
