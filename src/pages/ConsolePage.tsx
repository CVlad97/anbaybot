import { useState, useEffect, useCallback } from 'react';
import {
  Terminal, Play, Check, X,
  AlertTriangle, Zap, Clock, ShieldAlert,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { useAppStore } from '../store/appStore';
import { useWalletStore } from '../store/walletStore';
import { supabase } from '../lib/supabase';
import { signAndSendWithProvider } from '../lib/wallets/solana';
import type { Action, Settings } from '../lib/types';

export default function ConsolePage() {
  const { actions, setActions, settings, setSettings, addAuditLog } = useAppStore();
  const { solanaAddress, solanaProvider } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [buildingId, setBuildingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [actRes, setRes] = await Promise.all([
      supabase.from('actions').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('settings').select('*').limit(1).maybeSingle(),
    ]);
    if (actRes.data) setActions(actRes.data as Action[]);
    if (setRes.data) setSettings(setRes.data as Settings);
  }, [setActions, setSettings]);

  useEffect(() => { loadData(); }, [loadData]);

  async function toggleKillSwitch() {
    if (!settings) return;
    const newState = !settings.kill_switch;
    await supabase.from('settings').update({ kill_switch: newState }).eq('id', settings.id);
    addAuditLog(newState ? 'kill_switch_activated' : 'kill_switch_deactivated', {});
    await loadData();
  }

  async function handleBuild(action: Action) {
    if (!solanaAddress || !solanaProvider) return;
    if (settings?.kill_switch) return;

    setBuildingId(action.id);
    addAuditLog('action_build_started', { actionId: action.id });

    try {
      await supabase.from('actions').update({ status: 'BUILDING', updated_at: new Date().toISOString() }).eq('id', action.id);
      await loadData();

      // In production, this would call Jupiter API for the swap transaction
      // For now, we simulate the build step
      const mockTxBase64 = '';

      if (mockTxBase64) {
        const sig = await signAndSendWithProvider(solanaProvider, mockTxBase64);
        await supabase.from('actions').update({ status: 'CONFIRMED', updated_at: new Date().toISOString() }).eq('id', action.id);
        await supabase.from('transactions').insert({
          action_id: action.id,
          signature: sig,
          explorer_url: `https://solscan.io/tx/${sig}`,
          status: 'SUCCESS',
        });
        addAuditLog('action_confirmed', { actionId: action.id, signature: sig });
      } else {
        await supabase.from('actions').update({ status: 'PREPARED', updated_at: new Date().toISOString() }).eq('id', action.id);
        addAuditLog('action_build_no_tx', { actionId: action.id, reason: 'Jupiter integration requires API key' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await supabase.from('actions').update({ status: 'FAILED', updated_at: new Date().toISOString() }).eq('id', action.id);
      addAuditLog('action_build_failed', { actionId: action.id, error: msg });
    } finally {
      setBuildingId(null);
      await loadData();
    }
  }

  async function handleRefuse(action: Action) {
    await supabase.from('actions').update({ status: 'REFUSED', updated_at: new Date().toISOString() }).eq('id', action.id);
    addAuditLog('action_refused', { actionId: action.id });
    await loadData();
  }

  async function runSignalScan() {
    setLoading(true);
    addAuditLog('manual_signal_scan_started', {});
    try {
      const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/TOKEN_IN_PLACEHOLDER');
      const data = await res.json();
      const pairs = (data.pairs || []).slice(0, 10);

      for (const pair of pairs) {
        const priceChange = pair.priceChange?.h24 || 0;
        const volume = pair.volume?.h24 || 0;
        const liquidity = pair.liquidity?.usd || 0;

        if (priceChange > 10 && volume > 30000 && liquidity > 10000) {
          await supabase.from('signals').insert({
            source: 'dexscreener',
            chain: 'solana',
            token_address: pair.baseToken?.address || '',
            token_symbol: pair.baseToken?.symbol || '',
            meta: { priceChange24h: priceChange, volume24h: volume, liquidity: { usd: liquidity }, priceUsd: pair.priceUsd },
          });

          const riskChecks = [
            { rule: 'liquidity_check', passed: liquidity >= 10000, detail: `Liq: $${(liquidity / 1000).toFixed(0)}K` },
            { rule: 'volume_check', passed: volume >= 30000, detail: `Vol: $${(volume / 1000).toFixed(0)}K` },
          ];

          if (riskChecks.every(r => r.passed)) {
            await supabase.from('actions').insert({
              type: 'ENTRY_PREPARED',
              status: 'PREPARED',
              chain: 'solana',
              strategy_id: 'momentum_dex',
              payload: {
                tokenAddress: pair.baseToken?.address,
                symbol: pair.baseToken?.symbol,
                priceUsd: pair.priceUsd,
                priceChange24h: priceChange,
                volume24h: volume,
                liquidity,
              },
              risk_checks: riskChecks,
            });
          }
        }
      }
    } catch {
      // API unavailable
    }
    await loadData();
    setLoading(false);
    addAuditLog('manual_signal_scan_completed', {});
  }

  const killSwitch = settings?.kill_switch || false;
  const prepared = actions.filter(a => a.status === 'PREPARED');
  const building = actions.filter(a => a.status === 'BUILDING');
  const history = actions.filter(a => ['CONFIRMED', 'REFUSED', 'FAILED', 'EXPIRED'].includes(a.status));

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Terminal}
        title="Semi-Auto Console"
        subtitle="Manage prepared actions and execute trades"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <button
          onClick={toggleKillSwitch}
          className={`card p-5 text-left transition-all duration-300 ${killSwitch ? 'border-danger-600/50 bg-danger-600/5' : 'border-brand-600/20'}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert size={20} className={killSwitch ? 'text-danger-400' : 'text-brand-400'} />
            <span className="text-sm font-semibold text-white">Kill Switch</span>
          </div>
          <p className={`text-2xl font-bold ${killSwitch ? 'text-danger-400' : 'text-brand-400'}`}>
            {killSwitch ? 'ACTIVE' : 'OFF'}
          </p>
          <p className="text-xs text-surface-500 mt-1">Click to toggle</p>
        </button>

        <button onClick={runSignalScan} disabled={loading || killSwitch} className="card-hover p-5 text-left">
          <div className="flex items-center gap-3 mb-2">
            {loading ? <LoadingSpinner size={20} /> : <Zap size={20} className="text-warn-400" />}
            <span className="text-sm font-semibold text-white">Scan Signals</span>
          </div>
          <p className="text-2xl font-bold text-white">{prepared.length}</p>
          <p className="text-xs text-surface-500 mt-1">Prepared actions</p>
        </button>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <Clock size={20} className="text-surface-400" />
            <span className="text-sm font-semibold text-white">Total Actions</span>
          </div>
          <p className="text-2xl font-bold text-white">{actions.length}</p>
          <p className="text-xs text-surface-500 mt-1">{history.filter(a => a.status === 'CONFIRMED').length} confirmed</p>
        </div>
      </div>

      {killSwitch && (
        <div className="card p-4 mb-6 border-l-4 border-l-danger-500 bg-danger-600/5 flex items-center gap-3">
          <AlertTriangle size={18} className="text-danger-400 shrink-0" />
          <p className="text-sm text-danger-400">Kill switch is ACTIVE. No new actions can be prepared or built. Deactivate to resume.</p>
        </div>
      )}

      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Play size={18} className="text-warn-400" />
        Pending Actions ({prepared.length + building.length})
      </h2>

      {prepared.length === 0 && building.length === 0 ? (
        <EmptyState
          icon={Terminal}
          title="No pending actions"
          description="Run a signal scan or wait for the automated worker to prepare actions."
          action={
            <button onClick={runSignalScan} disabled={loading || killSwitch} className="btn-primary">
              Scan Now
            </button>
          }
        />
      ) : (
        <div className="space-y-3 mb-8">
          {[...building, ...prepared].map(a => (
            <div key={a.id} className="card p-5 animate-slide-up">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={a.status} />
                    <span className="text-xs text-surface-500">{a.type}</span>
                    <span className="badge-neutral text-[10px]">{a.strategy_id}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {(a.payload as Record<string, string>).symbol || 'N/A'} --{' '}
                    {(a.payload as Record<string, string>).reason || a.type}
                  </p>
                </div>
                <span className="text-xs text-surface-500">{new Date(a.created_at).toLocaleString()}</span>
              </div>

              {a.risk_checks && a.risk_checks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {a.risk_checks.map((r, i) => (
                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded-md ${r.passed ? 'bg-brand-600/10 text-brand-400' : 'bg-danger-600/10 text-danger-400'}`}>
                      {r.passed ? 'OK' : 'FAIL'}: {r.detail}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleBuild(a)}
                  disabled={buildingId === a.id || killSwitch || !solanaAddress}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {buildingId === a.id ? <LoadingSpinner size={14} /> : <Check size={14} />}
                  Build & Sign
                </button>
                <button onClick={() => handleRefuse(a)} className="btn-danger flex items-center gap-2 text-sm">
                  <X size={14} />
                  Refuse
                </button>
              </div>
              {!solanaAddress && (
                <p className="text-xs text-warn-400 mt-2">Connect a Solana wallet to sign transactions</p>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-surface-400 mb-4">History ({history.length})</h2>
          <div className="space-y-2">
            {history.slice(0, 20).map(a => (
              <div key={a.id} className="card p-4 flex items-center gap-4 opacity-70">
                <StatusBadge status={a.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-300 truncate">
                    {(a.payload as Record<string, string>).symbol || 'N/A'} -- {a.type}
                  </p>
                </div>
                <span className="text-xs text-surface-600">{new Date(a.updated_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
