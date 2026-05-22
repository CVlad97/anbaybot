import type { Strategy, PreparedAction, Signal, ManagedWallet } from '../../types';

const strategy: Strategy = {
  id: 'ultra_aggressive',
  name: 'Scénario volatilité élevée (piloté)',
  description:
    'Scénario de détection de volatilité élevée. Les actions restent des préparations en simulation: validation utilisateur obligatoire avant toute exécution réelle.',
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
  const minPriceChange24h = Number(strategy.inputs.minPriceChange24h);
  const minVolume24h = Number(strategy.inputs.minVolume24h);
  const minLiquidity = Number(strategy.inputs.minLiquidity);
  const allocationPct = Number(strategy.inputs.allocationPct);
  const maxConcurrentTrades = Number(strategy.inputs.maxConcurrentTrades);

  const enabledWallets = wallets.filter(w => w.enabled);
  if (enabledWallets.length === 0) return actions;

  const aggressiveSignals = signals.filter(sig => {
    const meta = sig.meta as Record<string, unknown>;
    const priceChange = (meta.priceChange24h as number | undefined) || 0;
    const volume = (meta.volume as { h24?: number } | undefined)?.h24 || 0;
    const liq = (meta.liquidity as { usd?: number } | undefined)?.usd || 0;
    return priceChange >= minPriceChange24h && volume >= minVolume24h && liq >= minLiquidity;
  });

  const sortedSignals = aggressiveSignals.sort((a, b) => {
    const aMeta = a.meta as Record<string, unknown>;
    const bMeta = b.meta as Record<string, unknown>;
    const aChange = (aMeta.priceChange24h as number | undefined) || 0;
    const bChange = (bMeta.priceChange24h as number | undefined) || 0;
    return bChange - aChange;
  });

  const topSignals = sortedSignals.slice(0, maxConcurrentTrades);

  for (const signal of topSignals) {
    const wallet = enabledWallets[Math.floor(Math.random() * enabledWallets.length)];
    const tradeSize = (portfolioValueUsd * (allocationPct as number)) / 100;
    const meta = signal.meta as Record<string, unknown>;
    const priceChange24h = (meta.priceChange24h as number | undefined) || 0;
    const volume24h = (meta.volume as { h24?: number } | undefined)?.h24 || 0;
    const liquidityUsd = (meta.liquidity as { usd?: number } | undefined)?.usd || 0;

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
        price_change_24h: priceChange24h,
        volume_24h: volume24h,
        liquidity_usd: liquidityUsd,
        reason: `VOLATILITÉ ÉLEVÉE: ${signal.token_symbol} +${priceChange24h.toFixed(1)}% sur 24h`,
      },
      riskChecks: [
        {
          rule: 'min_price_change',
          passed: priceChange24h >= minPriceChange24h,
          detail: `Variation prix: ${priceChange24h.toFixed(2)}% (min: ${minPriceChange24h}%)`,
        },
        {
          rule: 'min_volume',
          passed: volume24h >= minVolume24h,
          detail: `Volume 24h: $${volume24h.toLocaleString()}`,
        },
        {
          rule: 'min_liquidity',
          passed: liquidityUsd >= minLiquidity,
          detail: `Liquidité: $${liquidityUsd.toLocaleString()}`,
        },
        {
          rule: 'user_confirmation_required',
          passed: true,
          detail: 'Validation utilisateur obligatoire avant exécution réelle',
        },
      ],
    });
  }

  return actions;
}

export default strategy;
