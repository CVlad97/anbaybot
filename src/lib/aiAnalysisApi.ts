import { getAdminToken } from './auth';
import { supabaseUrl } from './supabase';
import type { AIRecommendation } from './types';

export async function runDedicatedAIAnalysis(): Promise<AIRecommendation> {
  if (!supabaseUrl) throw new Error('Supabase non configuré');
  const token = getAdminToken();
  if (!token) throw new Error('Token admin requis pour lancer l’analyse IA');

  const res = await fetch(`${supabaseUrl}/functions/v1/anbaybot-ai`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Anbaybot-Admin-Token': token,
    },
  });

  const body = await res.json().catch(() => ({})) as { recommendation?: AIRecommendation; error?: string; message?: string };
  if (!res.ok || !body.recommendation) {
    throw new Error(body.message || body.error || `Analyse IA HTTP ${res.status}`);
  }
  return body.recommendation;
}
