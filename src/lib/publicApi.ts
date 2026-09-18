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

export type PublicExchangeAccount = {
  exchange: 'BINANCE' | 'MEXC';
  label: string;
  enabled: boolean;
  connection_status: 'NOT_CONFIGURED' | 'READ_ONLY' | 'TEST_READY' | 'LIVE_READY' | 'ERROR';
  balance_usd: number;
  live_trading_enabled: boolean;
  last_checked_at: string | null;
  note: string;
};

export type PublicStrategy = {
  strategy_key: string;
  name: string;
  category: string;
  venue: string | null;
  scan_enabled: boolean;
  execution_mode: 'RESEARCH' | 'PAPER_AUTO' | 'TEST_AUTO' | 'USER_CONFIRM_LIVE' | 'DISABLED';
  status: 'UNVERIFIED' | 'DATA_READY' | 'PAPER_READY' | 'TEST_READY' | 'LIVE_READY' | 'BLOCKED';
  connection_required: string[];
  last_verified_at: string | null;
  note: string;
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

export type PublicOpportunityRow = {
  strategy_key: string;
  mode: 'RESEARCH' | 'PAPER' | 'TEST';
  status: string;
  expected_return_pct: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PublicOpportunities = {
  bucket: string | null;
  rows: PublicOpportunityRow[];
  updatedAt: string;
};

export type PublicReadiness = {
  killSwitch: boolean;
  riskParams: Record<string, unknown>;
  ai: {
    enabled: boolean;
    risk_tolerance: string;
    auto_rebalance: boolean;
    rebalance_interval_hours: number;
    last_run_at: string | null;
    updated_at: string;
  } | null;
  exchanges: Array<{
    exchange: 'BINANCE' | 'MEXC';
    connection_status: 'NOT_CONFIGURED' | 'READ_ONLY' | 'TEST_READY' | 'LIVE_READY' | 'ERROR';
    live_trading_enabled: boolean;
    last_checked_at: string | null;
  }>;
  privateReady: boolean;
  liveEnabled: boolean;
  latestScanAt: string | null;
  livePnlUsd: number;
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
  exchanges: () => get<{ exchanges: PublicExchangeAccount[]; totalExchangeUsd: number; updatedAt: string }>('exchanges'),
  strategies: () => get<{ strategies: PublicStrategy[]; updatedAt: string }>('strategies'),
  pnl: () => get<LivePnl>('pnl'),
  opportunities: () => get<PublicOpportunities>('opportunities'),
  readiness: () => get<PublicReadiness>('readiness'),
};
