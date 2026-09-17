import { useCallback, useEffect, useState } from 'react';
import { Cpu, Info, RefreshCw } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { publicApi, type PublicStrategy } from '../lib/publicApi';

const MODE_LABELS: Record<string, string> = {
  RESEARCH: 'Recherche / vérification',
  PAPER_AUTO: 'PAPER automatique',
  TEST_AUTO: 'TEST automatique',
  USER_CONFIRM_LIVE: 'LIVE avec confirmation',
  DISABLED: 'Désactivée',
};

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<PublicStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await publicApi.strategies();
      setStrategies(data.strategies);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Catalogue indisponible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Cpu}
        title="Stratégies de revenus"
        subtitle="Un catalogue unique : marché, Earn, DeFi, prediction et revenus business"
        action={
          <button onClick={refresh} disabled={loading} className="btn-secondary flex items-center gap-2">
            {loading ? <LoadingSpinner size={14} /> : <RefreshCw size={14} />}
            Actualiser
          </button>
        }
      />

      <div className="card p-4 mb-6 border-l-4 border-l-brand-500/50">
        <div className="flex items-start gap-3">
          <Info size={17} className="text-brand-400 mt-0.5 shrink-0" />
          <div className="text-xs text-surface-400 space-y-1">
            <p>Les scans PAPER/TEST peuvent fonctionner automatiquement. Ils servent à chercher et mesurer les opportunités.</p>
            <p>Une stratégie marquée « scan on » n'a pas l'autorisation de déplacer des fonds. Le LIVE reste soumis à connexion réelle, limites de risque et confirmation.</p>
          </div>
        </div>
      </div>

      {error && <div className="card p-4 mb-6 text-sm text-danger-300">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {strategies.map(strategy => (
          <article key={strategy.strategy_key} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{strategy.name}</h3>
                <p className="text-xs text-surface-500 mt-1">{strategy.category}{strategy.venue ? ` · ${strategy.venue}` : ''}</p>
              </div>
              <span className="badge-neutral">{strategy.status}</span>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className={strategy.scan_enabled ? 'badge-success' : 'badge-neutral'}>{strategy.scan_enabled ? 'SCAN ON' : 'SCAN OFF'}</span>
              <span className="badge-neutral">{MODE_LABELS[strategy.execution_mode] || strategy.execution_mode}</span>
            </div>

            <p className="text-sm text-surface-400 mt-4">{strategy.note}</p>

            {strategy.connection_required.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-2">Connexions requises</p>
                <div className="flex flex-wrap gap-2">
                  {strategy.connection_required.map(item => <span key={item} className="badge-neutral">{item}</span>)}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      {!loading && strategies.length === 0 && (
        <div className="card p-8 text-center text-surface-500">Aucune stratégie serveur enregistrée.</div>
      )}
    </div>
  );
}
