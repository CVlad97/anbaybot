import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, RefreshCw, Wallet, DollarSign, ShieldCheck, Activity } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { publicApi, type LivePnl, type PublicPortfolio } from '../lib/publicApi';

function formatUsd(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [pnl, setPnl] = useState<LivePnl | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [portfolioData, pnlData] = await Promise.all([publicApi.portfolio(), publicApi.pnl()]);
      setPortfolio(portfolioData);
      setPnl(pnlData);
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

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={LayoutDashboard}
        title="Tableau de bord réel"
        subtitle="Capital, wallets et P&L vérifiés — sans token admin"
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
            <p className="text-sm font-medium text-white">Mode lecture réelle</p>
            <p className="text-xs text-surface-400 mt-1">Le capital correspond aux actifs réellement lus. Le P&L LIVE reste séparé et n’est jamais déduit d’une simulation.</p>
          </div>
        </div>
      </div>

      {error && <div className="card p-4 mb-6 border-l-4 border-l-danger-500 text-sm text-danger-300">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Metric icon={DollarSign} label="Capital observé" value={formatUsd(portfolio?.totalValueUsd || 0)} sub="Somme des wallets serveur" />
        <Metric icon={Wallet} label="Wallets actifs" value={String(portfolio?.wallets.length || 0)} sub="Lecture multi-chaînes" />
        <Metric icon={Activity} label="P&L LIVE" value={formatUsd(pnl?.totalNetPnlUsd || 0)} sub={`${pnl?.count || 0} écriture(s) LIVE`} />
        <Metric icon={ShieldCheck} label="Source" value="LIVE" sub="Pas de données de démonstration" />
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-surface-800">
          <h2 className="font-semibold text-white">Portefeuille serveur vérifié</h2>
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

function Metric({ icon: Icon, label, value, sub }: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-brand-600/10 flex items-center justify-center">
          <Icon size={17} className="text-brand-400" />
        </div>
        <span className="text-xs text-surface-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-surface-500 mt-1">{sub}</p>
    </div>
  );
}
