import { createClient } from '@supabase/supabase-js';
import { makeLocalQuery } from './localDb';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const backendApiUrl = import.meta.env.VITE_BACKEND_API_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1/ikb-api` : '');
export const isDemoSupabase = import.meta.env.VITE_ANBAYBOT_DEMO_ENABLED === 'true';
export const isBackendConfigured = Boolean(backendApiUrl);

function unavailableQuery() {
  const error = new Error('Backend API is not configured. Set VITE_BACKEND_API_URL.');
  return {
    select: () => Promise.resolve({ data: null, error }),
    insert: () => Promise.resolve({ data: null, error }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error }) }),
    delete: () => ({ eq: () => Promise.resolve({ data: null, error }) }),
    order: () => Promise.resolve({ data: null, error }),
    limit: () => Promise.resolve({ data: null, error }),
    maybeSingle: () => Promise.resolve({ data: null, error }),
  };
}

// Keep this client intentionally loose for legacy components. Production
// screens should use the Edge Function API so secrets stay server-side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = isDemoSupabase
  ? {
      from: (table: string) => makeLocalQuery(table),
    }
  : supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : {
        from: () => unavailableQuery(),
      };
