import type { PreparedAction } from '../../types';
import { registerStrategy, makeRiskChecks, type StrategyContext, type StrategyPlugin } from './core';

const plugin: StrategyPlugin = {
  id: 'trend_momentum_safe',
  name: 'Trend Momentum (Safe)',
  description: 'Looks for steady upward moves with liquidity and volume confirmation. Keeps size small and avoids chasing vertical candles.',
  inputs: {
    minPriceChange24h: { type: 'number', default: 6, label: 'Min Price Change 24h (%)' },
    minVolume24h: { type: 'number', default: 40000, label: 'Min Volume 24h (USD)' },
    maxPriceChange24h: { type: 'number', default: 24, label: 'Max Price Change 24h (%)' },
    entrySizeUsd: { type: 'number', default: 15, label: 'Entry Size (USD)' },
  },
  evaluate(ctx: StrategyContext): PreparedAction[] {
    const dexSignals = ctx.signals.filter((s) => s.source === 'dexscreener');
    if (dexSignals.length === 0) return [];

    const actions: PreparedAction[] = [];
    for (const signal of dexSignals) {
      const meta = signal.meta as Record<string, unknown>;
      const priceChange = Number(meta.priceChange24h ?? 0);
      const volume = Number(meta.volume24h ?? 0);
      const liquidity = Number((meta.liquidity as { usd?: number })?.usd ?? meta.liquidityUsd ?? 0);

      if (priceChange < 6 || priceChange > 24 || volume < 40000 || liquidity < 25000) continue;

      const checks = makeRiskChecks(ctx, signal.token_address, liquidity);
      if (checks.some((check) => !check.passed)) continue;

      actions.push({
        type: 'ENTRY_PREPARED',
        chain: signal.chain,
        strategyId: 'trend_momentum_safe',
        payload: {
          tokenAddress: signal.token_address,
          symbol: signal.token_symbol,
          entrySizeUsd: 15,
          priceChange24h: priceChange,
          volume24h: volume,
          liquidityUsd: liquidity,
          stopLossPct: 2.5,
          takeProfitPct: 4.5,
          reason: `Safe momentum: +${priceChange.toFixed(1)}% with volume confirmation`,
        },
        riskChecks: checks,
      });
    }

    return actions.slice(0, 3);
  },
  explain(action: PreparedAction): string {
    const p = action.payload;
    return `Trend momentum: ${p.symbol || 'token'} with measured strength. Entry size $${p.entrySizeUsd}.`;
  },
};

registerStrategy(plugin);
export default plugin;
