import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Cpu, DollarSign, LayoutDashboard, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import RevenueReadinessPanel from '../components/RevenueReadinessPanel';
import WeeklyGoalEngine from '../components/WeeklyGoalEngine';
import Challenge48hPanel from '../components/Challenge48hPanel';
import TradeAiVerifier from '../components/TradeAiVerifier';
import {
  publicApi,
  type LivePnl,
  type PublicExchangeAccount,
  type PublicPortfolio,
  type PublicStrategy,
} from '../lib/publicApi';

function formatUsd(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

const statusLabel: Record<string, string> = {
  NOT_CONFIGURED: 'API à connecter',
  READ_ONLY: 'Lecture seule',
  TEST_READY: 'TEST prêt',
  LIVE_READY: 'LIVE prêt',
  ERROR: 'Erreur',
};

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [pnl, setPnl] = useState<LivePnl | null>(null);
  const [exchanges, setExchanges] = useState<PublicExchangeAccount[]>([]);
  const [strategies, setStrategies] = useState<PublicStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangesLoaded, setExchangesLoaded] = useState(false);
  const [strategiesLoaded, setStrategiesLoaded] = useState(false);
  const refreshing = useRef(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    setError('');
    const failures: string[] = [];
    // A slow wallet cannot hide successful ledger or exchange reads.
    await Promise.allSettled([
      publicApi.portfolio().then(setPortfolio).catch(() => { setPortfolio(null); failures.push('Portefeuilles'); }),
      publicApi.pnl().then(setPnl).catch(() => { setPnl(null); failures.push('P&L'); }),
      publicApi.exchanges().then(data => { setExchanges(data.exchanges); setExchangesLoaded(true); })
        .catch(() => { setExchangesLoaded(false); failures.push('Exchanges'); }),
      publicApi.strategies().then(data => { setStrategies(data.strategies); setStrategiesLoaded(true); })
        .catch(() => { setStrategiesLoaded(false); failures.push('Stratégies'); }),
    ]);
    setError(failures.length ? 'Données indisponibles : ' + failures.join(', ') + '. Aucun zéro de remplacement.' : '');
    setLoading(false);
    refreshing.current = false;
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const exchangeTotal = useMemo(
    () => exchanges.filter(x => !['NOT_CONFIGURED', 'ERROR'].includes(x.connection_status)).reduce((sum, x) => sum + Number(x.balance_usd || 0), 0),
    [exchanges],
  );
  const connectedExchanges = exchanges.filter(x => x.connection_status !== 'NOT_CONFIGURED' && x.connection_status !== 'ERROR').length;
  const scanEnabled = strategies.filter(s => s.scan_enabled).length;
  const liveReadyStrategies = strategies.filter(s => s.status === 'LIVE_READY').length;
  const totalObserved = Number(portfolio?.totalValueUsd || 0) + exchangeTotal;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={LayoutDashboard}
        title="Tableau de bord"
        subtitle="Soldes observés, erreurs de lecture et P&L enregistré"
        action={
          <button className="btn-secondary flex items-center gap-2" onClick={refresh} disabled={loading}>
            {loading ? <LoadingSpinner size={14} /> : <RefreshCw size={14} />}
            Actualiser
          </button>
        }
      />

      <div className="card p-4 mb-6 border-l-4 border-l-brand-500/50">
        <div className="flex gap-3">
          <ShieldCheck size={18} className="text-brand-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-white">Données réelles séparées par source</p>
            <p className="text-xs text-surface-400 mt-1">
              Capital observé ≠ gain. Le P&L LIVE vient uniquement du registre LIVE. Les stratégies peuvent scanner automatiquement, mais aucune stratégie n'est autorisée à exécuter un ordre LIVE sans validation.
            </p>
          </div>
        </div>
      </div>

      {error && <div className="card p-4 mb-6 border-l-4 border-l-danger-500 text-sm text-danger-300">{error}</div>}

      {loading && <p role="status" className="text-xs text-surface-400 mb-4">Actualisation des sources en cours…</p>}
      {portfolio && portfolio.wallets.some(w => w.error) && <p role="status" className="card p-4 mb-4 text-warn-400">Valorisation partielle : certaines sources ou certains prix sont indisponibles. Le montant observé ne représente pas le capital total.</p>}
      <Challenge48hPanel />
      <WeeklyGoalEngine />
      <TradeAiVerifier />
      <RevenueReadinessPanel />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Metric icon={DollarSign} label="Capital observé" value={portfolio && exchangesLoaded ? (portfolio.wallets.some(w => w.error) ? 'Partiel · ' : '') + formatUsd(totalObserved) : '—'} sub={portfolio ? formatUsd(portfolio.totalValueUsd) + ' on-chain · exchanges ' + (exchangesLoaded ? formatUsd(exchangeTotal) : 'indisponibles') : 'Lecture en cours ou indisponible'} />
        <Metric icon={Wallet} label="Sources lues" value={portfolio && exchangesLoaded ? String(portfolio.wallets.filter(w => !w.error).length + connectedExchanges) : '—'} sub={portfolio ? portfolio.wallets.filter(w => !w.error).length + '/' + portfolio.wallets.length + ' wallets · ' + (exchangesLoaded ? connectedExchanges + '/' + exchanges.length : '—') + ' exchanges' : 'Connexion non vérifiée'} />
        <Metric icon={Activity} label="P&L LIVE" value={pnl ? formatUsd(pnl.totalNetPnlUsd) : '—'} sub={pnl ? pnl.count + ' écriture(s) LIVE' : 'Registre non lu'} />
        <Metric icon={Cpu} label="Scans configurés" value={strategiesLoaded ? scanEnabled + '/' + strategies.length : '—'} sub={strategiesLoaded ? liveReadyStrategies + ' stratégie(s) prête(s) LIVE · fraîcheur ci-dessus' : 'Catalogue non lu'} />
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Comptes d'exchange</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(exchangesLoaded ? exchanges : []).map(exchange => (
            <div key={exchange.exchange} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{exchange.label}</p>
                  <p className="text-xs text-surface-500 mt-1">{statusLabel[exchange.connection_status] || exchange.connection_status}</p>
                </div>
                <span className={exchange.connection_status === 'LIVE_READY' ? 'badge-success' : exchange.connection_status === 'ERROR' ? 'badge-danger' : 'badge-neutral'}>
                  {exchange.connection_status}
                </span>
              </div>
              <p className="text-2xl font-bold text-white mt-4">
                {['NOT_CONFIGURED', 'ERROR'].includes(exchange.connection_status) ? '—' : formatUsd(Number(exchange.balance_usd || 0))}
              </p>
              <p className="text-xs text-surface-500 mt-1">
                {['NOT_CONFIGURED', 'ERROR'].includes(exchange.connection_status) ? 'Solde indisponible : connexion privée non validée.' : 'Dernier solde enregistré : ' + (exchange.last_checked_at ? new Date(exchange.last_checked_at).toLocaleString('fr-FR') : 'date inconnue')}
              </p>
              <p className="text-xs text-surface-400 mt-3">Trading LIVE : {exchange.live_trading_enabled ? 'activé' : 'désactivé'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Moteurs de revenus</h2>
            <p className="text-xs text-surface-500 mt-1">Scan automatique autorisé ≠ exécution financière automatique.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(strategiesLoaded ? strategies : []).map(strategy => (
            <div key={strategy.strategy_key} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{strategy.name}</p>
                  <p className="text-xs text-surface-500 mt-1">{strategy.category}{strategy.venue ? ` · ${strategy.venue}` : ''}</p>
                </div>
                <span className="badge-neutral">{strategy.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="badge-neutral">{strategy.execution_mode}</span>
                <span className={strategy.scan_enabled ? 'badge-success' : 'badge-neutral'}>{strategy.scan_enabled ? 'SCAN ON' : 'SCAN OFF'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-surface-800">
          <h2 className="font-semibold text-white">Wallets on-chain observés</h2>
          <p className="text-xs text-surface-500 mt-1">Dernière lecture : {portfolio?.updatedAt ? new Date(portfolio.updatedAt).toLocaleString('fr-FR') : '—'}</p>
        </div>
        <div className="divide-y divide-surface-800">
          {(portfolio?.wallets || []).map(wallet => (
            <div key={wallet.walletId} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-medium text-white">{wallet.label}</p>
                <p className="text-xs text-surface-500">{wallet.chain} · {wallet.platform} · {wallet.addressMasked}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {wallet.tokens.map(token => (
                    <span className="badge-neutral" key={`${wallet.walletId}-${token.symbol}`}>
                      {token.balance.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} {token.symbol}
                    </span>
                  ))}
                  {!wallet.error && wallet.tokens.length === 0 && <span className="text-xs text-surface-500">Aucun actif valorisé détecté</span>}
                </div>
              </div>
              <p className="text-xl font-semibold text-brand-400">{wallet.error ? 'Partiel / indisponible' : formatUsd(wallet.totalValueUsd)}</p>
              {wallet.error && <p className="text-xs text-warn-400">Lecture incomplète : {wallet.error}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: typeof DollarSign; label: string; value: string; sub: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-brand-600/10 flex items-center justify-center"><Icon size={17} className="text-brand-400" /></div>
        <span className="text-xs text-surface-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-surface-500 mt-1">{sub}</p>
    </div>
  );
}
