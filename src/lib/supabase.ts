import { createClient } from '@supabase/supabase-js';
import { makeLocalQuery } from './localDb';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const backendApiUrl = import.meta.env.VITE_BACKEND_API_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1/ikb-api` : '');
export const isDemoSupabase = import.meta.env.VITE_ANBAYBOT_DEMO_ENABLED === 'true';
export const isBackendConfigured = Boolean(backendApiUrl);

const RUNTIME_MODE_KEY = 'anbaybot_runtime_mode';
const RUNTIME_REASON_KEY = 'anbaybot_runtime_reason';
const RUNTIME_DOWN_AT_KEY = 'anbaybot_runtime_down_at';
const RUNTIME_EVENT = 'anbaybot-runtime-mode-changed';
export const RUNTIME_FALLBACK_COOLDOWN_MS = 60_000;

export type RuntimeBackendMode = 'server' | 'fallback';

function hasBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStorage(key: string) {
  if (!hasBrowserStorage()) return '';
  return window.localStorage.getItem(key) || '';
}

function writeStorage(key: string, value: string) {
  if (!hasBrowserStorage()) return;
  window.localStorage.setItem(key, value);
}

function removeStorage(key: string) {
  if (!hasBrowserStorage()) return;
  window.localStorage.removeItem(key);
}

function notifyRuntimeModeChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(RUNTIME_EVENT));
}

export function getRuntimeBackendMode(): RuntimeBackendMode {
  return readStorage(RUNTIME_MODE_KEY) === 'fallback' ? 'fallback' : 'server';
}

export function isRuntimeFallbackEnabled() {
  return getRuntimeBackendMode() === 'fallback';
}

export function getRuntimeFallbackInfo() {
  const downAtRaw = readStorage(RUNTIME_DOWN_AT_KEY);
  const downAt = Number(downAtRaw || 0);
  return {
    mode: getRuntimeBackendMode(),
    reason: readStorage(RUNTIME_REASON_KEY),
    downAt: Number.isFinite(downAt) ? downAt : 0,
  };
}

export function isRuntimeFallbackCoolingDown(now = Date.now()) {
  const info = getRuntimeFallbackInfo();
  if (info.mode !== 'fallback' || !info.downAt) return false;
  return now - info.downAt < RUNTIME_FALLBACK_COOLDOWN_MS;
}

export function setRuntimeBackendMode(mode: RuntimeBackendMode, reason = '') {
  if (mode === 'fallback') {
    writeStorage(RUNTIME_MODE_KEY, 'fallback');
    writeStorage(RUNTIME_REASON_KEY, reason || 'backend_unavailable');
    writeStorage(RUNTIME_DOWN_AT_KEY, String(Date.now()));
  } else {
    writeStorage(RUNTIME_MODE_KEY, 'server');
    removeStorage(RUNTIME_REASON_KEY);
    removeStorage(RUNTIME_DOWN_AT_KEY);
  }
  notifyRuntimeModeChanged();
}

export function clearRuntimeBackendFallback() {
  setRuntimeBackendMode('server');
}

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
