import type { PreparedAction } from '../../types';
import { registerStrategy, type StrategyPlugin } from './core';

const plugin: StrategyPlugin = {
  id: 'no_trade',
  name: 'Attente active',
  description: 'Ne retourne aucune action quand les conditions ne sont pas assez solides. Sert de garde-fou pour éviter les entrées forcées.',
  inputs: {
    reason: { type: 'string', default: 'Conditions non réunies', label: 'Raison' },
  },
  evaluate(): PreparedAction[] {
    return [];
  },
  explain(): string {
    return 'Aucun ordre: la meilleure décision est souvent d’attendre un signal plus clair.';
  },
};

registerStrategy(plugin);
export default plugin;
