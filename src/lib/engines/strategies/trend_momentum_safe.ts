import type { PreparedAction } from '../../types';
import { registerStrategy, makeRiskChecks, type StrategyContext, type StrategyPlugin } from './core';

const plugin: StrategyPlugin = {
  id: 'trend_momentum_safe',
  name: 'Tendance momentum (sécurisé)',
  description: 'Recherche des hausses régulières validées par le volume et la liquidité. Garde des tailles réduites.',
  inputs: {
    minPriceChange24h: { type: 'number', default: 6, label: 'Variation min 24h (%)' },
    minVolume24h: { type: 'number', default: 40000, label: 'Volume min 24h (USD)' },
    maxPriceChange24h: { type: 'number', default: 24, label: 'Variation max 24h (%)' },
    entrySizeUsd: { type: 'number', default: 15, label: 'Taille d’entrée (USD)' },
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
          reason: `Momentum sécurisé: +${priceChange.toFixed(1)}% avec confirmation volume`,
        },
        riskChecks: checks,
      });
    }

    return actions.slice(0, 3);
  },
  explain(action: PreparedAction): string {
    const p = action.payload;
    return `Tendance momentum: ${p.symbol || 'token'} avec force mesurée. Taille entrée $${p.entrySizeUsd}. Validation utilisateur obligatoire.`;
  },
};

registerStrategy(plugin);
export default plugin;
