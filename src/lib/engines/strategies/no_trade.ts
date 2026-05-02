import type { PreparedAction } from '../../types';
import { registerStrategy, type StrategyContext, type StrategyPlugin } from './index';

const plugin: StrategyPlugin = {
  id: 'no_trade',
  name: 'No Trade',
  description: 'Explicitly returns no actions when conditions are not strong enough. Useful as a safe fallback and reminder that waiting is valid.',
  inputs: {
    reason: { type: 'string', default: 'Conditions not met', label: 'Reason' },
  },
  evaluate(_ctx: StrategyContext): PreparedAction[] {
    return [];
  },
  explain(): string {
    return 'No trade: the safest action is often to wait for a clearer setup.';
  },
};

registerStrategy(plugin);
export default plugin;
