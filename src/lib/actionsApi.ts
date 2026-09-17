import { getAdminToken } from './auth';
import { supabaseUrl } from './supabase';

const base = supabaseUrl ? `${supabaseUrl}/functions/v1/anbaybot-actions` : '';

async function call<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  if (!base) throw new Error('Backend actions non configuré');
  const token = getAdminToken();
  if (!token) throw new Error('Activez d’abord le token admin dans la barre supérieure.');
  const res = await fetch(`${base}?path=${encodeURIComponent(path)}`, {
    method,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Anbaybot-Admin-Token': token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : typeof payload?.error === 'string' ? payload.error : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export const actionsApi = {
  prepared: () => call<{ data: unknown[] }>('prepared'),
  prepareTransfer: (body: { sourceWalletId: string; asset: 'USDT' | 'TRX'; amount: number; destinationAddress: string; note?: string }) =>
    call<{ data: unknown; balances: { TRX: number; USDT: number }; broadcast: false }>('transfer/prepare', 'POST', body),
  prepareArbitrage: (body: { symbol: string; buyVenue: string; sellVenue: string; amountUsd: number; grossSpreadPct: number }) =>
    call<{ data: unknown; broadcast: false }>('arbitrage/prepare', 'POST', body),
};
