import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import { publicApi, type PublicOpportunities, type PublicReadiness } from '../lib/publicApi';
import { getAdminToken } from '../lib/auth';
import { runRevenueScan } from '../lib/revenueScanApi';

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString('fr-FR') : 'Aucun';
}

function metricLabel(strategy: string, value: number | null) {
  if (value == null) return '—';
  if (['earn_staking', 'lending', 'farming_lp'].includes(strategy)) return value.toFixed(2) + '% APY brut';
  if (strategy === 'arbitrage') return value.toFixed(4) + '% spread brut';
  if (strategy === 'funding_capture') return value.toFixed(4) + '% historique brut';
  return value.toFixed(4) + '%';
}

export default function RevenueReadinessPanel() {
  const [readiness, setReadiness] = useState<PublicReadiness | null>(null);
  const [opportunities, setOpportunities] = useState<PublicOpportunities | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, o] = await Promise.all([publicApi.readiness(), publicApi.opportunities()]);
      setReadiness(r);
      setOpportunities(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'État revenus indisponible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const token = getAdminToken();
        const last = Number(window.localStorage.getItem('anbaybot_last_auto_scan_ms') || 0);
        if (token && Date.now() - last > 5 * 60 * 1000) {
          await runRevenueScan();
          window.localStorage.setItem('anbaybot_last_auto_scan_ms', String(Date.now()));
        }
      } catch {
        // Readiness reste lisible même si le scanner privé échoue.
      }
      if (active) await refresh();
    }

    void boot();
    const timer = window.setInterval(async () => {
      if (!getAdminToken()) return;
      try {
        await runRevenueScan();
        window.localStorage.setItem('anbaybot_last_auto_scan_ms', String(Date.now()));
      } catch {
        // L'échec d'un scan PAPER ne doit jamais déclencher une action financière.
      }
      if (active) await refresh();
    }, 15 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const configuredExchanges = useMemo(
    () => readiness?.exchanges.filter(x => x.connection_status !== 'NOT_CONFIGURED' && x.connection_status !== 'ERROR').length || 0,
    [readiness],
  );

  const paperReady = Boolean(readiness?.ai?.enabled && readiness?.latestScanAt);
  const liveBlocked = Boolean(!readiness?.privateReady || readiness?.killSwitch || !readiness?.liveEnabled);
  const visibleRows = (opportunities?.rows || []).filter(row =>
    ['arbitrage', 'funding_capture', 'spot_momentum', 'earn_staking', 'lending', 'farming_lp'].includes(row.strategy_key)
  );

  return (
    <section className="card p-5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="font-semibold text-white">État revenus & exécution</h2>
          <p className="text-xs text-surface-500 mt-1">Sépare ce qui peut être analysé maintenant de ce qui peut réellement déplacer des fonds.</p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {error && <p className="text-xs text-danger-300 mt-4">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <StatusCard
          icon={paperReady ? CheckCircle2 : Clock3}
          title="Analyse PAPER"
          value={paperReady ? 'PRÊTE' : 'EN ATTENTE'}
          detail={readiness?.latestScanAt ? 'Dernier scan ' + formatTime(readiness.latestScanAt) : 'Aucun scan enregistré'}
          ok={paperReady}
        />
        <StatusCard
          icon={liveBlocked ? AlertTriangle : ShieldCheck}
          title="Exécution LIVE"
          value={liveBlocked ? 'BLOQUÉE' : 'PRÊTE À CONFIRMER'}
          detail={
            readiness
              ? readiness.killSwitch
                ? 'Kill switch actif'
                : !readiness.privateReady
                  ? 'APIs privées Binance/MEXC manquantes'
                  : !readiness.liveEnabled
                    ? 'Trading LIVE non activé'
                    : 'Toujours soumis à confirmation'
              : 'État inconnu'
          }
          ok={!liveBlocked}
        />
        <StatusCard
          icon={ShieldCheck}
          title="Exchanges privés"
          value={configuredExchanges + '/' + (readiness?.exchanges.length || 2)}
          detail={(readiness?.exchanges || []).map(x => x.exchange + ' ' + x.connection_status).join(' · ') || 'Non configurés'}
          ok={Boolean(readiness?.privateReady)}
        />
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-medium text-white">Dernières opportunités observées</p>
            <p className="text-[11px] text-surface-500">Valeurs brutes de recherche/PAPER. Elles ne sont ni garanties ni directement comparables entre stratégies.</p>
          </div>
          <p className="text-[11px] text-surface-500">P&L LIVE: ${Number(readiness?.livePnlUsd || 0).toFixed(2)}</p>
        </div>

        {visibleRows.length === 0 ? (
          <div className="rounded-xl border border-surface-800 p-4 text-sm text-surface-500">
            Aucun scan récent disponible. Lance « Scanner maintenant » dans Pilotage des ordres.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleRows.map(row => (
              <div key={row.strategy_key} className="rounded-xl border border-surface-800 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{row.strategy_key.replace(/_/g, ' ')}</p>
                  <span className="badge-neutral">{row.status}</span>
                </div>
                <p className="text-lg font-semibold text-brand-400 mt-2">{metricLabel(row.strategy_key, row.expected_return_pct)}</p>
                <p className="text-[11px] text-surface-500 mt-1">{row.mode} · {formatTime(row.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatusCard({ icon: Icon, title, value, detail, ok }: {
  icon: typeof ShieldCheck;
  title: string;
  value: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-xl border border-surface-800 p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className={ok ? 'text-brand-400' : 'text-warn-400'} />
        <p className="text-xs text-surface-500 uppercase">{title}</p>
      </div>
      <p className={`text-xl font-bold mt-2 ${ok ? 'text-brand-400' : 'text-white'}`}>{value}</p>
      <p className="text-[11px] text-surface-500 mt-1">{detail}</p>
    </div>
  );
}
