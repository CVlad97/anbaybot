import type { ScoreReason } from '../types';

interface TokenMetrics {
  volume24h: number;
  liquidity: number;
  priceChange24h: number;
  txCount24h?: number;
  holders?: number;
}

export function scoreToken(metrics: TokenMetrics): { score: number; reasons: ScoreReason[] } {
  const reasons: ScoreReason[] = [];
  let totalScore = 0;

  const liqScore = metrics.liquidity >= 100000 ? 30 : metrics.liquidity >= 50000 ? 20 : metrics.liquidity >= 10000 ? 10 : 0;
  reasons.push({ metric: 'Liquidity', value: `$${(metrics.liquidity / 1000).toFixed(0)}K`, weight: liqScore });
  totalScore += liqScore;

  const volScore = metrics.volume24h >= 500000 ? 25 : metrics.volume24h >= 100000 ? 15 : metrics.volume24h >= 50000 ? 10 : 0;
  reasons.push({ metric: 'Volume 24h', value: `$${(metrics.volume24h / 1000).toFixed(0)}K`, weight: volScore });
  totalScore += volScore;

  const momentum = metrics.priceChange24h;
  const momScore = momentum > 50 ? 5 : momentum > 20 ? 15 : momentum > 5 ? 20 : momentum > -5 ? 10 : 0;
  reasons.push({ metric: 'Momentum', value: `${momentum.toFixed(1)}%`, weight: momScore });
  totalScore += momScore;

  const volLiqRatio = metrics.liquidity > 0 ? metrics.volume24h / metrics.liquidity : 0;
  const spreadScore = volLiqRatio > 0.5 && volLiqRatio < 5 ? 15 : volLiqRatio >= 0.1 ? 10 : 0;
  reasons.push({ metric: 'Vol/Liq Ratio', value: volLiqRatio.toFixed(2), weight: spreadScore });
  totalScore += spreadScore;

  if (metrics.txCount24h !== undefined) {
    const txScore = metrics.txCount24h > 1000 ? 10 : metrics.txCount24h > 100 ? 5 : 0;
    reasons.push({ metric: 'Tx Count 24h', value: String(metrics.txCount24h), weight: txScore });
    totalScore += txScore;
  }

  return { score: Math.min(totalScore, 100), reasons };
}

export function scoreWallet(metrics: {
  tradeFrequency: number;
  avgProfitPct: number;
  winRate: number;
  avgHoldTime: number;
  totalVolume: number;
}): { score: number; reasons: ScoreReason[] } {
  const reasons: ScoreReason[] = [];
  let totalScore = 0;

  const freqScore = metrics.tradeFrequency >= 5 ? 20 : metrics.tradeFrequency >= 2 ? 15 : metrics.tradeFrequency >= 1 ? 10 : 5;
  reasons.push({ metric: 'Trade Frequency', value: `${metrics.tradeFrequency}/day`, weight: freqScore });
  totalScore += freqScore;

  const winScore = metrics.winRate >= 70 ? 30 : metrics.winRate >= 50 ? 20 : metrics.winRate >= 30 ? 10 : 0;
  reasons.push({ metric: 'Win Rate', value: `${metrics.winRate.toFixed(0)}%`, weight: winScore });
  totalScore += winScore;

  const profitScore = metrics.avgProfitPct >= 20 ? 25 : metrics.avgProfitPct >= 10 ? 20 : metrics.avgProfitPct > 0 ? 10 : 0;
  reasons.push({ metric: 'Avg Profit', value: `${metrics.avgProfitPct.toFixed(1)}%`, weight: profitScore });
  totalScore += profitScore;

  const volScore = metrics.totalVolume >= 100000 ? 15 : metrics.totalVolume >= 10000 ? 10 : 5;
  reasons.push({ metric: 'Total Volume', value: `$${(metrics.totalVolume / 1000).toFixed(0)}K`, weight: volScore });
  totalScore += volScore;

  return { score: Math.min(totalScore, 100), reasons };
}
