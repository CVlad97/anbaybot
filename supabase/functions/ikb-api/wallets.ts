export type TrackedWallet = {
  id: string;
  chain: string;
  label: string;
  address: string;
  platform: string;
  enabled: boolean;
};

export type PriceRow = { symbol: string; lastPrice: number };

type TokenBalance = {
  address: string;
  symbol: string;
  balance: number;
  valueUsd: number;
  price: number;
};

export type WalletBalance = {
  walletId: string;
  walletLabel: string;
  chain: string;
  platform: string;
  address: string;
  tokens: TokenBalance[];
  totalValueUsd: number;
  error?: string;
};

const BASE_BLOCKSCOUT = "https://base.blockscout.com/api/v2";
const ETH_BLOCKSCOUT = "https://eth.blockscout.com/api/v2";
const TRONGRID = "https://api.trongrid.io";
const SOLANA_RPC = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";
const TRON_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const SOLANA_USDC = "EPjFWdd5AufqSSqeM2q1xzybapC8G4wEGGkZwyTDt1v";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return await res.json() as T;
    if (res.status === 429 && attempt < 2) {
      await sleep(500 * (attempt + 1));
      continue;
    }
    throw new Error(`http_${res.status}`);
  }
  throw new Error("http_retry_exhausted");
}

function priceMap(rows: PriceRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.symbol, Number(row.lastPrice || 0));
  return map;
}

function token(symbol: string, balance: number, price: number, address: string): TokenBalance {
  const valueUsd = balance * price;
  return { address, symbol, balance, price, valueUsd };
}

async function fetchBlockscout(wallet: TrackedWallet): Promise<WalletBalance> {
  const api = wallet.chain.toLowerCase() === "eth" ? ETH_BLOCKSCOUT : BASE_BLOCKSCOUT;
  const [addressData, tokenData] = await Promise.all([
    fetchJson<{ coin_balance?: string; exchange_rate?: string }>(`${api}/addresses/${wallet.address}`),
    fetchJson<Array<{ value?: string; balance?: string; token?: { address?: string; symbol?: string; decimals?: string | number; exchange_rate?: string; fiat_value?: string } }>>(`${api}/addresses/${wallet.address}/token-balances`),
  ]);

  const tokens: TokenBalance[] = [];
  const nativeBalance = Number(addressData.coin_balance || 0) / 1e18;
  const nativePrice = Number(addressData.exchange_rate || 0);
  if (nativeBalance > 0) tokens.push(token("ETH", nativeBalance, nativePrice, "native"));

  for (const row of tokenData || []) {
    const symbol = String(row.token?.symbol || "TOKEN");
    const decimals = Number(row.token?.decimals || 0);
    const raw = Number(row.value ?? row.balance ?? 0);
    const balance = decimals > 0 ? raw / 10 ** decimals : raw;
    if (!Number.isFinite(balance) || balance <= 0) continue;
    let unitPrice = Number(row.token?.exchange_rate ?? row.token?.fiat_value ?? 0);
    if ((!unitPrice || unitPrice < 0) && ["USDC","USDbC","USDT","DAI","USD+"].includes(symbol)) unitPrice = 1;
    tokens.push(token(symbol, balance, unitPrice, String(row.token?.address || symbol)));
  }

  return { walletId: wallet.id, walletLabel: wallet.label, chain: wallet.chain, platform: wallet.platform, address: wallet.address, tokens, totalValueUsd: tokens.reduce((s,t)=>s+t.valueUsd,0) };
}

