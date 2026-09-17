import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock, RefreshCw, Server, ShieldCheck, Wallet, XCircle } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { publicApi, type LivePnl, type PublicExchangeAccount, type PublicPortfolio, type PublicStrategy } from '../lib/publicApi';
import { getAppBaseUrl } from '../lib/siteUrl';

const BASE_URL = getAppBaseUrl();
const PAGES = [
  { path: '/', label: 'Dashboard' },
  { path: '/#/wallets', label: 'Portefeuilles' },
  { path: '/#/earnings', label: 'Revenus' },
  { path: '/#/strategies', label: 'Stratégies' },
  { path: '/#/monitoring', label: 'Monitoring' },
];

type PageCheck = { label: string; status: 'ok' | 'error'; responseTimeMs: number };

export default function MonitoringPage() {
  const [backendOk, setBackendOk] = useState(false);
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [pnl, setPnl] = useState<LivePnl | null>(null);
  const [exchanges, setExchanges] = useState<PublicExchangeAccount[]>([]);
  const [strategies, setStrategies] = useState<PublicStrategy[]>([]);
  const [checks, setChecks] = useState<PageCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [health, p, livePnl, ex, st] = await Promise.all([
        publicApi.health(), publicApi.portfolio(), publicApi.pnl(), publicApi.exchanges(), publicApi.strategies(),
      ]);
      setBackendOk(health.status === 'ok');
      setPortfolio(p);
      setPnl(livePnl);
      setExchanges(ex.exchanges);
      setStrategies(st.strategies);

      const pageResults = await Promise.all(PAGES.map(async page => {
        const started = performance.now();
        try {
          const res = await fetch(`${BASE_URL}${page.path}`, { method: 'HEAD', cache: 'no-store' });
          return { label: page.label, status: res.ok ? 'ok' as const : 'error' as const, responseTimeMs: Math.round(performance.now() - started) };
        } catch {
          return { label: page.label, status: 'error' as const, responseTimeMs: Math.round(performance.now() - started) };
        }
      }));
      setChecks(pageResults);
    } catch (e) {
      setBackendOk(false);
      setError(e instanceof Error ? e.message : 'Monitoring indisponible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const latestScan = useMemo(() => {
    const dates = strategies.map(s => s.last_verified_at).filter(Boolean).map(v => new Date(v as string).getTime()).filter(Number.isFinite);
    return dates.length ? new Date(Math.max(...dates)) : null;
  }, [strategies]);
  const scanOn = strategies.filter(s => s.scan_enabled).length;
  const paperReady = strategies.filter(s => s.status === 'PAPER_READY' || s.status === 'DATA_READY').length;
  const connectedExchanges = exchanges.filter(x => x.connection_status !== 'NOT_CONFIGURED' && x.connection_status !== 'ERROR').length;
  const pagesOk = checks.filter(c => c.status === 'ok').length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Activity}
        title="Monitoring réel 24/7"
        subtitle="État courant uniquement — aucune statistique fictive"
        action={<button onClick={refresh} disabled={loading} className="btn-secondary flex items-center gap-2">{loading ? <LoadingSpinner size={14}/> : <RefreshCw size={14}/>}Actualiser</button>}
      />

      <div className={`card p-4 mb-6 border-l-4 ${backendOk ? 'border-l-brand-500' : 'border-l-danger-500'}`}>
        <div className="flex items-center gap-3">
          {backendOk ? <CheckCircle2 size={18} className="text-brand-400"/> : <XCircle size={18} className="text-danger-400"/>}
          <div><p className="font-medium text-white">Backend {backendOk ? 'opérationnel' : 'indisponible'}</p><p className="text-xs text-surface-500 mt-1">Données issues directement de l'API publique ANBAYBOT en lecture seule.</p></div>
        </div>
      </div>

      {error && <div className="card p-4 mb-6 text-sm text-danger-300">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Metric icon={Wallet} label="Wallets lus" value={String(portfolio?.wallets.length || 0)} sub={`${(portfolio?.totalValueUsd || 0).toLocaleString('fr-FR',{style:'currency',currency:'USD'})} observés`} />
        <Metric icon={Server} label="Exchanges connectés" value={`${connectedExchanges}/${exchanges.length}`} sub="Binance / MEXC" />
        <Metric icon={Activity} label="P&L LIVE" value={(pnl?.totalNetPnlUsd || 0).toLocaleString('fr-FR',{style:'currency',currency:'USD'})} sub={`${pnl?.count || 0} écriture(s) LIVE`} />
        <Metric icon={ShieldCheck} label="Scanners actifs" value={`${scanOn}/${strategies.length}`} sub={`${paperReady} DATA/PAPER ready`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4"><Clock size={16} className="text-brand-400"/><h3 className="font-semibold text-white">Scanner serveur</h3></div>
          <p className="text-2xl font-bold text-white">{latestScan ? latestScan.toLocaleString('fr-FR') : 'Pas encore vérifié'}</p>
          <p className="text-xs text-surface-500 mt-2">Cron Supabase horaire. Le scan mesure les opportunités mais n'exécute aucun ordre LIVE.</p>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-white mb-4">Comptes d'exchange</h3>
          <div className="space-y-3">{exchanges.map(x => <div key={x.exchange} className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-white">{x.label}</p><p className="text-xs text-surface-500">{x.connection_status}</p></div><span className="badge-neutral">LIVE {x.live_trading_enabled ? 'ON' : 'OFF'}</span></div>)}</div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-white">Pages actuelles</h3><span className="badge-neutral">{pagesOk}/{checks.length} OK</span></div>
        <div className="space-y-2">{checks.map(check => <div key={check.label} className="flex items-center justify-between rounded-xl border border-surface-800 px-4 py-3"><div className="flex items-center gap-3">{check.status === 'ok' ? <CheckCircle2 size={14} className="text-brand-400"/> : <XCircle size={14} className="text-danger-400"/>}<span className="text-sm text-white">{check.label}</span></div><span className="text-xs text-surface-500">{check.responseTimeMs} ms</span></div>)}</div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: typeof Activity; label:string; value:string; sub:string }) {
  return <div className="card p-5"><div className="flex items-center gap-3 mb-3"><div className="w-9 h-9 rounded-xl bg-brand-600/10 flex items-center justify-center"><Icon size={17} className="text-brand-400"/></div><span className="text-xs text-surface-500 font-medium uppercase tracking-wider">{label}</span></div><p className="text-2xl font-bold text-white">{value}</p><p className="text-xs text-surface-500 mt-1">{sub}</p></div>;
}
