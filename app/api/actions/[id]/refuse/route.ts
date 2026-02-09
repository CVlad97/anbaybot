import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const RefuseActionSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be less than 500 characters'),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validated = RefuseActionSchema.parse(body);

    const action = await prisma.action.findUnique({
      where: { id: params.id },
    });

    if (!action) {
      return NextResponse.json(
        { error: 'Action not found' },
        { status: 404 }
      );
    }

    if (!['PREPARED', 'QUOTED', 'TX_BUILT', 'AWAITING_SIGNATURE'].includes(action.status)) {
      return NextResponse.json(
        { error: `Cannot refuse action in ${action.status} status` },
        { status: 400 }
      );
    }

    // Update action to refused
    const updatedAction = await prisma.action.update({
      where: { id: action.id },
      data: {
        status: 'REFUSED',
        refusalReason: validated.reason,
      },
    });

    // Log refusal
    await prisma.auditLog.create({
      data: {
        event: 'ACTION_REFUSED',
        actionId: action.id,
        walletId: action.walletId,
        meta: {
          reason: validated.reason,
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

    console.error('Refuse action error:', error);
    return NextResponse.json(
      { error: 'Failed to refuse action' },
      { status: 500 }
    );
  }
}
