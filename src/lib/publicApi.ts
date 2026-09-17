import { supabaseUrl } from './supabase';

export type PublicTokenBalance = {
  symbol: string;
  balance: number;
  priceUsd: number;
  valueUsd: number;
};

export type PublicWalletSnapshot = {
  walletId: string;
  label: string;
  chain: string;
  platform: string;
  addressMasked: string;
  totalValueUsd: number;
  tokens: PublicTokenBalance[];
  error?: string;
};

export type PublicPortfolio = {
  wallets: PublicWalletSnapshot[];
  totalValueUsd: number;
  updatedAt: string;
};

export type LivePnlRow = {
  id: string;
  occurred_at: string;
  venue: string;
  market: string;
  pnl_type: string;
  gross_pnl_usd: number;
  fees_usd: number;
  funding_usd: number;
  net_pnl_usd: number;
  source: string;
};

export type LivePnl = {
  environment: 'LIVE';
  totalNetPnlUsd: number;
  count: number;
  rows: LivePnlRow[];
  updatedAt: string;
};

const base = supabaseUrl ? `${supabaseUrl}/functions/v1/anbaybot-public` : '';

async function get<T>(path: string): Promise<T> {
  if (!base) throw new Error('API publique non configurée');
  const res = await fetch(`${base}?path=${encodeURIComponent(path)}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`API publique ${res.status}`);
  return await res.json() as T;
}

export const publicApi = {
  health: () => get<{ status: string; mode: string; timestamp: string }>('health'),
  portfolio: () => get<PublicPortfolio>('portfolio'),
  pnl: () => get<LivePnl>('pnl'),
};
