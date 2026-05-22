import type { PreparedAction } from '../../types';
import { registerStrategy, makeRiskChecks, type StrategyContext, type StrategyPlugin } from './core';

const plugin: StrategyPlugin = {
  id: 'volume_spike_safe',
  name: 'Pic de volume (sécurisé)',
  description: 'Prépare une entrée seulement si le volume monte avec une liquidité correcte et un mouvement encore maîtrisé.',
  inputs: {
    minVolume24h: { type: 'number', default: 60000, label: 'Volume min 24h (USD)' },
    minPriceChange24h: { type: 'number', default: 3, label: 'Variation min 24h (%)' },
    maxPriceChange24h: { type: 'number', default: 18, label: 'Variation max 24h (%)' },
    entrySizeUsd: { type: 'number', default: 10, label: 'Taille d’entrée (USD)' },
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
          reason: `Pic de volume avec extension contrôlée sur ${signal.token_symbol}`,
        },
        riskChecks: checks,
      });
    }

    return actions.slice(0, 3);
  },
  explain(action: PreparedAction): string {
    const p = action.payload;
    return `Pic de volume: ${p.symbol || 'token'} (${p.volume24h ? 'activité confirmée' : 'activité non confirmée'}). Validation utilisateur obligatoire.`;
  },
};

registerStrategy(plugin);
export default plugin;
