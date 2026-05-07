export interface ManagedWallet {
  id: string;
  chain: string;
  label: string;
  address: string;
  platform: 'PHANTOM' | 'SOLFLARE' | 'EVM' | 'CEX';
  enabled: boolean;
  created_at: string;
}

export interface FollowedWallet {
  id: string;
  chain: string;
  address: string;
  label: string;
  score: number;
  score_reasons: ScoreReason[];
  enabled: boolean;
  blacklisted: boolean;
  created_at: string;
}

export interface ScoreReason {
  metric: string;
  value: string;
  weight: number;
}

export interface Signal {
  id: string;
  source: string;
  chain: string;
  token_address: string;
  token_symbol: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export type ActionType = 'SWAP_PREPARED' | 'ENTRY_PREPARED' | 'EXIT_PREPARED' | 'PAYOUT_PREPARED';
export type ActionStatus = 'PREPARED' | 'BUILDING' | 'CONFIRMED' | 'REFUSED' | 'FAILED' | 'EXPIRED';

export interface Action {
  id: string;
  type: ActionType;
  status: ActionStatus;
  chain: string;
  strategy_id: string;
  payload: Record<string, unknown>;
  risk_checks: RiskCheck[];
  created_at: string;
  updated_at: string;
}

export interface RiskCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface Transaction {
  id: string;
  action_id: string;
  signature: string;
  explorer_url: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  created_at: string;
}

export interface Settings {
  id: string;
  kill_switch: boolean;
  risk_params: RiskParams;
  payout_threshold_eur: number;
  updated_at: string;
}

export interface RiskParams {
  maxTradeSizeEur: number;
  maxTradesPerDay: number;
  maxSlippageBps: number;
  tokenBlacklist: string[];
  minLiquidityUsd: number;
}

export interface AuditLog {
  id: string;
  event: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface TrendingItem {
  id: string;
  name: string;
  symbol: string;
  thumb?: string;
  price_btc?: number;
  market_cap_rank?: number;
  score?: number;
}

export interface DexMover {
  chainId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  volume24h: number;
  priceChange24h: number;
  liquidity: { usd: number };
  url: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  inputs: Record<string, unknown>;
}

export interface PreparedAction {
  type: ActionType;
  chain: string;
  strategyId: string;
  payload: Record<string, unknown>;
  riskChecks: RiskCheck[];
}

export interface TokenBalance {
  address: string;
  symbol: string;
  balance: number;
  valueUsd: number;
  price: number;
}

export interface WalletBalanceData {
  walletId: string;
  walletLabel: string;
  chain: string;
  platform: string;
  address: string;
  tokens: TokenBalance[];
  totalValueUsd: number;
  error?: string;
}

export interface PortfolioSnapshot {
  id: string;
  total_value_usd: number;
  total_pnl_usd: number;
  pnl_pct: number;
  wallet_breakdown: WalletBalanceData[];
  created_at: string;
}

export interface AutoTradeConfig {
  id: string;
  strategy_id: string;
  enabled: boolean;
  allocation_pct: number;
  max_loss_pct: number;
  auto_stop_loss: boolean;
  trader_mode: 'auto' | 'manual' | 'semi';
  selected_traders: string[];
  created_at: string;
  updated_at: string;
}

export interface AIConfig {
  id: string;
  enabled: boolean;
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  auto_rebalance: boolean;
  rebalance_interval_hours: number;
  parameters: Record<string, unknown>;
  last_recommendation: AIRecommendation | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIRecommendation {
  action: string;
  confidence: number;
  reasoning: string;
  suggestedAllocations: Record<string, number>;
  marketSentiment: string;
  walletCount: number;
  portfolioValueUsd: number;
  trend: number;
  timestamp: string;
}

export interface BinanceTicker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  quoteVolume: number;
}

export interface BinanceAccountAsset {
  asset: string;
  free: number;
  locked: number;
  usdValue: number;
  priceUsd: number;
}

export interface BinanceAccountSnapshot {
  totalAccountValueUsd: number;
  freeStableUsd: number;
  tradableCapitalUsd: number;
  canTradeLive: boolean;
  missingConfig: boolean;
  assets: BinanceAccountAsset[];
  note?: string;
}

export interface TradingRecommendation {
  action: 'BUY' | 'SELL' | 'WAIT';
  symbol: string;
  side: 'BUY' | 'SELL' | 'HOLD';
  amountUsd: number;
  confidence: number;
  momentum: number;
  reasoning: string[];
  timestamp: string;
}

export interface TradingValidationIssue {
  field: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface TradingValidation {
  passed: boolean;
  canSubmit: boolean;
  killSwitchActive: boolean;
  liveTradingEnabled: boolean;
  tradableCapitalUsd: number;
  maxOrderUsd: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  amountUsd: number;
  issues: TradingValidationIssue[];
}

export interface TradeExecutionResult {
  mode: 'TEST' | 'LIVE';
  symbol: string;
  side: 'BUY' | 'SELL';
  amountUsd: number;
  status: string;
  message: string;
  orderId?: string;
  clientOrderId?: string;
  raw?: Record<string, unknown>;
}

export interface TradingPnL {
  totalValueUsd: number;
  pnlUsd: number;
  pnlPct: number;
  sinceLabel: string;
}

export interface TradingCockpitSnapshot {
  updatedAt: string;
  settings: Settings;
  prices: BinanceTicker[];
  account: BinanceAccountSnapshot;
  recommendation: TradingRecommendation;
  validation: TradingValidation;
  pnl: TradingPnL;
  liveTradingReady: boolean;
}
