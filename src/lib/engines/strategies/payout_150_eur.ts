import type { PreparedAction } from '../../types';
import { registerStrategy, type StrategyPlugin } from './index';

const plugin: StrategyPlugin = {
  id: 'payout_150_eur',
  name: 'Auto-Payout (150 EUR)',
  description: 'When realizable gains reach the configured EUR threshold (default 150), prepares a payout to the primary wallet. Manual signature required.',
  inputs: {
    thresholdEur: { type: 'number', default: 150, label: 'Payout Threshold (EUR)' },
  },
  evaluate(): PreparedAction[] {
    // This strategy is evaluated server-side with portfolio data
    // On client side, we return empty - the edge function handles the logic
    return [];
  },
  explain(action: PreparedAction): string {
    const p = action.payload;
    return `Payout prepared: ${p.amountEur || 'N/A'} EUR to primary wallet. Manual signature required.`;
  },
};

registerStrategy(plugin);
export default plugin;
