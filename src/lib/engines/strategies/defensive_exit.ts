import type { PreparedAction } from '../../types';
import { registerStrategy, makeRiskChecks, type StrategyContext, type StrategyPlugin } from './core';

const plugin: StrategyPlugin = {
  id: 'defensive_exit',
  name: 'Sortie défensive',
  description: 'Surveille les positions en forte baisse et prépare une sortie défensive vers USDC.',
  inputs: {
    maxDrawdownPct: { type: 'number', default: -20, label: 'Drawdown max (%)' },
    volatilityThreshold: { type: 'number', default: 50, label: 'Seuil volatilité (%)' },
  },
  evaluate(ctx: StrategyContext): PreparedAction[] {
    const dexSignals = ctx.signals.filter(s => s.source === 'dexscreener');
    const actions: PreparedAction[] = [];

    for (const signal of dexSignals) {
      const meta = signal.meta as Record<string, unknown>;
      const priceChange = (meta.priceChange24h as number) || 0;
      const liquidity = ((meta.liquidity as { usd: number })?.usd) || (meta.liquidityUsd as number) || 0;

      if (priceChange > -20) continue;

      const checks = makeRiskChecks(ctx, signal.token_address, liquidity);

      actions.push({
        type: 'EXIT_PREPARED',
        chain: signal.chain,
        strategyId: 'defensive_exit',
        payload: {
          tokenAddress: signal.token_address,
          symbol: signal.token_symbol,
          exitTo: 'USDC',
          drawdown: priceChange,
          reason: `Sortie défensive: drawdown détecté à ${priceChange.toFixed(1)}%`,
        },
        riskChecks: checks,
      });
    }
    return actions.slice(0, 5);
  },
  explain(action: PreparedAction): string {
    const p = action.payload;
    return `Sortie défensive: ${p.symbol || 'token'} vers ${p.exitTo}. Drawdown: ${p.drawdown}%`;
  },
};

registerStrategy(plugin);
export default plugin;
