import type { PreparedAction } from '../../types';
import { registerStrategy, makeRiskChecks, type StrategyContext, type StrategyPlugin } from './index';

const plugin: StrategyPlugin = {
  id: 'mean_reversion_safe',
  name: 'Mean Reversion (Safe)',
  description: 'Uses only liquid assets and small sizes when the move is stretched but not broken.',
  inputs: {
    minLiquidityUsd: { type: 'number', default: 50000, label: 'Min Liquidity (USD)' },
    minOversoldChange24h: { type: 'number', default: -12, label: 'Min Price Change 24h (%)' },
    maxOversoldChange24h: { type: 'number', default: -4, label: 'Max Price Change 24h (%)' },
    entrySizeUsd: { type: 'number', default: 8, label: 'Entry Size (USD)' },
  },
  evaluate(ctx: StrategyContext): PreparedAction[] {
    const dexSignals = ctx.signals.filter((s) => s.source === 'dexscreener');
    const actions: PreparedAction[] = [];

    for (const signal of dexSignals) {
      const meta = signal.meta as Record<string, unknown>;
      const priceChange = Number(meta.priceChange24h ?? 0);
      const volume = Number(meta.volume24h ?? 0);
      const liquidity = Number((meta.liquidity as { usd?: number })?.usd ?? meta.liquidityUsd ?? 0);
      const rsi = Number(meta.rsi ?? 50);

      if (liquidity < 50000 || volume < 20000) continue;
      if (priceChange < -12 || priceChange > -4) continue;
      if (rsi > 40) continue;

      const checks = makeRiskChecks(ctx, signal.token_address, liquidity);
      if (checks.some((check) => !check.passed)) continue;

      actions.push({
        type: 'ENTRY_PREPARED',
        chain: signal.chain,
        strategyId: 'mean_reversion_safe',
        payload: {
          tokenAddress: signal.token_address,
          symbol: signal.token_symbol,
          entrySizeUsd: 8,
          priceChange24h: priceChange,
          volume24h: volume,
          liquidityUsd: liquidity,
          rsi,
          stopLossPct: 2,
          takeProfitPct: 3.5,
          reason: `Mean reversion candidate on ${signal.token_symbol} with liquid market conditions`,
        },
        riskChecks: checks,
      });
    }

    return actions.slice(0, 2);
  },
  explain(action: PreparedAction): string {
    const p = action.payload;
    return `Mean reversion: ${p.symbol || 'token'} is extended but still liquid.`;
  },
};

registerStrategy(plugin);
export default plugin;
