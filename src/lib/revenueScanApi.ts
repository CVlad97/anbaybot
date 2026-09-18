import { getAdminToken } from './auth';
import { supabaseUrl } from './supabase';

const endpoint = supabaseUrl ? `${supabaseUrl}/functions/v1/revenue-scanner` : '';

export type YieldCandidate = {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  score: number;
};

export type RevenueScanResult = {
  status: string;
  bucket: string;
  strategies: number;
  fundingStatus: string;
  marketStatus: string;
  arbitrageStatus: string;
  yieldStatus: string;
  farmingStatus: string;
  capitalObservedUsd: number;
  yieldHourlyGrossUsd: number | null;
  bestFunding: { symbol: string; grossPct: number } | null;
  strongest24h: { symbol: string; changePct: number } | null;
  bestArbitrage: {
    symbol: string;
    buyVenue: string;
    sellVenue: string;
    buyPrice: number;
    sellPrice: number;
    grossSpreadPct: number;
  } | null;
  bestYield: YieldCandidate | null;
  bestFarm: YieldCandidate | null;
  liveExecution: false;
};

export async function runRevenueScan(): Promise<RevenueScanResult> {
  if (!endpoint) throw new Error('Revenue scanner non configuré');
  const token = getAdminToken();
  if (!token) throw new Error('Activez le token admin avant de lancer le scan.');
  const res = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Anbaybot-Admin-Token': token,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body?.error === 'string' ? body.error : `Scanner HTTP ${res.status}`);
  return body as RevenueScanResult;
}
