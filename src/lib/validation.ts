import { z } from 'zod';

export const ActionTypeSchema = z.enum(['BUY', 'SELL', 'SWAP', 'TRANSFER', 'PAYOUT']);
export const ActionStatusSchema = z.enum([
  'PREPARED',
  'QUOTED',
  'TX_BUILT',
  'AWAITING_SIGNATURE',
  'SUBMITTED',
  'CONFIRMED',
  'FAILED',
  'REJECTED'
]);

export const PrepareActionSchema = z.object({
  strategyId: z.string().min(1, 'Strategy ID is required'),
  actionType: ActionTypeSchema,
  tokenIn: z.string().min(1, 'Token input is required'),
  tokenOut: z.string().min(1, 'Token output is required'),
  amountIn: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Amount must be a positive number'
  }),
  minAmountOut: z.string().optional(),
  walletId: z.string().uuid('Invalid wallet ID format'),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const BuildActionSchema = z.object({
  userPublicKey: z.string().min(32, 'Public key must be at least 32 characters')
});

export const ConfirmActionSchema = z.object({
  txSignature: z.string().min(64, 'Transaction signature must be at least 64 characters')
});

export const RefuseActionSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be less than 500 characters')
});

export const MarketSearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(100, 'Query must be less than 100 characters'),
  limit: z.number().int().min(1).max(50).optional().default(10)
});

export const SignalsRunSchema = z.object({
  strategyIds: z.array(z.string()).optional(),
  dryRun: z.boolean().optional().default(false)
});

export const KillSwitchSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().optional()
});

export const HeliusWebhookSchema = z.object({
  type: z.string(),
  signature: z.string(),
  slot: z.number(),
  timestamp: z.number(),
  accounts: z.array(z.string()).optional(),
  nativeTransfers: z.array(z.unknown()).optional(),
  tokenTransfers: z.array(z.unknown()).optional(),
  events: z.record(z.string(), z.unknown()).optional()
});

export const AuditLogSchema = z.object({
  event: z.string(),
  userId: z.string().optional(),
  walletId: z.string().uuid('Invalid wallet ID format').optional(),
  actionId: z.string().uuid('Invalid action ID format').optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ipAddress: z.string().optional()
});
