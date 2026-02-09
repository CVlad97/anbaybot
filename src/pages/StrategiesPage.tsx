import { Cpu, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { useAppStore } from '../store/appStore';
import { getStrategies } from '../lib/engines/strategies/index';
import '../lib/engines/strategies/copy_swap_filtered';
import '../lib/engines/strategies/momentum_dex';
import '../lib/engines/strategies/defensive_exit';
import '../lib/engines/strategies/payout_150_eur';

const STRATEGY_ICONS: Record<string, string> = {
  copy_swap_filtered: 'bg-blue-500/10 text-blue-400',
  momentum_dex: 'bg-brand-500/10 text-brand-400',
  defensive_exit: 'bg-danger-500/10 text-danger-400',
  payout_150_eur: 'bg-warn-500/10 text-warn-400',
};

export default function StrategiesPage() {
  const { enabledStrategies, setEnabledStrategies, addAuditLog } = useAppStore();
  const strategies = getStrategies();

  function toggle(id: string) {
    const next = enabledStrategies.includes(id)
      ? enabledStrategies.filter(s => s !== id)
      : [...enabledStrategies, id];
    setEnabledStrategies(next);
    addAuditLog('strategy_toggled', { id, enabled: next.includes(id) });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Cpu}
        title="Strategies"
        subtitle="Enable and configure trading strategy plugins"
      />

      <div className="card p-4 mb-6 border-l-4 border-l-brand-500/50">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-brand-400 mt-0.5 shrink-0" />
          <p className="text-xs text-surface-400">
            Each strategy is a plugin that evaluates market signals and prepares actions.
            All actions require your manual confirmation (signature) before execution.
            Adding new strategies in the future will not affect existing ones.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {strategies.map(s => {
          const enabled = enabledStrategies.includes(s.id);
          const colorCls = STRATEGY_ICONS[s.id] || 'bg-surface-800 text-surface-400';
          return (
            <div key={s.id} className={`card p-6 transition-all duration-200 ${enabled ? 'border-brand-600/20' : ''}`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorCls}`}>
                  <Cpu size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold text-white">{s.name}</h3>
                    {enabled ? <span className="badge-green">Active</span> : <span className="badge-neutral">Disabled</span>}
                  </div>
                  <p className="text-sm text-surface-400 mb-4">{s.description}</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(s.inputs).map(([key, input]) => (
                      <div key={key} className="text-xs px-3 py-1.5 bg-surface-800 rounded-lg border border-surface-700">
                        <span className="text-surface-500">{(input as { label: string }).label}:</span>{' '}
                        <span className="text-surface-200 font-mono">{String((input as { default: unknown }).default)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => toggle(s.id)} className="shrink-0 p-2 rounded-xl hover:bg-surface-800 transition-colors">
                  {enabled
                    ? <ToggleRight size={28} className="text-brand-400" />
                    : <ToggleLeft size={28} className="text-surface-600" />
                  }
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {strategies.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-surface-500">No strategy plugins loaded.</p>
        </div>
      )}
    </div>
  );
}
