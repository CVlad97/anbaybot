import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, RefreshCw, ShieldCheck, Target } from 'lucide-react';
import { publicApi, type PublicChallenge48h } from '../lib/publicApi';

function usd(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function Challenge48hPanel() {
  const [data, setData] = useState<PublicChallenge48h | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await publicApi.challenge());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Challenge 48h indisponible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const session = data?.session;
  const cp = data?.checkpoint;
  const open = useMemo(() => (data?.positions || []).filter(p => p.status === 'OPEN'), [data]);
  const closed = useMemo(() => (data?.positions || []).filter(p => p.status === 'CLOSED'), [data]);
  const returnPct = Number(cp?.return_pct || 0);
  const benchmark = Number(cp?.benchmark_return_pct || 0);
  const relative = returnPct - benchmark;
  const targetMin = Number(session?.target_min_pct || 2);
  const progress = Math.max(0, Math.min(100, targetMin ? returnPct / targetMin * 100 : 0));

  if (error) return <div className="card p-4 mb-6 border-l-4 border-l-danger-500 text-sm text-danger-300">{error}</div>;
  if (!session) return null;

  return (
    <section className="card p-5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Target size={20} className="text-brand-400 mt-0.5" />
          <div>
            <h2 className="font-semibold text-white">Challenge personnel 48 h · objectif {session.target_min_pct}% à {session.target_max_pct}%</h2>
            <p className="text-xs text-surface-500 mt-1">
              Preuve PAPER mesurée, frais + slippage inclus, benchmark BTC/ETH/SOL. Aucun fonds réel déplacé.
            </p>
          </div>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
        <Metric label="Capital de départ" value={usd(Number(session.start_capital_usd || 0))} />
        <Metric label="P&L challenge" value={`${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(3)}%`} />
        <Metric label="Benchmark" value={`${benchmark >= 0 ? '+' : ''}${benchmark.toFixed(3)}%`} />
        <Metric label="Alpha vs benchmark" value={`${relative >= 0 ? '+' : ''}${relative.toFixed(3)} pt`} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-surface-500 mb-2">
          <span>Progression vers {targetMin}% net</span>
          <span>{progress.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 text-xs">
        <div className="rounded-xl border border-surface-800 p-4">
          <div className="flex items-center gap-2 text-surface-400"><Activity size={14} /> État</div>
          <p className="text-white font-semibold mt-2">{session.status}</p>
          <p className="text-surface-500 mt-1">{open.length} position(s) ouverte(s) · {closed.length} clôturée(s)</p>
        </div>
        <div className="rounded-xl border border-surface-800 p-4">
          <div className="flex items-center gap-2 text-surface-400"><ShieldCheck size={14} /> Risque</div>
          <p className="text-white font-semibold mt-2">Drawdown {Number(cp?.drawdown_pct || 0).toFixed(3)}%</p>
          <p className="text-surface-500 mt-1">Arrêt automatique à {session.max_drawdown_pct}%</p>
        </div>
        <div className="rounded-xl border border-surface-800 p-4">
          <div className="flex items-center gap-2 text-surface-400"><Clock3 size={14} /> Fin du test</div>
          <p className="text-white font-semibold mt-2">{new Date(session.ends_at).toLocaleString('fr-FR')}</p>
          <p className="text-surface-500 mt-1">Checkpoint : {cp ? new Date(cp.checked_at).toLocaleString('fr-FR') : '—'}</p>
        </div>
      </div>

      {open.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-white mb-3">Positions PAPER ouvertes</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {open.map(p => (
              <div key={`${p.symbol}-${p.entry_at}`} className="rounded-xl border border-surface-800 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{p.symbol}</p>
                  <span className="badge-neutral">{p.side}</span>
                </div>
                <p className="text-xs text-surface-500 mt-2">
                  Entrée {Number(p.entry_price).toLocaleString('fr-FR')} · exposition {usd(Number(p.quote_amount_usd))}
                </p>
                <p className="text-[11px] text-surface-500 mt-1">
                  Stop {p.stop_loss_pct}% · TP {p.take_profit_pct}% · trailing {p.trailing_stop_pct}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-surface-500 mt-5">
        Ce challenge ne prouve pas un rendement futur. Il mesure si le moteur produit un P&L PAPER net et s’il fait mieux ou moins bien qu’un benchmark sur cette fenêtre de 48 h.
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-800 p-4">
      <p className="text-[11px] uppercase tracking-wider text-surface-500">{label}</p>
      <p className="text-xl font-bold text-white mt-2">{value}</p>
    </div>
  );
}
