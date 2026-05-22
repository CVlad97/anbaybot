import type { PreparedAction } from '../../types';
import { registerStrategy, makeRiskChecks, type StrategyContext, type StrategyPlugin } from './core';

const plugin: StrategyPlugin = {
  id: 'copy_swap_filtered',
  name: 'Copie de swaps (filtrée)',
  description: 'Repère les swaps des wallets suivis et prépare une action contrôlée. Validation utilisateur obligatoire avant toute exécution.',
  inputs: {
    maxSlippageBps: { type: 'number', default: 300, label: 'Slippage max (bps)' },
    minTradeSizeUsd: { type: 'number', default: 10, label: 'Taille mini (USD)' },
  },
  evaluate(ctx: StrategyContext): PreparedAction[] {
    const heliusSignals = ctx.signals.filter(s => s.source === 'helius');
    if (heliusSignals.length === 0) return [];

    const actions: PreparedAction[] = [];
    for (const signal of heliusSignals) {
      const meta = signal.meta as Record<string, unknown>;
      const fromWallet = (meta.fromWallet as string) || '';
      const isFollowed = ctx.followedWallets.some(w => w.address === fromWallet && w.enabled);
      if (!isFollowed) continue;

      const liquidity = (meta.liquidity as number) || 0;
      const checks = makeRiskChecks(ctx, signal.token_address, liquidity);
      if (checks.some(c => !c.passed)) continue;

      actions.push({
        type: 'SWAP_PREPARED',
        chain: signal.chain,
        strategyId: 'copy_swap_filtered',
        payload: {
          tokenIn: meta.tokenIn || 'SOL',
          tokenOut: signal.token_address,
          symbol: signal.token_symbol,
          amountIn: meta.amountUsd || 0,
          slippageBps: ctx.riskParams.maxSlippageBps,
          reason: `Swap suivi détecté depuis ${fromWallet.slice(0, 8)}...`,
        },
        riskChecks: checks,
      });
    }
    return actions;
  },
  explain(action: PreparedAction): string {
    const p = action.payload;
    return `Préparation copie swap: ${p.symbol || 'token'} (~$${p.amountIn}). Slippage ${p.slippageBps} bps. Confirmation utilisateur requise.`;
  },
};

registerStrategy(plugin);
export default plugin;
