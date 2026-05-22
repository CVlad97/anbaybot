import type { PreparedAction } from '../../types';
import { registerStrategy, type StrategyPlugin } from './core';

const plugin: StrategyPlugin = {
  id: 'payout_150_eur',
  name: 'Préparation versement (150 EUR)',
  description:
    'Quand le seuil de gains réalisables est atteint (150 EUR par défaut), prépare une proposition de versement vers le wallet principal. Signature manuelle obligatoire.',
  inputs: {
    thresholdEur: { type: 'number', default: 150, label: 'Seuil versement (EUR)' },
  },
  evaluate(): PreparedAction[] {
    // This strategy is evaluated server-side with portfolio data
    // On client side, we return empty - the edge function handles the logic
    return [];
  },
  explain(action: PreparedAction): string {
    const p = action.payload;
    return `Proposition de versement: ${p.amountEur || 'N/A'} EUR vers le wallet principal. Signature manuelle obligatoire.`;
  },
};

registerStrategy(plugin);
export default plugin;
