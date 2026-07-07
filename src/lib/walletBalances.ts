import type { ManagedWallet, TokenBalance, WalletBalanceData } from './types';

const SOLANA_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const BASE_BLOCKSCOUT_API = import.meta.env.VITE_BASE_BLOCKSCOUT_API_URL || 'https://base.blockscout.com/api/v2';
const ETH_BLOCKSCOUT_API = import.meta.env.VITE_ETH_BLOCKSCOUT_API_URL || 'https://eth.blockscout.com/api/v2';

const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2q1xzybapC8G4wEGGkZwyTDt1v';

type SolanaParsedTokenAccount = {
  pubkey?: string;
  account?: {
    data?: {
      parsed?: {
        info?: {
          mint?: string;
          tokenAmount?: {
            uiAmount?: number | null;
            uiAmountString?: string;
            amount?: string;
          };
        };
      };
    };
  };
};

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function solanaRpc<T>(method: string, params: unknown[]): Promise<T | null> {
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method,
    params,
  };
  const data = await fetchJson<{ result?: T }>(SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data?.result ?? null;
}

function formatTokenBalance(
  symbol: string,
  balance: number,
  valueUsd: number,
  price: number,
  address: string,
): TokenBalance {
  return { address, symbol, balance, valueUsd, price };
}

async function fetchSolanaWalletBalances(wallet: ManagedWallet, solPriceUsd: number): Promise<WalletBalanceData> {
  const native = await solanaRpc<{ value?: number }>('getBalance', [wallet.address, { commitment: 'confirmed' }]);
  const tokenAccounts = await solanaRpc<{ value?: SolanaParsedTokenAccount[] }>('getTokenAccountsByOwner', [
    wallet.address,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed', commitment: 'confirmed' },
  ]);

  const solBalance = Number(native?.value || 0) / 1e9;
  const tokens: TokenBalance[] = [];

  if (solBalance > 0) {
    tokens.push(formatTokenBalance('SOL', solBalance, solBalance * solPriceUsd, solPriceUsd, 'native'));
  }

  for (const row of tokenAccounts?.value || []) {
    const info = row.account?.data?.parsed?.info;
    const mint = info?.mint || '';
    const rawAmount = Number(info?.tokenAmount?.uiAmount ?? Number(info?.tokenAmount?.uiAmountString || info?.tokenAmount?.amount || 0));
    if (!mint || rawAmount <= 0) continue;

    if (mint === SOLANA_USDC_MINT) {
      tokens.push(formatTokenBalance('USDC', rawAmount, rawAmount, 1, mint));
      continue;
    }
  }

  const totalValueUsd = tokens.reduce((sum, token) => sum + token.valueUsd, 0);
  return {
    walletId: wallet.id,
    walletLabel: wallet.label,
    chain: wallet.chain,
    platform: wallet.platform,
    address: wallet.address,
    tokens,
    totalValueUsd,
  };
}

type BlockscoutAddressResponse = {
  coin_balance?: string;
  exchange_rate?: string;
};

type BlockscoutTokenBalance = {
  balance?: string | number;
  value?: string | number;
  decimals?: number;
  token?: {
    symbol?: string;
    decimals?: number;
    fiat_value?: string | number;
    address?: string;
  };
  symbol?: string;
  fiat_value?: string | number;
  token_address?: string;
};

function parseBlockscoutToken(row: BlockscoutTokenBalance): TokenBalance | null {
  const symbol = String(row.token?.symbol || row.symbol || '').trim();
  const address = String(row.token?.address || row.token_address || '').trim();
  if (!symbol && !address) return null;

  const decimals = Number(row.token?.decimals ?? row.decimals ?? 0);
  const raw = Number(row.balance ?? row.value ?? 0);
  const balance = decimals > 0 ? raw / 10 ** decimals : raw;

  if (!Number.isFinite(balance) || balance <= 0) return null;

  let price = Number(row.token?.fiat_value ?? row.fiat_value ?? 0);
  if (!Number.isFinite(price) || price < 0) price = 0;

  let valueUsd = price;
  if (valueUsd <= 0) {
    const stableLike = ['USDC', 'USDbC', 'USDT', 'DAI', 'USD+'];
    if (stableLike.includes(symbol)) {
      valueUsd = balance;
      price = 1;
    }
  }

  if (valueUsd <= 0) return null;

  return {
    address: address || symbol.toLowerCase(),
    symbol: symbol || 'TOKEN',
    balance,
    valueUsd,
    price,
  };
}

async function fetchEvmWalletBalances(wallet: ManagedWallet): Promise<WalletBalanceData> {
  const apiBase = wallet.chain === 'eth' ? ETH_BLOCKSCOUT_API : BASE_BLOCKSCOUT_API;
  const addressUrl = `${apiBase}/addresses/${wallet.address}`;
  const tokensUrl = `${apiBase}/addresses/${wallet.address}/token-balances`;

  const addressData = await fetchJson<BlockscoutAddressResponse>(addressUrl);
  const tokenData = await fetchJson<BlockscoutTokenBalance[]>(tokensUrl);

  const nativeBalance = Number(addressData?.coin_balance || 0) / 1e18;
  const nativePrice = Number(addressData?.exchange_rate || 0);
  const tokens: TokenBalance[] = [];

  if (nativeBalance > 0 && nativePrice > 0) {
    tokens.push(formatTokenBalance('ETH', nativeBalance, nativeBalance * nativePrice, nativePrice, 'native'));
  }

  for (const row of tokenData || []) {
    const token = parseBlockscoutToken(row);
    if (token) tokens.push(token);
  }

  const totalValueUsd = tokens.reduce((sum, token) => sum + token.valueUsd, 0);
  return {
    walletId: wallet.id,
    walletLabel: wallet.label,
    chain: wallet.chain,
    platform: wallet.platform,
    address: wallet.address,
    tokens,
    totalValueUsd,
  };
}

export async function fetchWalletBalances(
  wallets: ManagedWallet[],
  prices: { sol: number; eth: number },
): Promise<WalletBalanceData[]> {
  const results = await Promise.allSettled(wallets.filter((wallet) => isHttpUrl(wallet.address) || wallet.address.length > 20).map(async (wallet) => {
    if (wallet.chain === 'solana') return fetchSolanaWalletBalances(wallet, prices.sol);
    return fetchEvmWalletBalances(wallet);
  }));

  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}

