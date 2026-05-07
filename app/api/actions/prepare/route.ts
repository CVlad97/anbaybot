import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PrepareActionSchema = z.object({
  strategyId: z.string().min(1, 'Strategy ID is required'),
  actionType: z.enum(['BUY', 'SELL', 'SWAP', 'PAYOUT']),
  chain: z.string().min(1, 'Chain is required'),
  tokenIn: z.string().min(1, 'Token input is required'),
  tokenOut: z.string().min(1, 'Token output is required'),
  amountIn: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Amount must be a positive number',
  }),
  expectedAmountOut: z.string().optional(),
  minAmountOut: z.string().optional(),
  walletId: z.string().uuid('Invalid wallet ID format'),
  signalId: z.string().uuid('Invalid signal ID format').optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  riskChecks: z.record(z.string(), z.unknown()).optional(),
  testMode: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    // Check kill switch
    const settings = await prisma.settings.findUnique({
      where: { id: 'global' },
    });

    if (settings?.killSwitch) {
      return NextResponse.json(
        { error: 'Trading is currently disabled (Kill Switch active)', reason: settings.killSwitchReason },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = PrepareActionSchema.parse(body);

    // Verify wallet exists and is enabled
    const wallet = await prisma.managedWallet.findUnique({
      where: { id: validated.walletId },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    if (!wallet.enabled) {
      return NextResponse.json(
        { error: 'Wallet is disabled' },
        { status: 400 }
      );
    }

    // Test mode: create minimal SOL->USDC swap for pipeline validation
    if (validated.testMode) {
      const action = await prisma.action.create({
        data: {
          status: 'PREPARED',
          actionType: 'SWAP',
          chain: 'solana',
          strategyId: 'test_mode',
          tokenIn: 'TOKEN_IN_PLACEHOLDER',
          tokenOut: 'TOKEN_OUT_PLACEHOLDER',
          amountIn: '10000000',
          walletId: validated.walletId,
          payload: { reasons: ['Test action for pipeline validation'], testMode: true } as Prisma.InputJsonValue,
          riskChecks: { allPassed: true, checks: [] } as Prisma.InputJsonValue,
        },
        include: {
          wallet: true,
          signal: true,
        },
      });

      return NextResponse.json({ action }, { status: 201 });
    }

    // Create action in PREPARED status
    const action = await prisma.action.create({
      data: {
        status: 'PREPARED',
        actionType: validated.actionType,
        chain: validated.chain,
        strategyId: validated.strategyId,
        tokenIn: validated.tokenIn,
        tokenOut: validated.tokenOut,
        amountIn: validated.amountIn,
        expectedAmountOut: validated.expectedAmountOut,
        minAmountOut: validated.minAmountOut,
        walletId: validated.walletId,
        signalId: validated.signalId,
        payload: (validated.payload || {}) as Prisma.InputJsonValue,
        riskChecks: (validated.riskChecks || {}) as Prisma.InputJsonValue,
      },
      include: {
        wallet: true,
        signal: true,
      },
    });

    // Log action creation
    await prisma.auditLog.create({
      data: {
        event: 'ACTION_PREPARED',
        actionId: action.id,
        walletId: validated.walletId,
        meta: {
          strategyId: validated.strategyId,
          actionType: validated.actionType,
          tokenIn: validated.tokenIn,
          tokenOut: validated.tokenOut,
        },
      },
    });

    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Prepare action error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare action' },
      { status: 500 }
    );
  }
}
