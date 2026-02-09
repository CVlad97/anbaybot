export interface Signal {
  id: string;
  tokenSymbol: string;
  tokenAddress: string;
  chain: string;
  source: string;
  signalType: string;
  meta: any;
  createdAt: Date;
}

export interface ManagedWallet {
  id: string;
  label: string;
  platform: string;
  chain: string;
  address: string;
  enabled: boolean;
}

export interface PreparedAction {
  strategyId: string;
  actionType: 'BUY' | 'SELL' | 'SWAP' | 'PAYOUT';
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedAmountOut?: string;
  minAmountOut?: string;
  walletId: string;
  signalId?: string;
  payload: {
    reasons: string[];
    riskChecks: Array<{
      rule: string;
      passed: boolean;
      detail: string;
    }>;
    [key: string]: any;
  };
}

export interface StrategyContext {
  signals: Signal[];
  wallets: ManagedWallet[];
  settings: {
    maxPositionSizePct: number;
    maxDailyLossPct: number;
    minLiquidityUsd: number;
    maxSlippagePct: number;
    payoutThresholdEur: number;
  };
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  evaluate: (ctx: StrategyContext) => Promise<PreparedAction[]>;
  explain: (action: PreparedAction) => string[];
}
