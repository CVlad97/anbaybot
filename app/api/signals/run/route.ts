import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTrendingTokens, getDexMovers } from '@/lib/market-apis';
import { getEnabledStrategies, StrategyContext } from '@/lib/strategies';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Verify CRON_SECRET for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check kill switch
    const settings = await prisma.settings.findUnique({
      where: { id: 'global' },
    });

    if (settings?.killSwitch) {
      return NextResponse.json(
        {
          message: 'Kill switch active - skipping signal run',
          reason: settings.killSwitchReason,
        },
        { status: 200 }
      );
    }

    // Fetch market data
    const [trendingResult, dexResult] = await Promise.all([
      getTrendingTokens(),
      getDexMovers(),
    ]);

    // Create signals from trending tokens
    const trendingSignals = await Promise.all(
      trendingResult.items.map(token =>
        prisma.signal.create({
          data: {
            tokenSymbol: token.symbol,
            tokenAddress: token.address,
            chain: token.chain,
            source: 'coingecko',
            signalType: 'trending',
            meta: {
              price: token.price,
              priceChange24h: token.priceChange24h,
              volume24h: token.volume24h,
              marketCap: token.marketCap,
            },
          },
        })
      )
    );

    // Create signals from DEX movers
    const dexSignals = await Promise.all(
      dexResult.items.slice(0, 30).map(token =>
        prisma.signal.create({
          data: {
            tokenSymbol: token.symbol,
            tokenAddress: token.address,
            chain: token.chain,
            source: 'dexscreener',
            signalType: 'volume_spike',
            meta: {
              price: token.price,
              priceChange24h: token.priceChange24h,
              volume24h: token.volume24h,
              liquidity: token.liquidity,
            },
          },
        })
      )
    );

    const allSignals = [...trendingSignals, ...dexSignals];

    // Get enabled wallets
    const wallets = await prisma.managedWallet.findMany({
      where: { enabled: true },
    });

    // Get settings for strategy context
    const riskParams = settings?.riskParams ? (typeof settings.riskParams === 'string' ? JSON.parse(settings.riskParams) : settings.riskParams) : {};
    const defaultSettings = {
      maxPositionSizePct: riskParams.maxPositionSizePct || 10,
      maxDailyLossPct: riskParams.maxDailyLossPct || 15,
      minLiquidityUsd: riskParams.minLiquidityUsd || 5000,
      maxSlippagePct: riskParams.maxSlippagePct || 5,
      payoutThresholdEur: settings?.payoutThresholdEur || 150,
    };

    // Build strategy context
    const ctx: StrategyContext = {
      signals: allSignals,
      wallets,
      settings: defaultSettings,
    };

    // Run all enabled strategies
    const strategies = getEnabledStrategies();
    const allActions = await Promise.all(
      strategies.map(strategy => strategy.evaluate(ctx))
    );

    // Flatten and create actions
    const preparedActions = allActions.flat();
    const createdActions = await Promise.all(
      preparedActions.map(actionData => {
        const { payload, ...rest } = actionData;
        const { riskChecks, ...remainingPayload } = payload;
        return prisma.action.create({
          data: {
            status: 'PREPARED',
            ...rest,
            payload: remainingPayload as any,
            riskChecks: (riskChecks || []) as any,
          },
        });
      })
    );

    // Log signal run
    await prisma.auditLog.create({
      data: {
        event: 'SIGNALS_RUN',
        meta: {
          signalsCreated: allSignals.length,
          actionsCreated: createdActions.length,
          strategies: strategies.map(s => s.id),
          apiErrors: {
            coingecko: trendingResult.error,
            dexscreener: dexResult.error,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      signalsCreated: allSignals.length,
      actionsCreated: createdActions.length,
      strategies: strategies.map(s => ({ id: s.id, name: s.name })),
    });
  } catch (error) {
    console.error('Signals run error:', error);

    // Log error
    await prisma.auditLog.create({
      data: {
        event: 'SIGNALS_RUN_ERROR',
        meta: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
    });

    return NextResponse.json(
      { error: 'Failed to run signals' },
      { status: 500 }
    );
  }
}
