import type { PreparedAction } from '../../types';
import { registerStrategy, makeRiskChecks, type StrategyContext, type StrategyPlugin } from './core';

const plugin: StrategyPlugin = {
  id: 'volume_spike_safe',
  name: 'Volume Spike (Safe)',
  description: 'Follows strong volume expansion only when liquidity stays healthy and the move is not too extended.',
  inputs: {
    minVolume24h: { type: 'number', default: 60000, label: 'Min Volume 24h (USD)' },
    minPriceChange24h: { type: 'number', default: 3, label: 'Min Price Change 24h (%)' },
    maxPriceChange24h: { type: 'number', default: 18, label: 'Max Price Change 24h (%)' },
    entrySizeUsd: { type: 'number', default: 10, label: 'Entry Size (USD)' },
  },
  evaluate(ctx: StrategyContext): PreparedAction[] {
    const dexSignals = ctx.signals.filter((s) => s.source === 'dexscreener');
    const actions: PreparedAction[] = [];

    for (const signal of dexSignals) {
      const meta = signal.meta as Record<string, unknown>;
      const priceChange = Number(meta.priceChange24h ?? 0);
      const volume = Number(meta.volume24h ?? 0);
      const liquidity = Number((meta.liquidity as { usd?: number })?.usd ?? meta.liquidityUsd ?? 0);
      const volumeSpike = Boolean(meta.volumeSpike ?? volume >= 60000);

      if (!volumeSpike || priceChange < 3 || priceChange > 18 || liquidity < 30000) continue;

      const checks = makeRiskChecks(ctx, signal.token_address, liquidity);
      if (checks.some((check) => !check.passed)) continue;

      actions.push({
        type: 'ENTRY_PREPARED',
        chain: signal.chain,
        strategyId: 'volume_spike_safe',
        payload: {
          tokenAddress: signal.token_address,
          symbol: signal.token_symbol,
          entrySizeUsd: 10,
          priceChange24h: priceChange,
          volume24h: volume,
          liquidityUsd: liquidity,
          volumeSpike,
          stopLossPct: 2.2,
          takeProfitPct: 4,
          reason: `Volume spike with controlled extension on ${signal.token_symbol}`,
        },
        riskChecks: checks,
      });
    }

    return actions.slice(0, 3);
  },
  explain(action: PreparedAction): string {
    const p = action.payload;
    return `Volume spike: ${p.symbol || 'token'} with ${p.volume24h ? 'confirmed' : 'unconfirmed'} activity.`;
  },
};

registerStrategy(plugin);
export default plugin;
