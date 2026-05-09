import type {
  WalletBalanceData, PortfolioSnapshot, AutoTradeConfig, AIConfig, AIRecommendation,
  BinanceAccountSnapshot, BinanceTicker, TradeExecutionResult, TradingRecommendation,
  TradingValidation, TradingPnL, TradingCockpitSnapshot,
} from './types';
import { supabaseAnonKey, supabaseUrl } from './supabase';

const BASE = `${supabaseUrl}/functions/v1`;
const ANON = supabaseAnonKey;

function headers(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${ANON}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: headers(opts.headers as Record<string, string>),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>('/ikb-api?path=health'),

  trending: () => request<{ items: unknown[] }>('/ikb-api?path=market/trending'),
  dexMovers: () => request<{ items: unknown[] }>('/ikb-api?path=market/dex-movers'),
  tokenSearch: (q: string) => request<{ items: unknown[] }>(`/ikb-api?path=market/token-search&q=${encodeURIComponent(q)}`),

  getSettings: () => request<{ data: unknown }>('/ikb-api?path=config'),
  updateSettings: (body: unknown) => request('/ikb-api?path=config', { method: 'PUT', body: JSON.stringify(body) }),
  killSwitch: (on: boolean) => request('/ikb-api?path=kill', { method: 'POST', body: JSON.stringify({ kill: on }) }),

  getAudit: () => request<{ data: unknown[] }>('/ikb-api?path=audit'),

  getActions: () => request<{ data: unknown[] }>('/ikb-api?path=actions/list'),
  buildAction: (id: string) => request<{ transaction: string }>(`/ikb-api?path=actions/${id}/build`, { method: 'POST' }),
  confirmAction: (id: string, sig: string) => request(`/ikb-api?path=actions/${id}/confirm`, { method: 'POST', body: JSON.stringify({ signature: sig }) }),
  refuseAction: (id: string) => request(`/ikb-api?path=actions/${id}/refuse`, { method: 'POST' }),

  runSignals: () => request('/ikb-api?path=signals/run', { method: 'POST' }),
  getSignals: () => request<{ data: unknown[] }>('/ikb-api?path=signals/list'),

  getPortfolio: () => request<{ data: unknown }>('/ikb-api?path=portfolio/summary'),

  getBalances: () => request<{
    balances: WalletBalanceData[];
    totalValueUsd: number;
    pnlUsd: number;
    pnlPct: number;
    prices: { sol: number; eth: number };
  }>('/ikb-api?path=portfolio/balances'),

  getCachedBalances: () => request<{
    balances: unknown[];
    totalValueUsd: number;
  }>('/ikb-api?path=portfolio/cached'),

  getPortfolioHistory: (limit = 24) => request<{
    data: PortfolioSnapshot[];
  }>(`/ikb-api?path=portfolio/history&limit=${limit}`),

  getAutoTradeConfig: () => request<{ data: AutoTradeConfig[] }>('/ikb-api?path=autotrade/config'),
  updateAutoTradeConfig: (body: Partial<AutoTradeConfig>) =>
    request('/ikb-api?path=autotrade/config', { method: 'PUT', body: JSON.stringify(body) }),

  getAIConfig: () => request<{ data: AIConfig | null }>('/ikb-api?path=ai/config'),
  updateAIConfig: (body: Partial<AIConfig>) =>
    request('/ikb-api?path=ai/config', { method: 'PUT', body: JSON.stringify(body) }),
  runAIAnalysis: () => request<{ recommendation: AIRecommendation }>('/ikb-api?path=ai/analyze', { method: 'POST' }),

  getTradingCockpit: () => request<TradingCockpitSnapshot>('/ikb-api?path=trading/cockpit'),
  getBinancePrices: () => request<{ data: BinanceTicker[] }>('/ikb-api?path=trading/prices'),
  getTradingAccount: () => request<{ data: BinanceAccountSnapshot }>('/ikb-api?path=trading/account'),
  getTradingRecommendation: () => request<{ data: TradingRecommendation }>('/ikb-api?path=trading/recommendation'),
  validateTradingOrder: (body: {
    symbol: string;
    side: 'BUY' | 'SELL';
    amountUsd: number;
  }) => request<{ data: TradingValidation }>('/ikb-api?path=trading/validate', { method: 'POST', body: JSON.stringify(body) }),
  submitTradingOrder: (body: {
    symbol: string;
    side: 'BUY' | 'SELL';
    amountUsd: number;
    mode: 'TEST' | 'LIVE';
  }) => request<{ data: TradeExecutionResult }>('/ikb-api?path=trading/order', { method: 'POST', body: JSON.stringify(body) }),
  getTradingPnL: () => request<{ data: TradingPnL }>('/ikb-api?path=trading/pnl'),
};
