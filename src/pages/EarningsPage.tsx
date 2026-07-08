import { useState, useMemo } from 'react';
import {
  DollarSign, BarChart3, Receipt,
  ArrowUpRight, ArrowDownRight, RefreshCw, Calendar,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import type { EarningsRecord, EarningsSummary } from '../lib/types';

const DEMO_EARNINGS: EarningsRecord[] = [
  { id: '1', date: '2026-07-07T10:30:00Z', type: 'trade', symbol: 'BTC/USDT', amountUsd: 500, feeUsd: 1.25, netPnlUsd: 45.20, pnlPct: 9.04, status: 'WIN' },
  { id: '2', date: '2026-07-07T09:15:00Z', type: 'signal', symbol: 'ETH/USDT', amountUsd: 300, feeUsd: 0.75, netPnlUsd: -12.50, pnlPct: -4.17, status: 'LOSS' },
  { id: '3', date: '2026-07-06T22:00:00Z', type: 'trade', symbol: 'SOL/USDT', amountUsd: 200, feeUsd: 0.50, netPnlUsd: 28.30, pnlPct: 14.15, status: 'WIN' },
  { id: '4', date: '2026-07-06T18:45:00Z', type: 'trade', symbol: 'ADA/USDT', amountUsd: 150, feeUsd: 0.38, netPnlUsd: 8.75, pnlPct: 5.83, status: 'WIN' },
  { id: '5', date: '2026-07-06T14:30:00Z', type: 'signal', symbol: 'DOT/USDT', amountUsd: 250, feeUsd: 0.63, netPnlUsd: -18.40, pnlPct: -7.36, status: 'LOSS' },
  { id: '6', date: '2026-07-05T20:00:00Z', type: 'trade', symbol: 'LINK/USDT', amountUsd: 180, feeUsd: 0.45, netPnlUsd: 12.60, pnlPct: 7.00, status: 'WIN' },
  { id: '7', date: '2026-07-05T12:00:00Z', type: 'referral', amountUsd: 0, feeUsd: 0, netPnlUsd: 25.00, pnlPct: 0, status: 'WIN', note: 'Commission parrainage' },
  { id: '8', date: '2026-07-04T16:00:00Z', type: 'subscription', amountUsd: 0, feeUsd: 0, netPnlUsd: 49.00, pnlPct: 0, status: 'WIN', note: 'Abonnement Pro mensuel' },
  { id: '9', date: '2026-07-04T08:00:00Z', type: 'trade', symbol: 'AVAX/USDT', amountUsd: 400, feeUsd: 1.00, netPnlUsd: -32.00, pnlPct: -8.00, status: 'LOSS' },
  { id: '10', date: '2026-07-03T22:30:00Z', type: 'trade', symbol: 'MATIC/USDT', amountUsd: 120, feeUsd: 0.30, netPnlUsd: 6.00, pnlPct: 5.00, status: 'WIN' },
];

function computeSummary(records: EarningsRecord[]): EarningsSummary {
  const trades = records.filter(r => r.type === 'trade');
  const wins = trades.filter(t => t.status === 'WIN');
  const losses = trades.filter(t => t.status === 'LOSS');
  const totalPnl = records.reduce((s, r) => s + r.netPnlUsd, 0);
  const winSum = wins.reduce((s, t) => s + t.netPnlUsd, 0);
  const lossSum = Math.abs(losses.reduce((s, t) => s + t.netPnlUsd, 0));
  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    totalPnlUsd: totalPnl,
    bestTradeUsd: wins.length > 0 ? Math.max(...wins.map(t => t.netPnlUsd)) : 0,
    worstTradeUsd: losses.length > 0 ? Math.min(...losses.map(t => t.netPnlUsd)) : 0,
    avgWinUsd: wins.length > 0 ? winSum / wins.length : 0,
    avgLossUsd: losses.length > 0 ? lossSum / losses.length : 0,
    profitFactor: lossSum > 0 ? winSum / lossSum : winSum > 0 ? Infinity : 0,
    totalFeesUsd: records.reduce((s, r) => s + r.feeUsd, 0),
  };
}