async function fetchTron(wallet: TrackedWallet, prices: Map<string,number>): Promise<WalletBalance> {
  const headers: Record<string,string> = {};
  const tronKey = Deno.env.get("TRONGRID_API_KEY") || "";
  if (tronKey) headers["TRON-PRO-API-KEY"] = tronKey;
  const payload = await fetchJson<{ data?: Array<{ balance?: number; trc20?: Array<Record<string,string>> }> }>(`${TRONGRID}/v1/accounts/${wallet.address}`, { headers });
  const account = payload.data?.[0] || {};
  const tokens: TokenBalance[] = [];
  const trxBalance = Number(account.balance || 0) / 1e6;
  if (trxBalance > 0) tokens.push(token("TRX", trxBalance, prices.get("TRXUSDT") || 0, "native"));

  let usdtRaw = 0;
  for (const entry of account.trc20 || []) {
    const raw = entry[TRON_USDT];
    if (raw) usdtRaw += Number(raw || 0);
  }
  const usdt = usdtRaw / 1e6;
  if (usdt > 0) tokens.push(token("USDT", usdt, 1, TRON_USDT));

  return { walletId: wallet.id, walletLabel: wallet.label, chain: wallet.chain, platform: wallet.platform, address: wallet.address, tokens, totalValueUsd: tokens.reduce((s,t)=>s+t.valueUsd,0) };
}

async function solanaRpc<T>(method:string, params:unknown[]): Promise<T> {
  const payload = await fetchJson<{result?:T}>(SOLANA_RPC,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  if (!payload.result) throw new Error(`solana_${method}_missing_result`);
  return payload.result;
}

async function fetchSolana(wallet: TrackedWallet, prices: Map<string,number>): Promise<WalletBalance> {
  const [native, tokenAccounts] = await Promise.all([
    solanaRpc<{value:number}>("getBalance",[wallet.address,{commitment:"confirmed"}]),
    solanaRpc<{value:Array<{account?:{data?:{parsed?:{info?:{mint?:string;tokenAmount?:{uiAmount?:number|null;uiAmountString?:string}}}}}}>}>("getTokenAccountsByOwner",[wallet.address,{programId:"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},{encoding:"jsonParsed",commitment:"confirmed"}]),
  ]);
  const tokens: TokenBalance[] = [];
  const sol = Number(native.value || 0) / 1e9;
  if (sol > 0) tokens.push(token("SOL",sol,prices.get("SOLUSDT")||0,"native"));
  for (const row of tokenAccounts.value || []) {
    const info = row.account?.data?.parsed?.info;
    if (info?.mint !== SOLANA_USDC) continue;
    const amount = Number(info.tokenAmount?.uiAmount ?? info.tokenAmount?.uiAmountString ?? 0);
    if (amount > 0) tokens.push(token("USDC",amount,1,SOLANA_USDC));
  }
  return { walletId: wallet.id, walletLabel: wallet.label, chain: wallet.chain, platform: wallet.platform, address: wallet.address, tokens, totalValueUsd: tokens.reduce((s,t)=>s+t.valueUsd,0) };
}

export async function fetchTrackedWalletBalances(wallets: TrackedWallet[], rows: PriceRow[]): Promise<WalletBalance[]> {
  const prices = priceMap(rows);
  const enabled = wallets.filter(w=>w.enabled);
  const results: WalletBalance[] = [];

  for (const wallet of enabled) {
    try {
      const chain = wallet.chain.toLowerCase();
      if (chain === "tron") {
        results.push(await fetchTron(wallet,prices));
        await sleep(350);
        continue;
      }
      if (chain === "solana") {
        results.push(await fetchSolana(wallet,prices));
        continue;
      }
      if (chain === "base" || chain === "eth" || chain === "ethereum") {
        results.push(await fetchBlockscout(wallet));
        continue;
      }
      results.push({ walletId:wallet.id,walletLabel:wallet.label,chain:wallet.chain,platform:wallet.platform,address:wallet.address,tokens:[],totalValueUsd:0,error:"unsupported_chain" });
    } catch (e) {
      results.push({ walletId:wallet.id,walletLabel:wallet.label,chain:wallet.chain,platform:wallet.platform,address:wallet.address,tokens:[],totalValueUsd:0,error:e instanceof Error?e.message:"balance_fetch_failed" });
    }
  }

  return results;
}
