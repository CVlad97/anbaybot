import type {
  WalletBalanceData, PortfolioSnapshot, AutoTradeConfig, AIConfig, AIRecommendation,
  BinanceAccountSnapshot, BinanceTicker, TradeExecutionResult, TradingRecommendation,
  TradingValidation, TradingPnL, TradingCockpitSnapshot,
} from './types';
import { isDemoSupabase, supabaseAnonKey, supabaseUrl } from './supabase';
import {
  addAudit,
  createLocalAction,
  getLocalSettings,
  insertRows,
  readTable,
  setLocalKillSwitch,
  updateRows,
  upsertRow,
} from './localDb';
import { getAdminToken } from './auth';

const RAW_BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1/ikb-api` : '');
const ANON = supabaseAnonKey;

function headers(extra: Record<string, string> = {}) {
  const token = getAdminToken();
  return {
    ...(ANON ? { Authorization: `Bearer ${ANON}` } : {}),
    ...(token ? { 'X-Anbaybot-Admin-Token': token } : {}),
    'Content-Type': 'application/json',
    ...extra,
  };
}

function buildUrl(path: string) {
  if (!RAW_BACKEND_API_URL) {
    throw new Error('Backend API not configured. Set VITE_BACKEND_API_URL in GitHub variables.');
  }
  const base = RAW_BACKEND_API_URL.replace(/\/$/, '');
  const route = path.replace(/^\/ikb-api/, '');
  return `${base}${route}`;
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  if (isDemoSupabase) {
    return demoRequest<T>(path, opts);
  }

  const res = await fetch(buildUrl(path), {
    ...opts,
    headers: headers(opts.headers as Record<string, string>),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function fetchBinancePrices(): Promise<BinanceTicker[]> {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
  const fallback = [
    { symbol: 'BTCUSDT', lastPrice: 0, priceChangePercent: 0, quoteVolume: 0 },
    { symbol: 'ETHUSDT', lastPrice: 0, priceChangePercent: 0, quoteVolume: 0 },
    { symbol: 'SOLUSDT', lastPrice: 0, priceChangePercent: 0, quoteVolume: 0 },
    { symbol: 'BNBUSDT', lastPrice: 0, priceChangePercent: 0, quoteVolume: 0 },
  ] as BinanceTicker[];

  const results = await Promise.allSettled(symbols.map(async (symbol) => {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!res.ok) throw new Error(`Binance ${symbol} ${res.status}`);
    const data = await res.json();
    return {
      symbol,
      lastPrice: Number(data.lastPrice || 0),
      priceChangePercent: Number(data.priceChangePercent || 0),
      quoteVolume: Number(data.quoteVolume || 0),
    } as BinanceTicker;
  }));

  const prices = results
    .filter((result): result is PromiseFulfilledResult<BinanceTicker> => result.status === 'fulfilled')
    .map((result) => result.value);

  return prices.length > 0 ? prices : fallback;
}

function buildRecommendation(prices: BinanceTicker[], capital = 0): TradingRecommendation {
  const sorted = [...prices].sort((a, b) => b.priceChangePercent - a.priceChangePercent);
  const selected = sorted[0] ?? { symbol: 'BTCUSDT', priceChangePercent: 0, lastPrice: 0, quoteVolume: 0 };
  const symbol = selected.symbol.replace(/USDT$/, '');
  const action = selected.priceChangePercent > 2 ? 'BUY' : 'WAIT';
  return {
    action,
    symbol,
    side: action === 'BUY' ? 'BUY' : 'HOLD',
    amountUsd: action === 'BUY' ? Math.min(10, capital * 0.05) : 0,
    confidence: Math.max(45, Math.min(75, Math.round(Math.abs(selected.priceChangePercent) * 8 + 45))),
    momentum: Number(selected.priceChangePercent.toFixed(2)),
    reasoning: [
      'Mode GitHub Pages demo : analyse informative uniquement',
      `${selected.symbol} 24h ${selected.priceChangePercent.toFixed(2)}%`,
      'Aucune execution live sans backend, test order et validation humaine',
    ],
    timestamp: new Date().toISOString(),
  };
}

async function demoTradingCockpit(): Promise<TradingCockpitSnapshot> {
  const settings = getLocalSettings();
  const prices = await fetchBinancePrices();
  const balances = readTable('wallet_balances');
  const totalAccountValueUsd = balances.reduce((sum, row) => sum + Number(row.value_usd || 0), 0);
  const tradableCapitalUsd = Math.max(0, totalAccountValueUsd * 0.2);
  const recommendation = buildRecommendation(prices, tradableCapitalUsd);
  const validation: TradingValidation = {
    passed: !settings.kill_switch && tradableCapitalUsd > 0,
    canSubmit: !settings.kill_switch && tradableCapitalUsd > 0,
    killSwitchActive: Boolean(settings.kill_switch),
    liveTradingEnabled: false,
    tradableCapitalUsd,
    maxOrderUsd: Math.min(tradableCapitalUsd, Number((settings.risk_params as { maxTradeSizeEur?: number }).maxTradeSizeEur ?? 50)),
    symbol: recommendation.symbol,
    side: recommendation.side === 'HOLD' ? 'BUY' : recommendation.side,
    amountUsd: recommendation.amountUsd,
    issues: [
      { field: 'mode', message: 'Mode demo local actif : backend Supabase/Edge Function non configure', severity: 'warning' },
      ...(settings.kill_switch ? [{ field: 'killSwitch', message: 'Kill switch active', severity: 'error' as const }] : []),
      ...(tradableCapitalUsd <= 0 ? [{ field: 'capital', message: 'Aucun capital tradable connecte', severity: 'error' as const }] : []),
    ],
  };
  const pnl: TradingPnL = {
    totalValueUsd: totalAccountValueUsd,
    pnlUsd: 0,
    pnlPct: 0,
    sinceLabel: 'demo',
  };
  const account: BinanceAccountSnapshot = {
    totalAccountValueUsd,
    freeStableUsd: 0,
    tradableCapitalUsd,
    canTradeLive: false,
    missingConfig: true,
    assets: [],
    note: 'Mode demo public : configure Supabase et Binance cote serveur pour activer le cockpit reel',
  };

  return {
    updatedAt: new Date().toISOString(),
    settings: settings as unknown as TradingCockpitSnapshot['settings'],
    prices,
    account,
    recommendation,
    validation,
    pnl,
    liveTradingReady: false,
  };
}

async function demoRunSignals() {
  try {
    const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/TOKEN_IN_PLACEHOLDER');
    const data = await res.json();
    const pairs = (data.pairs || []).slice(0, 10) as Array<{
      baseToken?: { address?: string; symbol?: string };
      priceChange?: { h24?: number };
      volume?: { h24?: number };
      liquidity?: { usd?: number };
      priceUsd?: string;
    }>;
    let signalsCreated = 0;
    let actionsCreated = 0;

    for (const pair of pairs) {
      const priceChange = pair.priceChange?.h24 || 0;
      const volume = pair.volume?.h24 || 0;
      const liquidity = pair.liquidity?.usd || 0;
      insertRows('signals', {
        source: 'dexscreener',
        chain: 'solana',
        token_address: pair.baseToken?.address || '',
        token_symbol: pair.baseToken?.symbol || '',
        meta: { priceChange24h: priceChange, volume24h: volume, liquidityUsd: liquidity, priceUsd: pair.priceUsd },
      });
      signalsCreated++;

      if (Math.abs(priceChange) >= 3 && volume >= 10000 && liquidity >= 5000) {
        createLocalAction({
          tokenAddress: pair.baseToken?.address || '',
          symbol: pair.baseToken?.symbol || 'TOKEN',
          priceUsd: pair.priceUsd || '0',
          priceChange24h: priceChange,
          volume24h: volume,
          liquidityUsd: liquidity,
          reason: `Demo scan: ${pair.baseToken?.symbol || 'TOKEN'} ${priceChange.toFixed(2)}% / volume ${Math.round(volume).toLocaleString()} USD`,
        });
        actionsCreated++;
      }
    }
    addAudit('signals_run_completed', { signalsCreated, actionsCreated, mode: 'local_demo' });
    return { signalsCreated, actionsCreated };
  } catch {
    addAudit('signals_run_failed', { mode: 'local_demo' });
    return { signalsCreated: 0, actionsCreated: 0 };
  }
}

async function demoRequest<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = new URL(path, 'https://local.demo');
  const route = url.pathname.replace(/^\/ikb-api$/, '') || url.searchParams.get('path') || '';
  const body = opts.body ? JSON.parse(String(opts.body)) : {};

  if (route === 'health') return { status: 'ok', mode: 'local_demo', timestamp: new Date().toISOString() } as T;
  if (route === 'config') {
    if (opts.method === 'PUT') {
      const settings = getLocalSettings();
      updateRows('settings', body, [(row) => row.id === settings.id]);
      addAudit('settings_updated', { mode: 'local_demo' });
      return { success: true } as T;
    }
    return { data: getLocalSettings() } as T;
  }
  if (route === 'kill') {
    setLocalKillSwitch(Boolean(body.kill));
    return { kill_switch: Boolean(body.kill) } as T;
  }
  if (route === 'audit') return { data: readTable('audit_logs') } as T;
  if (route === 'actions/list') return { data: readTable('actions') } as T;
  if (route === 'signals/list') return { data: readTable('signals') } as T;
  if (route === 'signals/run') return await demoRunSignals() as T;
  if (route === 'portfolio/history') return { data: readTable('portfolio_snapshots') as unknown as PortfolioSnapshot[] } as T;
  if (route === 'portfolio/summary') return { data: readTable('portfolio_snapshots')[0] ?? null } as T;
  if (route === 'portfolio/balances') {
    return { balances: [], totalValueUsd: 0, pnlUsd: 0, pnlPct: 0, prices: { sol: 0, eth: 0 } } as T;
  }
  if (route === 'autotrade/config') {
    if (opts.method === 'PUT') {
      upsertRow('auto_trade_config', body, ['strategy_id']);
      addAudit('auto_trade_config_updated', { strategy_id: body.strategy_id });
      return { success: true } as T;
    }
    return { data: readTable('auto_trade_config') as unknown as AutoTradeConfig[] } as T;
  }
  if (route === 'ai/config') {
    if (opts.method === 'PUT') {
      const ai = readTable('ai_config')[0];
      updateRows('ai_config', body, [(row) => row.id === ai.id]);
      addAudit('ai_config_updated', body);
      return { success: true } as T;
    }
    return { data: readTable('ai_config')[0] as unknown as AIConfig } as T;
  }
  if (route === 'ai/analyze') {
    const prices = await fetchBinancePrices();
    const recommendation = buildRecommendation(prices);
    const ai = readTable('ai_config')[0];
    updateRows('ai_config', { last_recommendation: recommendation, last_run_at: new Date().toISOString() }, [(row) => row.id === ai.id]);
    addAudit('ai_analysis_run', { mode: 'local_demo', symbol: recommendation.symbol });
    return { recommendation } as T;
  }
  if (route === 'trading/prices') return { data: await fetchBinancePrices() } as T;
  if (route === 'trading/cockpit') return await demoTradingCockpit() as T;
  if (route === 'trading/account') return { data: (await demoTradingCockpit()).account } as T;
  if (route === 'trading/recommendation') return { data: (await demoTradingCockpit()).recommendation } as T;
  if (route === 'trading/pnl') return { data: (await demoTradingCockpit()).pnl } as T;
  if (route === 'trading/validate') {
    const snapshot = await demoTradingCockpit();
    return { data: { ...snapshot.validation, symbol: body.symbol, side: body.side, amountUsd: body.amountUsd, canSubmit: false } } as T;
  }
  if (route === 'trading/order') {
    addAudit('demo_order_blocked', { symbol: body.symbol, side: body.side, amountUsd: body.amountUsd });
    return {
      data: {
        mode: body.mode || 'TEST',
        symbol: body.symbol,
        side: body.side,
        amountUsd: body.amountUsd,
        status: 'REJECTED',
        message: 'Mode demo public : aucun ordre live envoye',
      },
    } as T;
  }

  const actionMatch = route.match(/^actions\/([^/]+)\/(build|confirm|refuse)$/);
  if (actionMatch) {
    const [, id, verb] = actionMatch;
    const status = verb === 'refuse' ? 'REFUSED' : verb === 'confirm' ? 'CONFIRMED' : 'PREPARED';
    updateRows('actions', { status }, [(row) => row.id === id]);
    addAudit(`action_${verb}`, { id, mode: 'local_demo' });
    return { success: true, transaction: '' } as T;
  }

  return { data: null } as T;
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

  getManagedWallets: () => request<{ data: unknown[] }>('/ikb-api?path=wallets/list'),
  createManagedWallet: (body: unknown) => request<{ data: unknown }>('/ikb-api?path=wallets', { method: 'POST', body: JSON.stringify(body) }),
  updateManagedWallet: (id: string, body: unknown) =>
    request('/ikb-api?path=' + encodeURIComponent(`wallets/${id}`), { method: 'PATCH', body: JSON.stringify(body) }),
  deleteManagedWallet: (id: string) =>
    request('/ikb-api?path=' + encodeURIComponent(`wallets/${id}`), { method: 'DELETE' }),

  getFollowedWallets: () => request<{ data: unknown[] }>('/ikb-api?path=followed-wallets/list'),
  createFollowedWallet: (body: unknown) => request<{ data: unknown }>('/ikb-api?path=followed-wallets', { method: 'POST', body: JSON.stringify(body) }),
  updateFollowedWallet: (id: string, body: unknown) =>
    request('/ikb-api?path=' + encodeURIComponent(`followed-wallets/${id}`), { method: 'PATCH', body: JSON.stringify(body) }),
  deleteFollowedWallet: (id: string) =>
    request('/ikb-api?path=' + encodeURIComponent(`followed-wallets/${id}`), { method: 'DELETE' }),

  getTransactionsTimeline: () => request<{ transactions: unknown[]; actions: unknown[] }>('/ikb-api?path=transactions/list'),

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
    confirmationPhrase?: string;
  }) => request<{ data: TradeExecutionResult }>('/ikb-api?path=trading/order', { method: 'POST', body: JSON.stringify(body) }),
  getTradingPnL: () => request<{ data: TradingPnL }>('/ikb-api?path=trading/pnl'),
  getEarnFlexibleProducts: () => request<{ data: unknown }>('/ikb-api?path=earn/flexible/list'),
};
