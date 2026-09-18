import { useEffect, useState } from 'react';
import { ShieldCheck, Target, Gauge, AlertTriangle } from 'lucide-react';
import { publicApi, type PublicReadiness } from '../lib/publicApi';

export default function DynamicRiskPanel() {
  const [readiness, setReadiness] = useState<PublicReadiness | null>(null);

  useEffect(() => {
    let active = true;
    publicApi.readiness().then(data => { if (active) setReadiness(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const rp = (readiness?.riskParams || {}) as Record<string, unknown>;
  const mode = String(rp.riskMode || 'DYNAMIC');
  const stage = String(rp.liveRampStage || 'TEST');
  const maxTrade = Number(rp.maxTradeSizeEur || 0);
  const maxPct = Number(rp.maxTradeSizePctCapital || 0);
  const maxRisk = Number(rp.maxRiskPerTradePctCapital || 0);
  const maxDaily = Number(rp.maxDailyLossPctCapital || 0);
  const maxWeekly = Number(rp.maxWeeklyLossPctCapital || 0);
  const maxTrades = Number(rp.maxTradesPerDay || 0);
  const minConfidence = Number(rp.minConfidencePct || 0);
  const minLiquidity = Number(rp.minLiquidityUsd || 0);

  return (
    <section className="card p-5 mb-6">
      <div className="flex items-start gap-3">
        <ShieldCheck size={20} className="text-brand-400 mt-0.5" />
        <div>
          <h3 className="font-semibold text-white">Risk Engine dynamique</h3>
          <p className="text-xs text-surface-500 mt-1">Les limites sont appliquées côté serveur, pas seulement dans l’interface.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Metric icon={Gauge} label="Mode" value={mode} />
        <Metric icon={Target} label="Étape" value={stage} />
        <Metric icon={Gauge} label="Taille ordre" value={`≤ ${maxPct}% capital / ${maxTrade}€`} />
        <Metric icon={ShieldCheck} label="Risque/trade" value={`≤ ${maxRisk}% capital`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
        <Guard label="Perte max / jour" value={`${maxDaily}% du capital`} />
        <Guard label="Perte max / 7 jours" value={`${maxWeekly}% du capital`} />
        <Guard label="Ordres LIVE / jour" value={String(maxTrades)} />
        <Guard label="Arrêt après pertes" value={`${Number(rp.haltAfterConsecutiveLosses || 0)} consécutives`} />
        <Guard label="Confiance minimum" value={`${minConfidence}%`} />
        <Guard label="Liquidité minimum" value={`$${minLiquidity.toLocaleString('en-US')}`} />
      </div>

      {readiness?.killSwitch && (
        <div className="mt-4 rounded-xl border border-warn-500/30 bg-warn-500/5 p-3 flex gap-2">
          <AlertTriangle size={16} className="text-warn-400 shrink-0 mt-0.5" />
          <p className="text-xs text-surface-300">Kill switch LIVE actif : les tests restent disponibles mais aucun ordre réel ne doit partir.</p>
        </div>
      )}
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-800 p-3">
      <div className="flex items-center gap-2 text-surface-500"><Icon size={13}/><span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className="text-sm font-semibold text-white mt-1">{value}</p>
    </div>
  );
}

function Guard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-800 p-3 flex items-center justify-between gap-3">
      <span className="text-surface-500">{label}</span><span className="text-white font-medium">{value}</span>
    </div>
  );
}
