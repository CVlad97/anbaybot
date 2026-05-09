import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-anon-key';
export const isDemoSupabase = supabaseUrl.includes('example.supabase.co') || supabaseAnonKey === 'demo-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
