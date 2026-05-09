import { createClient } from '@supabase/supabase-js';
import { makeLocalQuery } from './localDb';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-anon-key';
export const isDemoSupabase = supabaseUrl.includes('example.supabase.co') || supabaseAnonKey === 'demo-anon-key';

// Keep this client intentionally loose: the app can run against a typed
// Supabase backend or the local GitHub Pages demo adapter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = isDemoSupabase
  ? {
      from: (table: string) => makeLocalQuery(table),
    }
  : createClient(supabaseUrl, supabaseAnonKey);
