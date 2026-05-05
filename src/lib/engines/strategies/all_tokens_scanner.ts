import type { Strategy, PreparedAction, Signal, ManagedWallet } from '../../types';

const strategy: Strategy = {
  id: 'all_tokens_scanner',
  name: 'All Tokens Scanner',
  description: 'Scans ALL tokens on DEX (not just trending). Detects new launches, sudden volume spikes, and price explosions. Maximum coverage for opportunities.',
  enabled: false,
  inputs: {
    minVolumeSpike: 200,
    minPriceIncrease1h: 15,
    minLiquidityNew: 3000,
    maxTokenAgeHours: 24,
    allocationPct: 10,
    scanIntervalSeconds: 30,
    autoExecute: true,
  },
};

export async function execute(
  signals: Signal[],
  wallets: ManagedWallet[],
  portfolioValueUsd: number,
): Promise<PreparedAction[]> {
  const actions: PreparedAction[] = [];
  const minPriceIncrease1h = Number(strategy.inputs.minPriceIncrease1h);
  const minLiquidityNew = Number(strategy.inputs.minLiquidityNew);
  const allocationPct = Number(strategy.inputs.allocationPct);

  const enabledWallets = wallets.filter(w => w.enabled);
  if (enabledWallets.length === 0) return actions;

  const explosiveTokens = signals.filter(sig => {
    const meta = sig.meta as Record<string, unknown>;
    const priceChange = meta.priceChange as { h1?: number } | undefined;
    const liquidity = meta.liquidity as { usd?: number } | undefined;
    const priceChange1h = priceChange?.h1 || (meta.priceChange1h as number | undefined) || 0;
    const liq = liquidity?.usd || 0;
    const volumeSpike = (meta.volumeSpike as boolean | undefined) || false;

    return (priceChange1h >= minPriceIncrease1h || volumeSpike) && liq >= minLiquidityNew;
  });

  const sortedTokens = explosiveTokens.sort((a, b) => {
    const aMeta = a.meta as Record<string, unknown>;
    const bMeta = b.meta as Record<string, unknown>;
    const aPriceChange = aMeta.priceChange as { h1?: number } | undefined;
    const bPriceChange = bMeta.priceChange as { h1?: number } | undefined;
    const aPriority = (aPriceChange?.h1 || 0) + ((aMeta.volumeSpike as boolean | undefined) ? 50 : 0);
    const bPriority = (bPriceChange?.h1 || 0) + ((bMeta.volumeSpike as boolean | undefined) ? 50 : 0);
    return bPriority - aPriority;
  });

  for (const signal of sortedTokens.slice(0, 10)) {
    const wallet = enabledWallets[Math.floor(Math.random() * enabledWallets.length)];
    const tradeSize = (portfolioValueUsd * (allocationPct as number)) / 100;
    const meta = signal.meta as Record<string, unknown>;
    const priceChange = meta.priceChange as { h1?: number } | undefined;

    const reason = meta.volumeSpike
      ? `VOLUME SPIKE detected on ${signal.token_symbol}`
      : `EXPLOSIVE PUMP: ${signal.token_symbol} +${(priceChange?.h1 || 0).toFixed(1)}% in 1h`;

    actions.push({
      type: 'ENTRY_PREPARED',
      chain: signal.chain,
      strategyId: strategy.id,
      payload: {
        signal_id: signal.id,
        wallet_id: wallet.id,
        token_address: signal.token_address,
        token_symbol: signal.token_symbol,
        side: 'BUY',
        size_usd: tradeSize,
        price_change_1h: priceChange?.h1 || 0,
        liquidity_usd: (meta.liquidity as { usd?: number } | undefined)?.usd || 0,
        volume_spike: meta.volumeSpike || false,
        reason,
      },
      riskChecks: [
        {
          rule: 'explosive_move',
          passed: true,
          detail: reason,
        },
        {
          rule: 'sufficient_liquidity',
          passed: ((meta.liquidity as { usd?: number } | undefined)?.usd || 0) >= minLiquidityNew,
          detail: `Liquidity: $${(((meta.liquidity as { usd?: number } | undefined)?.usd || 0)).toLocaleString()}`,
        },
        {
          rule: 'auto_scan',
          passed: true,
          detail: 'Real-time scanning enabled',
        },
      ],
    });
  }

  return actions;
}

export default strategy;
