import type { PreparedAction } from '../../types';
import { registerStrategy, makeRiskChecks, type StrategyContext, type StrategyPlugin } from './index';

const plugin: StrategyPlugin = {
  id: 'breakout_retest_safe',
  name: 'Breakout Retest (Safe)',
  description: 'Waits for a breakout and a clean retest before preparing an entry. Avoids buying the first impulse candle.',
  inputs: {
    minPriceChange24h: { type: 'number', default: 4, label: 'Min Price Change 24h (%)' },
    maxPriceChange24h: { type: 'number', default: 20, label: 'Max Price Change 24h (%)' },
    minVolume24h: { type: 'number', default: 30000, label: 'Min Volume 24h (USD)' },
    entrySizeUsd: { type: 'number', default: 12, label: 'Entry Size (USD)' },
  },
  evaluate(ctx: StrategyContext): PreparedAction[] {
    const dexSignals = ctx.signals.filter((s) => s.source === 'dexscreener');
    const actions: PreparedAction[] = [];

    for (const signal of dexSignals) {
      const meta = signal.meta as Record<string, unknown>;
      const priceChange = Number(meta.priceChange24h ?? 0);
      const volume = Number(meta.volume24h ?? 0);
      const liquidity = Number((meta.liquidity as { usd?: number })?.usd ?? meta.liquidityUsd ?? 0);
      const retestConfirmed = Boolean(meta.retestConfirmed ?? meta.breakoutRetest ?? false);

      if (priceChange < 4 || priceChange > 20 || volume < 30000 || liquidity < 25000) continue;
      if (!retestConfirmed && priceChange > 15) continue;

      const checks = makeRiskChecks(ctx, signal.token_address, liquidity);
      if (checks.some((check) => !check.passed)) continue;

      actions.push({
        type: 'ENTRY_PREPARED',
        chain: signal.chain,
        strategyId: 'breakout_retest_safe',
        payload: {
          tokenAddress: signal.token_address,
          symbol: signal.token_symbol,
          entrySizeUsd: 12,
          priceChange24h: priceChange,
          volume24h: volume,
          liquidityUsd: liquidity,
          retestConfirmed,
          stopLossPct: 2.8,
          takeProfitPct: 5.2,
          reason: retestConfirmed
            ? `Breakout retest confirmed on ${signal.token_symbol}`
            : `Potential breakout on ${signal.token_symbol}, but only small size is considered`,
        },
        riskChecks: checks,
      });
    }

    return actions.slice(0, 3);
  },
  explain(action: PreparedAction): string {
    const p = action.payload;
    return `Breakout retest: ${p.symbol || 'token'} with retest=${String(p.retestConfirmed)}.`;
  },
};

registerStrategy(plugin);
export default plugin;
