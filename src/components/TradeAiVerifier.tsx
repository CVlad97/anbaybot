import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrainCircuit, ExternalLink, RefreshCw, ShieldCheck, Target, AlertTriangle } from 'lucide-react';
import { publicApi, type PublicTradeIntelligence } from '../lib/publicApi';

type Bias = 'WAIT' | 'LONG' | 'SHORT';

function biasFromText(text: string): Bias {
  const t = text.toLowerCase();
  const longScore = ['long', 'bullish', 'buy', 'achat', 'haussier'].reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
  const shortScore = ['short', 'bearish', 'sell', 'vente', 'baissier'].reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
  if (longScore === shortScore) return 'WAIT';
  return longScore > shortScore ? 'LONG' : 'SHORT';
}

function numberAfter(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:=\\-]?\\s*([0-9]+(?:[.,][0-9]+)?)`, 'i');
    const m = text.match(re);
    if (m) return Number(m[1].replace(',', '.'));
  }
  return null;
}

export default function TradeAiVerifier() {
  const [intel, setIntel] = useState<PublicTradeIntelligence | null>(null);
  const [plan, setPlan] = useState('');
  const [internalBias, setInternalBias] = useState<Bias>('WAIT');
  const [internalConfidence, setInternalConfidence] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setIntel(await publicApi.intelligence());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couche Trade AI indisponible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const parsed = useMemo(() => {
    const getTradeBias = biasFromText(plan);
    const entry = numberAfter(plan, ['entry', 'entrée', 'entree']);
    const stop = numberAfter(plan, ['stop loss', 'stop-loss', 'stop', 'sl']);
    const target = numberAfter(plan, ['take profit', 'take-profit', 'target', 'objectif', 'tp']);

    let rr: number | null = null;
    if (entry && stop && target && entry !== stop) {
      if (getTradeBias === 'LONG' && target > entry && stop < entry) rr = (target - entry) / (entry - stop);
      if (getTradeBias === 'SHORT' && target < entry && stop > entry) rr = (entry - target) / (stop - entry);
    }

    const confidenceOk = internalConfidence >= (intel?.gate.minInternalConfidencePct || 70);
    const rrOk = rr != null && rr >= (intel?.gate.minRiskReward || 1.5);
    const aligned = internalBias !== 'WAIT' && getTradeBias === internalBias;
    return { getTradeBias, entry, stop, target, rr, confidenceOk, rrOk, aligned, pass: confidenceOk && rrOk && aligned };
  }, [plan, internalBias, internalConfidence, intel]);

  const getTrade = intel?.sources.find(s => s.source_key === 'GETTRADE_AI');

  return (
    <section className="card p-5 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex gap-3">
          <BrainCircuit size={20} className="text-brand-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold text-white">Trade AI · second avis avant exécution</h2>
            <p className="text-xs text-surface-500 mt-1">
              GetTrade.ai ne place pas les trades. ANBAYBOT l'utilise comme contrôle de convergence avec son signal interne et le Risk Gate.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-primary flex items-center gap-2" href={getTrade?.url || 'https://app.gettrade.ai/'} target="_blank" rel="noreferrer">
            Ouvrir GetTrade.ai <ExternalLink size={14} />
          </a>
          <button className="btn-secondary flex items-center gap-2" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      {error && <div className="mt-4 text-sm text-danger-300">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
        <div className="rounded-xl border border-surface-800 p-4">
          <p className="text-xs uppercase tracking-wider text-surface-500">1 · Signal ANBAYBOT</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <select className="input" value={internalBias} onChange={e => setInternalBias(e.target.value as Bias)}>
              <option value="WAIT">WAIT</option>
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              step={1}
              value={internalConfidence}
              onChange={e => setInternalConfidence(Number(e.target.value))}
              placeholder="Confiance %"
            />
          </div>
          <p className="text-[11px] text-surface-500 mt-2">Seuil : {intel?.gate.minInternalConfidencePct || 70}% minimum.</p>
        </div>

        <div className="rounded-xl border border-surface-800 p-4 lg:col-span-2">
          <p className="text-xs uppercase tracking-wider text-surface-500">2 · Coller le plan GetTrade.ai</p>
          <textarea
            className="input mt-3 min-h-28 w-full"
            value={plan}
            onChange={e => setPlan(e.target.value)}
            placeholder="Colle ici l'analyse GetTrade.ai contenant idéalement direction, Entry, Stop Loss et Take Profit."
          />
          <p className="text-[11px] text-surface-500 mt-2">Le parseur reste local au navigateur. Aucun texte n'est envoyé à un broker ni exécuté.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
        <Metric label="Biais GetTrade" value={parsed.getTradeBias} ok={parsed.aligned} />
        <Metric label="R/R détecté" value={parsed.rr == null ? '—' : parsed.rr.toFixed(2)} ok={parsed.rrOk} />
        <Metric label="Confiance interne" value={`${internalConfidence.toFixed(0)}%`} ok={parsed.confidenceOk} />
        <Metric label="Gate final" value={parsed.pass ? 'CONVERGENCE' : 'BLOQUÉ'} ok={parsed.pass} />
      </div>

      <div className={`mt-5 rounded-xl border p-4 flex gap-3 ${parsed.pass ? 'border-brand-500/40' : 'border-warn-500/30'}`}>
        {parsed.pass ? <ShieldCheck size={18} className="text-brand-400 shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="text-warn-400 shrink-0 mt-0.5" />}
        <div>
          <p className="text-sm font-medium text-white">
            {parsed.pass ? 'Le setup passe le filtre de second avis.' : 'Le setup ne passe pas encore le filtre.'}
          </p>
          <p className="text-xs text-surface-400 mt-1">
            Même en convergence, cela ne déclenche pas un ordre LIVE. Il faut encore que l'exchange soit connecté, le kill switch autorisé et la taille conforme aux limites de risque.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <a className="badge-neutral flex items-center gap-1" href="https://www.tradingview.com/chart/?symbol=BINANCE%3ABTCUSDT" target="_blank" rel="noreferrer">BTC chart <ExternalLink size={11} /></a>
        <a className="badge-neutral flex items-center gap-1" href="https://www.tradingview.com/chart/?symbol=BINANCE%3AETHUSDT" target="_blank" rel="noreferrer">ETH chart <ExternalLink size={11} /></a>
        <a className="badge-neutral flex items-center gap-1" href="https://www.tradingview.com/chart/?symbol=BINANCE%3ASOLUSDT" target="_blank" rel="noreferrer">SOL chart <ExternalLink size={11} /></a>
        <span className="badge-neutral flex items-center gap-1"><Target size={11} /> Objectif 1 000 €/mois · non garanti</span>
      </div>
    </section>
  );
}

function Metric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-surface-800 p-4">
      <p className="text-[10px] uppercase tracking-wider text-surface-500">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${ok ? 'text-brand-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}
