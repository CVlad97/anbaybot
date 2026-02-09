import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CreateWalletSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  platform: z.enum(['phantom', 'solflare', 'metamask']),
  chain: z.enum(['solana', 'base', 'ethereum']),
  address: z.string().min(32, 'Address is required'),
  enabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const wallets = await prisma.managedWallet.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ wallets });
  } catch (error) {
    console.error('Get wallets error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = CreateWalletSchema.parse(body);

    // Check if wallet already exists
    const existing = await prisma.managedWallet.findUnique({
      where: { address: validated.address },
    });

    if (existing) {
      return NextResponse.json({ wallet: existing });
    }

    // Create new wallet
    const wallet = await prisma.managedWallet.create({
      data: {
        label: validated.label,
        platform: validated.platform,
        chain: validated.chain,
        address: validated.address,
        enabled: validated.enabled !== false,
      },
    });

    // Log wallet creation
    await prisma.auditLog.create({
      data: {
        event: 'WALLET_CREATED',
        walletId: wallet.id,
        meta: {
          label: wallet.label,
          platform: wallet.platform,
          chain: wallet.chain,
          address: wallet.address,
        },
      },
    });

    return NextResponse.json({ wallet }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Create wallet error:', error);
    return NextResponse.json(
      { error: 'Failed to create wallet' },
      { status: 500 }
    );
  }
}