function formatUsd(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const TYPE_LABELS: Record<string, string> = {
  trade: 'Trade',
  signal: 'Signal',
  subscription: 'Abonnement',
  referral: 'Parrainage',
};

export default function EarningsPage() {
  const [records] = useState<EarningsRecord[]>(DEMO_EARNINGS);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const summary = useMemo(() => computeSummary(records), [records]);

  const filtered = typeFilter === 'all'
    ? records
    : records.filter(r => r.type === typeFilter);

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={DollarSign}
        title="Revenus & P&L"
        subtitle="Suivi des performances paper trading, gains, pertes et commissions"
        action={
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="input py-1.5 text-sm"
            >
              <option value="all">Tous</option>
              <option value="trade">Trades</option>
              <option value="signal">Signaux</option>
              <option value="subscription">Abonnements</option>
              <option value="referral">Parrainage</option>
            </select>
            <button className="btn-secondary flex items-center gap-2" onClick={() => window.location.reload()}>
              <RefreshCw size={14} />
              <span>Actualiser</span>
            </button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/10 flex items-center justify-center">
              <DollarSign size={18} className="text-brand-400" />
            </div>
            <span className="text-xs text-surface-500 font-medium uppercase tracking-wider">P&L Total</span>
          </div>
          <p className={`text-2xl font-bold ${summary.totalPnlUsd >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
            {summary.totalPnlUsd >= 0 ? '+' : ''}{formatUsd(summary.totalPnlUsd)}
          </p>
          <p className="text-xs text-surface-500 mt-1">Depuis le début</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <BarChart3 size={18} className="text-blue-400" />
            </div>
            <span className="text-xs text-surface-500 font-medium uppercase tracking-wider">Win Rate</span>
          </div>
          <p className="text-2xl font-bold text-white">{summary.winRate.toFixed(1)}%</p>
          <p className="text-xs text-surface-500 mt-1">{summary.wins} victoires / {summary.losses} pertes</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <ArrowUpRight size={18} className="text-green-400" />
            </div>
            <span className="text-xs text-surface-500 font-medium uppercase tracking-wider">Avg Win</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{formatUsd(summary.avgWinUsd)}</p>
          <p className="text-xs text-surface-500 mt-1">Meilleur: {formatUsd(summary.bestTradeUsd)}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <ArrowDownRight size={18} className="text-red-400" />
            </div>
            <span className="text-xs text-surface-500 font-medium uppercase tracking-wider">Avg Loss</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{formatUsd(summary.avgLossUsd)}</p>
          <p className="text-xs text-surface-500 mt-1">Pire: {formatUsd(summary.worstTradeUsd)}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">Profit Factor</p>
          <p className="text-xl font-bold text-white">
            {summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">Frais totaux</p>
          <p className="text-xl font-bold text-white">{formatUsd(summary.totalFeesUsd)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">Trades exécutés</p>
          <p className="text-xl font-bold text-white">{summary.totalTrades}</p>
        </div>
      </div>

      {/* Earnings table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-surface-800 flex items-center gap-2">
          <Receipt size={16} className="text-brand-400" />
          <h3 className="font-semibold text-white">Historique des revenus</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800 text-surface-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Symbole</th>
                <th className="text-right px-4 py-3 font-medium">Montant</th>
                <th className="text-right px-4 py-3 font-medium">Frais</th>
                <th className="text-right px-4 py-3 font-medium">P&L Net</th>
                <th className="text-right px-4 py-3 font-medium">Rendement</th>
                <th className="text-center px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-surface-800/50 hover:bg-surface-900/40 transition-colors">
                  <td className="px-4 py-3 text-surface-300 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-4 py-3">
                    <span className="badge-neutral text-[10px]">{TYPE_LABELS[r.type]}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-surface-200">{r.symbol || '-'}</td>
                  <td className="px-4 py-3 text-right text-surface-200">{formatUsd(r.amountUsd)}</td>
                  <td className="px-4 py-3 text-right text-surface-400">{formatUsd(r.feeUsd)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${r.status === 'WIN' ? 'text-brand-400' : 'text-danger-400'}`}>
                    {r.netPnlUsd >= 0 ? '+' : ''}{formatUsd(r.netPnlUsd)}
                  </td>
                  <td className={`px-4 py-3 text-right ${r.pnlPct >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                    {r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={r.status === 'WIN' ? 'SUCCESS' : r.status === 'LOSS' ? 'FAILED' : 'PREPARED'} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stripe payment links */}
      <div className="card p-5 mt-6 border-l-4 border-l-brand-500/50">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={16} className="text-brand-400" />
          <h3 className="font-semibold text-white">Liens de paiement Stripe</h3>
        </div>
        <p className="text-sm text-surface-400 mb-4">
          Les abonnements Pro et Enterprise sont disponibles via Stripe. Cliquez sur un plan pour y souscrire.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="#"
            onClick={e => { e.preventDefault(); alert('🔗 Stripe Payment Link Pro: https://buy.stripe.com/test_pro_123 (simulé)'); }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <DollarSign size={14} />
            Payer Pro - 49€/mois
          </a>
          <a
            href="#"
            onClick={e => { e.preventDefault(); alert('🔗 Stripe Payment Link Enterprise: https://buy.stripe.com/test_enterprise_456 (simulé)'); }}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <DollarSign size={14} />
            Payer Enterprise - 149€/mois
          </a>
        </div>
      </div>
    </div>
  );
}
