import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Cpu, DollarSign, LayoutDashboard, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
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
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [portfolioData, pnlData, exchangeData, strategyData] = await Promise.all([
        publicApi.portfolio(),
        publicApi.pnl(),
        publicApi.exchanges(),
        publicApi.strategies(),
      ]);
      setPortfolio(portfolioData);
      setPnl(pnlData);
      setExchanges(exchangeData.exchanges);
      setStrategies(strategyData.strategies);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lecture serveur impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const exchangeTotal = useMemo(
    () => exchanges.filter(x => x.connection_status !== 'NOT_CONFIGURED').reduce((sum, x) => sum + Number(x.balance_usd || 0), 0),
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
        title="Tableau de bord réel"
        subtitle="Wallets, exchanges et P&L vérifiés — aucune donnée démo comptée comme gain"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Metric icon={DollarSign} label="Capital observé" value={formatUsd(totalObserved)} sub={`${formatUsd(portfolio?.totalValueUsd || 0)} on-chain + ${formatUsd(exchangeTotal)} exchanges connectés`} />
        <Metric icon={Wallet} label="Sources connectées" value={String((portfolio?.wallets.length || 0) + connectedExchanges)} sub={`${portfolio?.wallets.length || 0} wallets · ${connectedExchanges}/${exchanges.length} exchange(s)`} />
        <Metric icon={Activity} label="P&L LIVE" value={formatUsd(pnl?.totalNetPnlUsd || 0)} sub={`${pnl?.count || 0} écriture(s) LIVE`} />
        <Metric icon={Cpu} label="Stratégies scannées" value={`${scanEnabled}/${strategies.length}`} sub={`${liveReadyStrategies} stratégie(s) LIVE ready`} />
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Comptes d'exchange</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exchanges.map(exchange => (
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
                {exchange.connection_status === 'NOT_CONFIGURED' ? '—' : formatUsd(Number(exchange.balance_usd || 0))}
              </p>
              <p className="text-xs text-surface-500 mt-1">
                {exchange.connection_status === 'NOT_CONFIGURED' ? 'Solde non lu : API privée non connectée.' : 'Solde issu de la connexion serveur.'}
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
          {strategies.map(strategy => (
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
          <h2 className="font-semibold text-white">Wallets on-chain vérifiés</h2>
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
                  {wallet.tokens.length === 0 && <span className="text-xs text-surface-500">Aucun actif valorisé détecté</span>}
                </div>
              </div>
              <p className="text-xl font-semibold text-brand-400">{formatUsd(wallet.totalValueUsd)}</p>
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
