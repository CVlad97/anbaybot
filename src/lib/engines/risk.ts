import type { RiskCheck, RiskParams } from '../types';

export function runRiskChecks(params: {
  riskParams: RiskParams;
  killSwitch: boolean;
  todayTradeCount: number;
  tokenAddress: string;
  liquidity: number;
  slippageBps?: number;
  tradeSizeEur?: number;
}): RiskCheck[] {
  const checks: RiskCheck[] = [];

  checks.push({
    rule: 'kill_switch',
    passed: !params.killSwitch,
    detail: params.killSwitch ? 'Kill switch is ACTIVE - all operations blocked' : 'Kill switch OFF',
  });

  checks.push({
    rule: 'max_trades_per_day',
    passed: params.todayTradeCount < params.riskParams.maxTradesPerDay,
    detail: `${params.todayTradeCount}/${params.riskParams.maxTradesPerDay} trades executed today`,
  });

  checks.push({
    rule: 'token_blacklist',
    passed: !params.riskParams.tokenBlacklist.includes(params.tokenAddress),
    detail: params.riskParams.tokenBlacklist.includes(params.tokenAddress)
      ? 'Token is BLACKLISTED'
      : 'Token not in blacklist',
  });

  checks.push({
    rule: 'min_liquidity',
    passed: params.liquidity >= params.riskParams.minLiquidityUsd,
    detail: `Liquidity $${params.liquidity.toLocaleString()} (min: $${params.riskParams.minLiquidityUsd.toLocaleString()})`,
  });

  if (params.slippageBps !== undefined) {
    checks.push({
      rule: 'max_slippage',
      passed: params.slippageBps <= params.riskParams.maxSlippageBps,
      detail: `Slippage ${params.slippageBps}bps (max: ${params.riskParams.maxSlippageBps}bps)`,
    });
  }

  if (params.tradeSizeEur !== undefined) {
    checks.push({
      rule: 'max_trade_size',
      passed: params.tradeSizeEur <= params.riskParams.maxTradeSizeEur,
      detail: `Trade size ${params.tradeSizeEur} EUR (max: ${params.riskParams.maxTradeSizeEur} EUR)`,
    });
  }

  return checks;
}

export function allChecksPassed(checks: RiskCheck[]): boolean {
  return checks.every(c => c.passed);
}
