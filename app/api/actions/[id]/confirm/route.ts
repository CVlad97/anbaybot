import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ConfirmActionSchema = z.object({
  txSignature: z.string().min(64, 'Transaction signature must be at least 64 characters'),
  signedBy: z.string().min(32, 'Signer public key is required'),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    const validated = ConfirmActionSchema.parse(body);

    const action = await prisma.action.findUnique({
      where: { id: params.id },
      include: { wallet: true },
    });

    if (!action) {
      return NextResponse.json(
        { error: 'Action not found' },
        { status: 404 }
      );
    }

    if (action.status !== 'AWAITING_SIGNATURE' && action.status !== 'TX_BUILT') {
      return NextResponse.json(
        { error: `Action cannot be confirmed in ${action.status} status` },
        { status: 400 }
      );
    }

    // Update action to confirmed
    const updatedAction = await prisma.action.update({
      where: { id: action.id },
      data: {
        status: 'CONFIRMED',
        txSignature: validated.txSignature,
        signedBy: validated.signedBy,
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        chain: action.chain,
        signature: validated.txSignature,
        status: 'PENDING',
        actionId: action.id,
        walletId: action.walletId,
        meta: {
          signedBy: validated.signedBy,
          confirmedAt: new Date().toISOString(),
        },
      },
    });

    // Log confirmation
    await prisma.auditLog.create({
      data: {
        event: 'ACTION_CONFIRMED',
        actionId: action.id,
        walletId: action.walletId,
        meta: {
          txSignature: validated.txSignature,
          signedBy: validated.signedBy,
        },
      },
    });

    return NextResponse.json({ action: updatedAction });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Confirm action error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm action' },
      { status: 500 }
    );
  }
}
