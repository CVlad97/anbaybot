import type { PreparedAction } from '../../types';
import { registerStrategy, makeRiskChecks, type StrategyContext, type StrategyPlugin } from './core';

const plugin: StrategyPlugin = {
  id: 'momentum_dex',
  name: 'Momentum (DexScreener)',
  description: 'Détecte les tokens en forte dynamique haussière et prépare de petites entrées sous contrôle.',
  inputs: {
    minPriceChange: { type: 'number', default: 15, label: 'Variation min 24h (%)' },
    minVolume24h: { type: 'number', default: 50000, label: 'Volume min 24h (USD)' },
    entrySizeUsd: { type: 'number', default: 20, label: 'Taille d’entrée (USD)' },
  },
  evaluate(ctx: StrategyContext): PreparedAction[] {
    const dexSignals = ctx.signals.filter(s => s.source === 'dexscreener');
    if (dexSignals.length === 0) return [];

    const actions: PreparedAction[] = [];
    for (const signal of dexSignals) {
      const meta = signal.meta as Record<string, unknown>;
      const priceChange = (meta.priceChange24h as number) || 0;
      const volume = (meta.volume24h as number) || 0;
      const liquidity = ((meta.liquidity as { usd: number })?.usd) || (meta.liquidityUsd as number) || 0;

      if (priceChange < 15 || volume < 50000) continue;

      const checks = makeRiskChecks(ctx, signal.token_address, liquidity);
      if (checks.some(c => !c.passed)) continue;

      actions.push({
        type: 'ENTRY_PREPARED',
        chain: signal.chain,
        strategyId: 'momentum_dex',
        payload: {
          tokenAddress: signal.token_address,
          symbol: signal.token_symbol,
          entrySizeUsd: 20,
          priceChange24h: priceChange,
          volume24h: volume,
          liquidity,
          reason: `Momentum: +${priceChange.toFixed(1)}% / Volume $${(volume / 1000).toFixed(0)}K`,
        },
        riskChecks: checks,
      });
    }
    return actions.slice(0, 3);
  },
  explain(action: PreparedAction): string {
    const p = action.payload;
    return `Entrée momentum: ${p.symbol || 'token'} pour $${p.entrySizeUsd}. ${p.reason}. Validation utilisateur obligatoire.`;
  },
};

registerStrategy(plugin);
export default plugin;
