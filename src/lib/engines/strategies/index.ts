import type { PreparedAction, RiskCheck } from '../../types';
import './trend_momentum_safe';
import './breakout_retest_safe';
import './volume_spike_safe';
import './mean_reversion_safe';
import './no_trade';
import './defensive_exit';
import './copy_swap_filtered';
import './payout_150_eur';
import './all_tokens_scanner';
import './ultra_aggressive';

export interface StrategyContext {
  signals: Array<{ source: string; chain: string; token_address: string; token_symbol: string; meta: Record<string, unknown> }>;
  followedWallets: Array<{ address: string; chain: string; enabled: boolean }>;
  riskParams: {
    maxTradeSizeEur: number;
    maxTradesPerDay: number;
    maxSlippageBps: number;
    tokenBlacklist: string[];
    minLiquidityUsd: number;
  };
  killSwitch: boolean;
  todayTradeCount: number;
}

export interface StrategyPlugin {
  id: string;
  name: string;
  description: string;
  inputs: Record<string, { type: string; default: unknown; label: string }>;
  evaluate: (ctx: StrategyContext) => PreparedAction[];
  explain: (action: PreparedAction) => string;
}

const registry: Map<string, StrategyPlugin> = new Map();

export function registerStrategy(plugin: StrategyPlugin) {
  registry.set(plugin.id, plugin);
}

export function getStrategies(): StrategyPlugin[] {
  return Array.from(registry.values());
}

export function getStrategy(id: string): StrategyPlugin | undefined {
  return registry.get(id);
}

export function evaluateAll(ctx: StrategyContext, enabledIds: string[]): PreparedAction[] {
  if (ctx.killSwitch) return [];
  const results: PreparedAction[] = [];
  for (const id of enabledIds) {
    const s = registry.get(id);
    if (!s) continue;
    try {
      const actions = s.evaluate(ctx);
      results.push(...actions);
    } catch {
      // strategy error - skip
    }
  }
  return results;
}

function makeRiskChecks(ctx: StrategyContext, token: string, liquidity: number): RiskCheck[] {
  const checks: RiskCheck[] = [];
  checks.push({
    rule: 'kill_switch',
    passed: !ctx.killSwitch,
    detail: ctx.killSwitch ? 'Kill switch is ON' : 'Kill switch OFF',
  });
  checks.push({
    rule: 'max_trades_per_day',
    passed: ctx.todayTradeCount < ctx.riskParams.maxTradesPerDay,
    detail: `${ctx.todayTradeCount}/${ctx.riskParams.maxTradesPerDay} trades today`,
  });
  checks.push({
    rule: 'token_blacklist',
    passed: !ctx.riskParams.tokenBlacklist.includes(token),
    detail: ctx.riskParams.tokenBlacklist.includes(token) ? 'Token is blacklisted' : 'Token not blacklisted',
  });
  checks.push({
    rule: 'min_liquidity',
    passed: liquidity >= ctx.riskParams.minLiquidityUsd,
    detail: `Liquidity $${liquidity.toLocaleString()} vs min $${ctx.riskParams.minLiquidityUsd.toLocaleString()}`,
  });
  return checks;
}

export { makeRiskChecks };
