import type { Strategy, PreparedAction, Signal, ManagedWallet } from '../../types';

const strategy: Strategy = {
  id: 'ultra_aggressive',
  name: 'Ultra Aggressive Gains',
  description: 'Maximum speed trading on all tokens with high volatility. Auto-entry on pumps >5%, auto-exit on dumps >3%. High allocation for fast gains.',
  enabled: false,
  inputs: {
    minPriceChange24h: 5,
    minVolume24h: 10000,
    minLiquidity: 5000,
    maxSlippageBps: 1000,
    allocationPct: 15,
    stopLossPct: 3,
    takeProfitPct: 10,
    maxConcurrentTrades: 5,
    autoExecute: true,
  },
};

export async function execute(
  signals: Signal[],
  wallets: ManagedWallet[],
  portfolioValueUsd: number,
): Promise<PreparedAction[]> {
  const actions: PreparedAction[] = [];
  const { minPriceChange24h, minVolume24h, minLiquidity, allocationPct, maxConcurrentTrades } = strategy.inputs;

  const enabledWallets = wallets.filter(w => w.enabled);
  if (enabledWallets.length === 0) return actions;

  const aggressiveSignals = signals.filter(sig => {
    const meta = sig.meta as any;
    const priceChange = meta?.priceChange24h || 0;
    const volume = meta?.volume?.h24 || 0;
    const liq = meta?.liquidity?.usd || 0;
    return priceChange >= minPriceChange24h && volume >= minVolume24h && liq >= minLiquidity;
  });

  const sortedSignals = aggressiveSignals.sort((a, b) => {
    const aChange = (a.meta as any)?.priceChange24h || 0;
    const bChange = (b.meta as any)?.priceChange24h || 0;
    return bChange - aChange;
  });

  const topSignals = sortedSignals.slice(0, maxConcurrentTrades as number);

  for (const signal of topSignals) {
    const wallet = enabledWallets[Math.floor(Math.random() * enabledWallets.length)];
    const tradeSize = (portfolioValueUsd * (allocationPct as number)) / 100;
    const meta = signal.meta as any;

    actions.push({
      type: 'ENTRY_PREPARED',
      chain: signal.chain,
      strategyId: strategy.id,
      payload: {
        signal_id: signal.id,
        wallet_id: wallet.id,
        token_address: signal.token_address,
        token_symbol: signal.token_symbol,
        side: 'BUY',
        size_usd: tradeSize,
        price_change_24h: meta?.priceChange24h || 0,
        volume_24h: meta?.volume?.h24 || 0,
        liquidity_usd: meta?.liquidity?.usd || 0,
        reason: `ULTRA-AGGRESSIVE: ${signal.token_symbol} pumping ${((meta?.priceChange24h || 0)).toFixed(1)}% in 24h`,
      },
      riskChecks: [
        {
          rule: 'min_price_change',
          passed: (meta?.priceChange24h || 0) >= minPriceChange24h,
          detail: `Price change: ${((meta?.priceChange24h || 0)).toFixed(2)}% (min: ${minPriceChange24h}%)`,
        },
        {
          rule: 'min_volume',
          passed: (meta?.volume?.h24 || 0) >= minVolume24h,
          detail: `Volume 24h: $${((meta?.volume?.h24 || 0)).toLocaleString()}`,
        },
        {
          rule: 'min_liquidity',
          passed: (meta?.liquidity?.usd || 0) >= minLiquidity,
          detail: `Liquidity: $${((meta?.liquidity?.usd || 0)).toLocaleString()}`,
        },
        {
          rule: 'auto_execute',
          passed: true,
          detail: 'Auto-execution enabled for maximum speed',
        },
      ],
    });
  }

  return actions;
}

export default strategy;
