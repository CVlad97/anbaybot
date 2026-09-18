import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Target, TrendingUp, Users, WalletCards } from 'lucide-react';
import { publicApi, type PublicWeeklyGoal } from '../lib/publicApi';

function eur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

export default function WeeklyGoalEngine() {
  const [goal, setGoal] = useState<PublicWeeklyGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setGoal(await publicApi.goal());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Objectif hebdomadaire indisponible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (error) {
    return <div className="card p-4 mb-6 border-l-4 border-l-danger-500 text-sm text-danger-300">{error}</div>;
  }

  return (
    <section className="card p-5 mb-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <Target size={20} className="text-brand-400 mt-0.5" />
          <div>
            <h2 className="font-semibold text-white">Weekly Goal Engine · 1 000 €/semaine</h2>
            <p className="text-xs text-surface-500 mt-1">Objectif suivi en revenus réels. Les scénarios de marché restent séparés des gains réalisés.</p>
          </div>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
        <Metric label="Objectif hebdo" value={eur(goal?.targetWeeklyEur || 1000)} sub={`≈ ${eur(goal?.targetDailyEur || 142.86)}/jour`} />
        <Metric label="Réalisé 7 jours" value={eur(goal?.actualEur7d || 0)} sub={`Trading ${eur(goal?.marketPnlEur7d || 0)} · Business ${eur(goal?.businessEur7d || 0)}`} />
        <Metric label="Capital observé" value={eur(goal?.capitalEur || 0)} sub={goal ? `FX EUR/USD ${goal.fx.eurUsd.toFixed(4)} · ${goal.fx.source}` : 'Calcul en cours'} />
        <Metric label="Écart à couvrir" value={eur(goal?.gapEur7d || 1000)} sub={goal?.requiredWeeklyReturnPct != null ? `Il faudrait ${goal.requiredWeeklyReturnPct.toFixed(1)}%/sem. via le capital seul` : '—'} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-surface-500 mb-2">
          <span>Progression réelle sur 7 jours</span>
          <span>{(goal?.progressPct || 0).toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${goal?.progressPct || 0}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div className="rounded-xl border border-surface-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-brand-400" />
            <h3 className="text-sm font-semibold text-white">Ce que le capital peut produire mathématiquement</h3>
          </div>
          <div className="space-y-2">
            {(goal?.marketScenarios || []).map(row => (
              <div key={row.weeklyPct} className="flex items-center justify-between text-xs">
                <span className="text-surface-400">{row.weeklyPct}% / semaine</span>
                <span className="text-white font-medium">{eur(row.weeklyEur)} · {row.targetCoveragePct.toFixed(1)}% de l'objectif</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-surface-500 mt-3">Références mathématiques uniquement. Elles ne prédisent pas les performances futures.</p>
        </div>

        <div className="rounded-xl border border-surface-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <WalletCards size={16} className="text-brand-400" />
            <h3 className="text-sm font-semibold text-white">Plan crédible vers 1 000 €/semaine</h3>
          </div>
          <p className="text-xs text-surface-400">
            En prenant 2%/semaine uniquement comme scénario de référence marché, cela représenterait environ <strong className="text-white">{eur(goal?.referenceMarketEur || 0)}</strong>. Il resterait environ <strong className="text-white">{eur(goal?.businessGapEur || 0)}</strong> à couvrir via revenus SaaS, affiliation/referral ou services.
          </p>
          <div className="mt-4 space-y-2">
            {(goal?.subscriptionTargets || []).map(row => (
              <div key={row.priceMonthlyEur} className="flex items-center justify-between text-xs">
                <span className="text-surface-400">{row.priceMonthlyEur} €/mois</span>
                <span className="text-white font-medium">{row.subscribersNeeded} abonnés pour ≈ 1 000 €/sem. de CA</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-surface-800 p-4 flex gap-3">
        <Users size={17} className="text-brand-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-white">Priorité de développement</p>
          <p className="text-xs text-surface-400 mt-1">1) connecter les exchanges et obtenir un historique réel, 2) garder le trading sous plafond de perte, 3) transformer ANBAYBOT en produit payant/referral afin que l'objectif ne dépende pas d'un rendement de marché irréaliste.</p>
        </div>
      </div>
    </section>
  );
}
