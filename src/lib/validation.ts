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
  strategyId: z.string().min(1, 'Identifiant de stratégie requis'),
  actionType: ActionTypeSchema,
  tokenIn: z.string().min(1, 'Token d’entrée requis'),
  tokenOut: z.string().min(1, 'Token de sortie requis'),
  amountIn: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Le montant doit être un nombre positif'
  }),
  minAmountOut: z.string().optional(),
  walletId: z.string().uuid('Format ID wallet invalide'),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const BuildActionSchema = z.object({
  userPublicKey: z.string().min(32, 'La clé publique doit contenir au moins 32 caractères')
});

export const ConfirmActionSchema = z.object({
  txSignature: z.string().min(64, 'La signature transaction doit contenir au moins 64 caractères')
});

export const RefuseActionSchema = z.object({
  reason: z.string().min(1, 'Raison requise').max(500, 'La raison doit faire moins de 500 caractères')
});

export const MarketSearchSchema = z.object({
  query: z.string().min(1, 'Recherche requise').max(100, 'La recherche doit faire moins de 100 caractères'),
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
  walletId: z.string().uuid('Format ID wallet invalide').optional(),
  actionId: z.string().uuid('Format ID action invalide').optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ipAddress: z.string().optional()
});
