import { useMemo, useState } from 'react';
import { AlertTriangle, Calculator, FlaskConical, ShieldCheck } from 'lucide-react';

const FUNDING_SNAPSHOTS = [
  { asset: 'BTCUSDT', grossPct: 0.176169, days: 10, annualizedPct: 6.4301685 },
  { asset: 'ETHUSDT', grossPct: 0.056489, days: 10, annualizedPct: 2.0618485 },
  { asset: 'SOLUSDT', grossPct: 0.035526, days: 10, annualizedPct: 1.296699 },
] as const;

const STRATEGIES = [
  ['Funding capture', 'Historique brut vérifié', 'Binance public funding history'],
  ['Futures directionnels', 'PAPER requis', 'Backtest + frais + liquidation'],
  ['Earn / staking', 'Non vérifié', 'APY fournisseur actuel requis'],
  ['Farming / LP', 'Non vérifié', 'APR - IL - gas - token decay'],
  ['Prediction / Polymarket', 'Non vérifié', 'Prix + probabilité + frais + résolution'],
  ['Arbitrage', 'Non vérifié', 'Bid/ask exécutables + latence + retraits'],
  ['SaaS / abonnements', 'Non vérifié', 'Paiements encaissés uniquement'],
  ['Referral', 'Non vérifié', 'Commissions versées uniquement'],
] as const;

function eur(value: number) {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 });
}
export default function RevenueLab() {
  const [asset, setAsset] = useState<(typeof FUNDING_SNAPSHOTS)[number]['asset']>('BTCUSDT');
  const [capital, setCapital] = useState(1000);
  const [costPct, setCostPct] = useState(0.1);

  const snapshot = FUNDING_SNAPSHOTS.find(row => row.asset === asset) ?? FUNDING_SNAPSHOTS[0];
  const calc = useMemo(() => {
    const gross = capital * snapshot.grossPct / 100;
    const costs = capital * Math.max(0, costPct) / 100;
    const net = gross - costs;
    const netRate = snapshot.grossPct - Math.max(0, costPct);
    return {
      gross,
      costs,
      net,
      breakEvenCostPct: snapshot.grossPct,
      capitalForOneGross: snapshot.grossPct > 0 ? 100 / snapshot.grossPct : null,
      capitalForOneNet: netRate > 0 ? 100 / netRate : null,
    };
  }, [capital, costPct, snapshot]);

  return (
    <section className="card p-5 mb-8 border border-brand-500/20">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-brand-600/10 flex items-center justify-center">
          <FlaskConical size={18} className="text-brand-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white">Laboratoire de revenus — preuve séparée du marketing</h2>
          <p className="text-sm text-surface-400 mt-1">
            Snapshot Binance public du 17/09/2026. Rendement funding brut historique, jamais présenté comme gain net ou futur garanti.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {FUNDING_SNAPSHOTS.map(row => (
          <button
            key={row.asset}
            onClick={() => setAsset(row.asset)}
            className={`text-left rounded-xl border p-4 ${asset === row.asset ? 'border-brand-500/50 bg-brand-500/10' : 'border-surface-800 bg-surface-950/40'}`}
          >
            <p className="text-xs text-surface-500 uppercase tracking-wider">{row.asset}</p>
            <p className="text-xl font-bold text-white mt-1">+{row.grossPct.toFixed(6)}%</p>
            <p className="text-xs text-surface-400 mt-1">funding brut cumulé / {row.days} jours</p>
            <p className="text-xs text-surface-500 mt-2">Annualisation simple indicative: {row.annualizedPct.toFixed(2)}%</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-xl border border-surface-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator size={16} className="text-brand-400" />
            <h3 className="font-medium text-white">Seuil de rentabilité</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-surface-400">Capital (€)
              <input className="input mt-1" type="number" min="0" step="100" value={capital} onChange={e => setCapital(Number(e.target.value) || 0)} />
            </label>
            <label className="text-xs text-surface-400">Coûts totaux (%)
              <input className="input mt-1" type="number" min="0" step="0.01" value={costPct} onChange={e => setCostPct(Number(e.target.value) || 0)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div><p className="text-surface-500">Brut historique</p><p className="font-semibold text-white">{eur(calc.gross)}</p></div>
            <div><p className="text-surface-500">Coûts saisis</p><p className="font-semibold text-white">{eur(calc.costs)}</p></div>
            <div><p className="text-surface-500">Net calculé</p><p className={`font-semibold ${calc.net >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>{eur(calc.net)}</p></div>
            <div><p className="text-surface-500">Seuil coûts max</p><p className="font-semibold text-white">{calc.breakEvenCostPct.toFixed(6)}%</p></div>
          </div>
          <p className="text-xs text-surface-500 mt-4">
            Capital théorique pour 1 € brut sur cet échantillon: {calc.capitalForOneGross ? eur(calc.capitalForOneGross) : '—'}.
            {' '}Pour 1 € net avec les coûts saisis: {calc.capitalForOneNet ? eur(calc.capitalForOneNet) : 'impossible (coûts ≥ brut)'}.
          </p>
        </div>

        <div className="rounded-xl border border-surface-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-brand-400" />
            <h3 className="font-medium text-white">Niveau de preuve par stratégie</h3>
          </div>
          <div className="space-y-2">
            {STRATEGIES.map(([name, status, source]) => (
              <div key={name} className="flex items-start justify-between gap-3 border-b border-surface-800/60 pb-2 last:border-0">
                <div><p className="text-sm text-surface-200">{name}</p><p className="text-xs text-surface-500">{source}</p></div>
                <span className={`text-[10px] whitespace-nowrap px-2 py-1 rounded-full border ${status.includes('vérifié') ? 'border-brand-500/30 text-brand-300' : 'border-warn-500/30 text-warn-300'}`}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-warn-500/30 bg-warn-500/10 px-4 py-3 flex gap-3 text-sm text-warn-100">
        <AlertTriangle size={18} className="text-warn-300 shrink-0 mt-0.5" />
        <p>
          La preuve actuelle porte sur un <strong>historique de funding brut</strong>, pas sur un bénéfice futur garanti.
          Pour passer en preuve nette, il faut renseigner les frais réels, le coût d’emprunt, le slippage, puis obtenir un résultat PAPER positif après tous coûts.
          Un résultat LIVE ne sera compté qu’après exécution, frais et P&L réalisés vérifiés.
        </p>
      </div>
    </section>
  );
}
