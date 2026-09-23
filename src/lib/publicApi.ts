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

export type PublicPolymarketMarket = {
  id: string;
  question: string;
  slug: string;
  outcomePrices: number[];
  liquidityUsd: number;
  volume24hUsd: number;
  spread: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  lastTradePrice: number | null;
  rewardsDailyRate: number;
  endDate: string | null;
  acceptingOrders: boolean;
  restricted: boolean;
};

export type PublicPolymarket = {
  source: 'POLYMARKET_GAMMA_PUBLIC';
  mode: 'READ_ONLY';
  politicalMarketsExcluded: boolean;
  geoblockCheckUrl: string;
  markets: PublicPolymarketMarket[];
  updatedAt: string;
};

export type PublicChallenge48h = {
  session: null | {
    id: string;
    name: string;
    mode: 'PAPER';
    status: 'ACTIVE' | 'COMPLETED' | 'STOPPED';
    started_at: string;
    ends_at: string;
    start_capital_usd: number;
    target_min_pct: number;
    target_max_pct: number;
    max_drawdown_pct: number;
    fee_bps: number;
    slippage_bps: number;
    benchmark: {
      name?: string;
      start_prices?: Record<string, number>;
      market_source?: string;
      capital_source?: string;
    };
    result: Record<string, unknown>;
  };
  checkpoint: null | {
    checked_at: string;
    equity_usd: number;
    cash_usd: number;
    unrealized_pnl_usd: number;
    realized_pnl_usd: number;
    return_pct: number;
    drawdown_pct: number;
    benchmark_return_pct: number;
    prices: Record<string, number>;
    decision: Record<string, unknown>;
  };
  positions: Array<{
    symbol: string;
    side: string;
    entry_at: string;
    entry_price: number;
    quote_amount_usd: number;
    stop_loss_pct: number;
    take_profit_pct: number;
    trailing_stop_pct: number;
    status: 'OPEN' | 'CLOSED';
    exit_at: string | null;
    exit_price: number | null;
    realized_pnl_usd: number;
    fees_usd: number;
    metadata: Record<string, unknown>;
  }>;
  evidence: {
    mode: 'PAPER';
    liveFundsMoved: false;
    includesFeesAndSlippage: true;
    marketSource: string;
    benchmark: string;
  };
  updatedAt: string;
};

export type PublicMonthlyGoal = {
  targetMonthlyEur: number;
  targetDailyEur: number;
  capitalUsd: number;
  capitalEur: number;
  fx: { eurUsd: number; source: string };
  actualEur30d: number;
  marketPnlEur30d: number;
  businessEur30d: number;
  gapEur30d: number;
  progressPct: number;
  requiredMonthlyReturnPct: number | null;
  marketScenarios: Array<{
    monthlyPct: number;
    monthlyEur: number;
    targetCoveragePct: number;
  }>;
  referenceMarketEur: number;
  businessGapEur: number;
  subscriptionTargets: Array<{
    priceMonthlyEur: number;
    subscribersNeeded: number;
    monthlyRevenueNeeded: number;
  }>;
  note: string;
  updatedAt: string;
};

export type PublicTradeIntelligence = {
  sources: Array<{
    source_key: string;
    name: string;
    url: string;
    mode: string;
    enabled: boolean;
    execution_allowed: boolean;
    max_weight: number;
    notes: string | null;
    updated_at: string;
  }>;
  gate: {
    minInternalConfidencePct: number;
    minRiskReward: number;
    getTradeRole: 'SECOND_OPINION';
    liveExecutionFromGetTrade: boolean;
    requiredConfluence: string[];
  };
  objective: {
    targetMonthlyEur: number;
    statement: string;
  };
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
  goal: () => get<PublicMonthlyGoal>('goal'),
  intelligence: () => get<PublicTradeIntelligence>('intelligence'),
  challenge: () => get<PublicChallenge48h>('challenge'),
  polymarket: () => get<PublicPolymarket>('polymarket'),
};
