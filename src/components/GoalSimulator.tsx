import { useMemo, useState } from 'react';
import { Calculator, ShieldAlert, Target } from 'lucide-react';

function toPositiveNumber(value: string, fallback: number) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pct(value: number) {
  return `${(value * 100).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} %`;
}

function eur(value: number) {
  return value.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  });
}

function requiredDailyReturn(capital: number, targetProfit: number, days: number) {
  if (capital <= 0 || targetProfit <= 0 || days <= 0) return 0;
  return Math.pow((capital + targetProfit) / capital, 1 / days) - 1;
}

function daysToTarget(capital: number, targetProfit: number, modeledDailyReturn: number) {
  if (capital <= 0 || targetProfit <= 0 || modeledDailyReturn <= 0) return Infinity;
  return Math.log((capital + targetProfit) / capital) / Math.log(1 + modeledDailyReturn);
}

export default function GoalSimulator() {
  const [capitalInput, setCapitalInput] = useState('1000');
  const [targetInput, setTargetInput] = useState('1000');
  const [daysInput, setDaysInput] = useState('7');
  const [dailyReturnInput, setDailyReturnInput] = useState('0.25');

  const capital = toPositiveNumber(capitalInput, 1000);
  const target = toPositiveNumber(targetInput, 1000);
  const days = toPositiveNumber(daysInput, 7);
  const modeledDailyReturnPct = toPositiveNumber(dailyReturnInput, 0.25);
  const modeledDailyReturn = modeledDailyReturnPct / 100;

  const metrics = useMemo(() => {
    const required = requiredDailyReturn(capital, target, days);
    const toOneEuro = daysToTarget(capital, 1, modeledDailyReturn);
    const toThousand = daysToTarget(capital, 1000, modeledDailyReturn);
    const projectedCapital = capital * Math.pow(1 + modeledDailyReturn, days);
    return {
      required,
      toOneEuro,
      toThousand,
      projectedProfit: projectedCapital - capital,
    };
  }, [capital, target, days, modeledDailyReturn]);

  return (
    <section className="card p-5 mb-8 border border-brand-500/20">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-brand-600/10 flex items-center justify-center shrink-0">
          <Target size={18} className="text-brand-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white">Simulateur d’objectif personnel</h2>
          <p className="text-sm text-surface-400 mt-1">
            Calcul mathématique uniquement : il ne prédit pas le marché et ne garantit aucun gain.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <label className="text-sm text-surface-300">
          Capital de départ
          <input className="input mt-1 w-full" inputMode="decimal" value={capitalInput} onChange={e => setCapitalInput(e.target.value)} />
        </label>
        <label className="text-sm text-surface-300">
          Objectif de profit
          <input className="input mt-1 w-full" inputMode="decimal" value={targetInput} onChange={e => setTargetInput(e.target.value)} />
        </label>
        <label className="text-sm text-surface-300">
          Horizon (jours)
          <input className="input mt-1 w-full" inputMode="numeric" value={daysInput} onChange={e => setDaysInput(e.target.value)} />
        </label>
        <label className="text-sm text-surface-300">
          Rendement net/jour simulé (%)
          <input className="input mt-1 w-full" inputMode="decimal" value={dailyReturnInput} onChange={e => setDailyReturnInput(e.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-surface-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-surface-500">Rendement/jour requis</p>
          <p className="text-xl font-bold text-white mt-1">{pct(metrics.required)}</p>
          <p className="text-xs text-surface-500 mt-1">Pour +{eur(target)} en {days.toLocaleString('fr-FR')} jours</p>
        </div>
        <div className="rounded-xl bg-surface-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-surface-500">Délai théorique vers +1 €</p>
          <p className="text-xl font-bold text-white mt-1">{Number.isFinite(metrics.toOneEuro) ? `${metrics.toOneEuro.toFixed(2)} j` : '—'}</p>
          <p className="text-xs text-surface-500 mt-1">Au rendement saisi, composé</p>
        </div>
        <div className="rounded-xl bg-surface-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-surface-500">Délai théorique vers +1 000 €</p>
          <p className="text-xl font-bold text-white mt-1">{Number.isFinite(metrics.toThousand) ? `${metrics.toThousand.toFixed(1)} j` : '—'}</p>
          <p className="text-xs text-surface-500 mt-1">Sans retraits, pertes ni variation de rendement</p>
        </div>
        <div className="rounded-xl bg-surface-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-surface-500">Profit simulé sur l’horizon</p>
          <p className="text-xl font-bold text-white mt-1">{eur(metrics.projectedProfit)}</p>
          <p className="text-xs text-surface-500 mt-1">Hypothèse constante de {modeledDailyReturnPct.toLocaleString('fr-FR')} %/jour</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-surface-800 p-4 text-sm text-surface-300">
          <div className="flex items-center gap-2 font-medium text-white mb-2"><Calculator size={15} /> Formule</div>
          Rendement quotidien requis = ((capital + objectif) / capital)^(1 / jours) − 1.
          Tous les montants doivent être exprimés dans la même monnaie ; aucun taux de change n’est appliqué.
        </div>
        <div className="rounded-xl border border-warn-600/30 bg-warn-600/5 p-4 text-sm text-surface-300">
          <div className="flex items-center gap-2 font-medium text-warn-300 mb-2"><ShieldAlert size={15} /> Validation avant argent réel</div>
          Un objectif élevé sur une courte période implique mécaniquement un rendement requis très élevé. Le passage en réel doit rester séparé du paper trading et conserver validation humaine, limites de perte et kill switch.
        </div>
      </div>
    </section>
  );
}
