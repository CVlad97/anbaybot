import { useState, useEffect, useCallback } from 'react';
import {
  Repeat, ToggleLeft, ToggleRight, Users, Shield,
  Percent, AlertTriangle, Zap,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import QuickStartBanner from '../components/QuickStartBanner';
import { useAppStore } from '../store/appStore';
import { api } from '../lib/api';
import { getStrategies } from '../lib/engines/strategies/index';
import type { AutoTradeConfig, FollowedWallet } from '../lib/types';

import '../lib/engines/strategies/copy_swap_filtered';
import '../lib/engines/strategies/trend_momentum_safe';
import '../lib/engines/strategies/breakout_retest_safe';
import '../lib/engines/strategies/volume_spike_safe';
import '../lib/engines/strategies/mean_reversion_safe';
import '../lib/engines/strategies/defensive_exit';
import '../lib/engines/strategies/no_trade';
import '../lib/engines/strategies/payout_150_eur';

const MODE_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  auto: { label: 'Full Auto', desc: 'AI confirms trades automatically', color: 'text-brand-400' },
  semi: { label: 'Semi-Auto', desc: 'AI suggests, you confirm', color: 'text-warn-400' },
  manual: { label: 'Manual', desc: 'Full manual control', color: 'text-surface-400' },
};

export default function AutoTradePage() {
  const { autoTradeConfigs, setAutoTradeConfigs, followedWallets, totalValueUsd, settings } = useAppStore();
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const strategies = getStrategies();

  const loadConfigs = useCallback(async () => {
    try {
      const { data } = await api.getAutoTradeConfig();
      setAutoTradeConfigs(data);
    } catch {
      // silent
    }
    setLoading(false);
  }, [setAutoTradeConfigs]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  async function updateConfig(strategyId: string, updates: Partial<AutoTradeConfig>) {
    setSaving(strategyId);
    const existing = autoTradeConfigs.find(c => c.strategy_id === strategyId);
    const payload = {
      strategy_id: strategyId,
      enabled: existing?.enabled ?? false,
      allocation_pct: existing?.allocation_pct ?? 10,
      max_loss_pct: existing?.max_loss_pct ?? 5,
      auto_stop_loss: existing?.auto_stop_loss ?? true,
      trader_mode: existing?.trader_mode ?? 'semi',
      selected_traders: existing?.selected_traders ?? [],
      ...updates,
    };
    try {
      await api.updateAutoTradeConfig(payload);
      await loadConfigs();
    } catch {
      // silent
    }
    setSaving(null);
  }

  const totalAllocation = autoTradeConfigs
    .filter(c => c.enabled)
    .reduce((sum, c) => sum + c.allocation_pct, 0);

  const killActive = settings?.kill_switch || false;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Repeat}
        title="Auto-Trade"
        subtitle="Configure automatic trading per strategy with allocation and risk limits"
      />

      <QuickStartBanner />

      {killActive && (
        <div className="card p-4 mb-6 border-l-4 border-l-danger-500 bg-danger-600/5 flex items-center gap-3">
          <AlertTriangle size={18} className="text-danger-400 shrink-0" />
          <p className="text-sm text-danger-400">Kill switch is ACTIVE. Auto-trading is paused.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Percent size={16} className="text-brand-400" />
            <span className="text-xs text-surface-500 uppercase tracking-wider">Total Allocation</span>
          </div>
          <p className={`text-2xl font-bold ${totalAllocation > 100 ? 'text-danger-400' : 'text-white'}`}>
            {totalAllocation.toFixed(0)}%
          </p>
          {totalAllocation > 100 && (
            <p className="text-[10px] text-danger-400 mt-1">Exceeds 100% -- reduce allocations</p>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-warn-400" />
            <span className="text-xs text-surface-500 uppercase tracking-wider">Available Balance</span>
          </div>
          <p className="text-2xl font-bold text-white">
            ${totalValueUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-surface-400" />
            <span className="text-xs text-surface-500 uppercase tracking-wider">Active Configs</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {autoTradeConfigs.filter(c => c.enabled).length} / {strategies.length}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <LoadingSpinner size={24} />
        </div>
      ) : (
        <div className="space-y-4">
          {strategies.map(strategy => {
            const config = autoTradeConfigs.find(c => c.strategy_id === strategy.id);
            const enabled = config?.enabled ?? false;
            const alloc = config?.allocation_pct ?? 10;
            const maxLoss = config?.max_loss_pct ?? 5;
            const autoStop = config?.auto_stop_loss ?? true;
            const mode = config?.trader_mode ?? 'semi';
            const selectedTraders = config?.selected_traders ?? [];
            const isSaving = saving === strategy.id;
            const allocUsd = totalValueUsd * (alloc / 100);

            return (
              <div key={strategy.id} className={`card p-6 transition-all ${enabled ? 'border-brand-600/20' : ''}`}>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-base font-semibold text-white">{strategy.name}</h3>
                      {enabled
                        ? <span className="badge-green">Active</span>
                        : <span className="badge-neutral">Disabled</span>}
                      {isSaving && <LoadingSpinner size={14} />}
                    </div>
                    <p className="text-sm text-surface-400">{strategy.description}</p>
                  </div>
                  <button
                    onClick={() => updateConfig(strategy.id, { enabled: !enabled })}
                    className="shrink-0 p-2 rounded-xl hover:bg-surface-800 transition-colors"
                  >
                    {enabled
                      ? <ToggleRight size={28} className="text-brand-400" />
                      : <ToggleLeft size={28} className="text-surface-600" />}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] text-surface-500 uppercase tracking-wider block mb-1.5">
                      Allocation ({alloc}% = ${allocUsd.toFixed(0)})
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={1}
                      value={alloc}
                      onChange={e => updateConfig(strategy.id, { allocation_pct: Number(e.target.value) })}
                      className="w-full accent-brand-500"
                    />
                    <div className="flex justify-between text-[10px] text-surface-600 mt-0.5">
                      <span>0%</span>
                      <span>50%</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-surface-500 uppercase tracking-wider block mb-1.5">
                      Max Loss ({maxLoss}%)
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={25}
                      step={1}
                      value={maxLoss}
                      onChange={e => updateConfig(strategy.id, { max_loss_pct: Number(e.target.value) })}
                      className="w-full accent-danger-500"
                    />
                    <div className="flex justify-between text-[10px] text-surface-600 mt-0.5">
                      <span>1%</span>
                      <span>25%</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-surface-500 uppercase tracking-wider block mb-1.5">
                      Trading Mode
                    </label>
                    <div className="flex gap-1">
                      {(['auto', 'semi', 'manual'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => updateConfig(strategy.id, { trader_mode: m })}
                          className={`flex-1 px-2 py-2 rounded-lg text-[10px] font-semibold transition-all ${
                            mode === m
                              ? 'bg-surface-700 ' + MODE_LABELS[m].color
                              : 'bg-surface-800/50 text-surface-500 hover:bg-surface-800'
                          }`}
                        >
                          {MODE_LABELS[m].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-surface-500 uppercase tracking-wider block mb-1.5">
                      Auto Stop-Loss
                    </label>
                    <button
                      onClick={() => updateConfig(strategy.id, { auto_stop_loss: !autoStop })}
                      className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-all ${
                        autoStop
                          ? 'bg-brand-600/10 text-brand-400 border border-brand-600/20'
                          : 'bg-surface-800 text-surface-500 border border-surface-700'
                      }`}
                    >
                      <Shield size={14} />
                      {autoStop ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>

                {strategy.id === 'copy_swap_filtered' && (
                  <TraderSelector
                    traders={followedWallets.filter(w => !w.blacklisted)}
                    selected={selectedTraders}
                    onSelect={(ids) => updateConfig(strategy.id, { selected_traders: ids })}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TraderSelector({ traders, selected, onSelect }: {
  traders: FollowedWallet[];
  selected: string[];
  onSelect: (ids: string[]) => void;
}) {
  if (traders.length === 0) return null;

  return (
    <div className="mt-5 pt-4 border-t border-surface-800">
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-surface-400" />
        <span className="text-xs text-surface-400 font-medium">Select Traders to Copy</span>
        <button
          onClick={() => onSelect(selected.length === traders.length ? [] : traders.map(t => t.id))}
          className="text-[10px] text-brand-400 hover:text-brand-300 ml-auto"
        >
          {selected.length === traders.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {traders.map(t => {
          const isSelected = selected.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => {
                const next = isSelected
                  ? selected.filter(id => id !== t.id)
                  : [...selected, t.id];
                onSelect(next);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-brand-600/15 text-brand-400 border border-brand-600/20'
                  : 'bg-surface-800 text-surface-400 border border-surface-700 hover:border-surface-600'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-[10px] opacity-70">({t.score})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
