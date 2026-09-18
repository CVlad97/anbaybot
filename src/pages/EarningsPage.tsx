import { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, RefreshCw, Receipt, Wallet, ShieldCheck, FlaskConical } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import GoalSimulator from '../components/GoalSimulator';
import RevenueLab from '../components/RevenueLab';
import PaperScanPanel from '../components/PaperScanPanel';
import WeeklyGoalEngine from '../components/WeeklyGoalEngine';
import BusinessRevenuePanel from '../components/BusinessRevenuePanel';
import { publicApi, type LivePnl, type PublicPortfolio } from '../lib/publicApi';

function formatUsd(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function EarningsPage() {
  const [pnl, setPnl] = useState<LivePnl | null>(null);
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [livePnl, livePortfolio] = await Promise.all([publicApi.pnl(), publicApi.portfolio()]);
      setPnl(livePnl);
      setPortfolio(livePortfolio);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lecture P&L impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalFees = useMemo(
    () => (pnl?.rows || []).reduce((sum, row) => sum + Number(row.fees_usd || 0), 0),
    [pnl],
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={DollarSign}
        title="Revenus & P&L"
        subtitle="Uniquement les gains et pertes réellement enregistrés en environnement LIVE"
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
            <p className="text-sm font-medium text-white">Plus aucun gain de démonstration n’est mélangé aux résultats.</p>
            <p className="text-xs text-surface-400 mt-1">Le capital visible dans tes wallets n’est pas un gain. Le P&L LIVE ci-dessous provient uniquement du registre <code>pnl_ledger</code>.</p>
          </div>
        </div>
      </div>

      {error && <div className="card p-4 mb-6 border-l-4 border-l-danger-500 text-sm text-danger-300">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Metric icon={Wallet} label="Capital observé" value={formatUsd(portfolio?.totalValueUsd || 0)} sub="Solde actuel des wallets lus" />
        <Metric icon={DollarSign} label="P&L LIVE réalisé" value={formatUsd(pnl?.totalNetPnlUsd || 0)} sub="Gain/perte vérifié enregistré" highlight={(pnl?.totalNetPnlUsd || 0) !== 0} />
        <Metric icon={Receipt} label="Écritures LIVE" value={String(pnl?.count || 0)} sub="Lignes du registre P&L" />
        <Metric icon={ShieldCheck} label="Frais LIVE enregistrés" value={formatUsd(totalFees)} sub="Uniquement frais réellement journalisés" />
      </div>

      <div className="card overflow-hidden mb-8">
        <div className="p-4 border-b border-surface-800 flex items-center gap-2">
          <Receipt size={16} className="text-brand-400" />
          <h3 className="font-semibold text-white">Historique LIVE vérifié</h3>
        </div>
        {(pnl?.rows || []).length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-lg font-semibold text-white">Aucun gain LIVE enregistré pour le moment</p>
            <p className="text-sm text-surface-500 mt-2">Cela signifie 0 USD de P&L LIVE vérifié, pas que ton portefeuille vaut 0.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 text-surface-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Marché</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3">Brut</th>
                  <th className="text-right px-4 py-3">Frais</th>
                  <th className="text-right px-4 py-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {(pnl?.rows || []).map(row => (
                  <tr key={row.id} className="border-b border-surface-800/50">
                    <td className="px-4 py-3 text-surface-300 whitespace-nowrap">{formatDate(row.occurred_at)}</td>
                    <td className="px-4 py-3 text-surface-200">{row.venue || '-'} · {row.market || '-'}</td>
                    <td className="px-4 py-3 text-surface-400">{row.pnl_type}</td>
                    <td className="px-4 py-3 text-right">{formatUsd(Number(row.gross_pnl_usd || 0))}</td>
                    <td className="px-4 py-3 text-right">{formatUsd(Number(row.fees_usd || 0))}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${Number(row.net_pnl_usd || 0) >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                      {formatUsd(Number(row.net_pnl_usd || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <WeeklyGoalEngine />
      <BusinessRevenuePanel />
      <PaperScanPanel />

      <div className="card p-5 border-l-4 border-l-warn-500/50">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical size={17} className="text-warn-400" />
          <h3 className="font-semibold text-white">Simulations séparées des gains réels</h3>
        </div>
        <p className="text-sm text-surface-400 mb-5">Les outils ci-dessous servent à tester des objectifs et des stratégies. Leurs résultats ne sont jamais ajoutés au P&L LIVE.</p>
        <GoalSimulator />
        <RevenueLab />
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub, highlight = false }: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-brand-600/10 flex items-center justify-center">
          <Icon size={17} className="text-brand-400" />
        </div>
        <span className="text-xs text-surface-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-400' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-surface-500 mt-1">{sub}</p>
    </div>
  );
}
