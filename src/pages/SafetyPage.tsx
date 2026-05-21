import { useState, useEffect, useCallback } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, RefreshCw,
  Activity, AlertTriangle, Settings, Clock,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAppStore } from '../store/appStore';
import { api } from '../lib/api';
import type { Settings as SettingsType, AuditLog } from '../lib/types';

export default function SafetyPage() {
  const { settings, setSettings, auditLogs, setAuditLogs } = useAppStore();
  const [apiStatuses, setApiStatuses] = useState<Record<string, 'ok' | 'error' | 'checking'>>({});
  const [editMode, setEditMode] = useState(false);
  const [riskForm, setRiskForm] = useState({
    maxTradeSizeEur: 50,
    maxTradesPerDay: 10,
    maxSlippageBps: 300,
    minLiquidityUsd: 10000,
    payoutThresholdEur: 150,
  });

  const loadData = useCallback(async () => {
    const [setRes, logRes] = await Promise.all([
      api.getSettings(),
      api.getAudit(),
    ]);
    if (setRes.data) {
      const s = setRes.data as SettingsType;
      setSettings(s);
      setRiskForm({
        maxTradeSizeEur: s.risk_params.maxTradeSizeEur,
        maxTradesPerDay: s.risk_params.maxTradesPerDay,
        maxSlippageBps: s.risk_params.maxSlippageBps,
        minLiquidityUsd: s.risk_params.minLiquidityUsd,
        payoutThresholdEur: s.payout_threshold_eur,
      });
    }
    if (logRes.data) setAuditLogs(logRes.data as AuditLog[]);
  }, [setSettings, setAuditLogs]);

  useEffect(() => { loadData(); }, [loadData]);

  async function checkApis() {
    setApiStatuses({ coingecko: 'checking', dexscreener: 'checking' });

    const checks = await Promise.allSettled([
      fetch('https://api.coingecko.com/api/v3/ping').then(r => r.ok),
      fetch('https://api.dexscreener.com/latest/dex/search?q=SOL').then(r => r.ok),
    ]);

    setApiStatuses({
      coingecko: checks[0].status === 'fulfilled' && checks[0].value ? 'ok' : 'error',
      dexscreener: checks[1].status === 'fulfilled' && checks[1].value ? 'ok' : 'error',
    });
  }

  async function saveRiskParams() {
    if (!settings) return;
    await api.updateSettings({
      risk_params: {
        maxTradeSizeEur: riskForm.maxTradeSizeEur,
        maxTradesPerDay: riskForm.maxTradesPerDay,
        maxSlippageBps: riskForm.maxSlippageBps,
        minLiquidityUsd: riskForm.minLiquidityUsd,
        tokenBlacklist: settings.risk_params.tokenBlacklist,
      },
      payout_threshold_eur: riskForm.payoutThresholdEur,
      updated_at: new Date().toISOString(),
    });
    setEditMode(false);
    await loadData();
  }

  const killSwitch = settings?.kill_switch || false;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Shield}
        title="Safety"
        subtitle="Risk parameters, API status, and audit trail"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className={`card p-6 ${killSwitch ? 'border-danger-600/50' : 'border-brand-600/20'}`}>
          <div className="flex items-center gap-3 mb-4">
            {killSwitch ? <ShieldAlert size={24} className="text-danger-400" /> : <ShieldCheck size={24} className="text-brand-400" />}
            <div>
              <h3 className="text-lg font-semibold text-white">Kill Switch</h3>
              <p className="text-xs text-surface-500">Emergency stop for all operations</p>
            </div>
          </div>
          <div className={`text-3xl font-bold mb-2 ${killSwitch ? 'text-danger-400' : 'text-brand-400'}`}>
            {killSwitch ? 'ACTIVE' : 'INACTIVE'}
          </div>
          <p className="text-xs text-surface-500">Managed from the Console page</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity size={24} className="text-brand-400" />
              <div>
                <h3 className="text-lg font-semibold text-white">API Status</h3>
                <p className="text-xs text-surface-500">External service health</p>
              </div>
            </div>
            <button onClick={checkApis} className="btn-ghost p-2"><RefreshCw size={16} /></button>
          </div>
          <div className="space-y-3">
            {(['coingecko', 'dexscreener'] as const).map(api => (
              <div key={api} className="flex items-center justify-between">
                <span className="text-sm text-surface-300 capitalize">{api}</span>
                {apiStatuses[api] === 'checking' ? (
                  <LoadingSpinner size={16} />
                ) : apiStatuses[api] === 'ok' ? (
                  <span className="badge-green">Online</span>
                ) : apiStatuses[api] === 'error' ? (
                  <span className="badge-red">Offline</span>
                ) : (
                  <span className="badge-neutral">Not checked</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-surface-400" />
            <h3 className="text-lg font-semibold text-white">Risk Parameters</h3>
          </div>
          <button onClick={() => setEditMode(!editMode)} className="btn-secondary text-sm">
            {editMode ? 'Cancel' : 'Edit'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Max Trade Size (EUR)', key: 'maxTradeSizeEur' as const },
            { label: 'Max Trades/Day', key: 'maxTradesPerDay' as const },
            { label: 'Max Slippage (bps)', key: 'maxSlippageBps' as const },
            { label: 'Min Liquidity (USD)', key: 'minLiquidityUsd' as const },
            { label: 'Payout Threshold (EUR)', key: 'payoutThresholdEur' as const },
          ].map(field => (
            <div key={field.key}>
              <label className="text-xs text-surface-500 block mb-1.5">{field.label}</label>
              {editMode ? (
                <input
                  type="number"
                  className="input"
                  value={riskForm[field.key]}
                  onChange={e => setRiskForm({ ...riskForm, [field.key]: Number(e.target.value) })}
                />
              ) : (
                <p className="text-lg font-mono font-semibold text-white">{riskForm[field.key].toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
        {editMode && (
          <div className="flex gap-3 mt-6">
            <button onClick={saveRiskParams} className="btn-primary">Save Changes</button>
            <button onClick={() => setEditMode(false)} className="btn-ghost">Cancel</button>
          </div>
        )}

        {settings?.risk_params.tokenBlacklist && settings.risk_params.tokenBlacklist.length > 0 && (
          <div className="mt-6 pt-6 border-t border-surface-800">
            <h4 className="text-sm font-semibold text-surface-300 mb-3">Token Blacklist</h4>
            <div className="flex flex-wrap gap-2">
              {settings.risk_params.tokenBlacklist.map((t, i) => (
                <span key={i} className="badge-red font-mono text-[10px]">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Clock size={20} className="text-surface-400" />
          <h3 className="text-lg font-semibold text-white">Audit Log</h3>
          <span className="badge-neutral">{auditLogs.length} entries</span>
        </div>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-8">No audit events recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {auditLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-surface-800/50 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-surface-600 mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-surface-200 font-medium">{log.event}</p>
                    {log.event.includes('kill') && <AlertTriangle size={12} className="text-danger-400" />}
                  </div>
                  {Object.keys(log.meta).length > 0 && (
                    <p className="text-xs text-surface-500 font-mono mt-0.5 truncate">
                      {JSON.stringify(log.meta).slice(0, 120)}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-surface-600 shrink-0">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
