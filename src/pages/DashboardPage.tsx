import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, RefreshCw, TrendingUp, TrendingDown,
  Wallet, DollarSign, Activity, ArrowUpRight, ArrowDownRight,
  Cpu, AlertTriangle, Zap, BadgeDollarSign, CheckCircle2,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusBadge from '../components/ui/StatusBadge';
import { useAppStore } from '../store/appStore';
import { api } from '../lib/api';
import type { WalletBalanceData, PortfolioSnapshot, BinanceTicker, TradingCockpitSnapshot } from '../lib/types';

function formatUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function formatToken(n: number) {
  if (n === 0) return '0';
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6);
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export default function DashboardPage() {
  const {
    walletBalances, setWalletBalances, totalValueUsd, pnlUsd, pnlPct,
    setPortfolioData, portfolioHistory, setPortfolioHistory,
    managedWallets, enabledStrategies, settings,
    tradingAccount, tradingTickers, tradingRecommendation, tradingValidation,
    tradingPnl, executionResult, setTradingSnapshot, setExecutionResult,
  } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [orderMode, setOrderMode] = useState<'TEST' | 'LIVE'>('TEST');
  const [orderSymbol, setOrderSymbol] = useState('BTC');
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderAmountUsd, setOrderAmountUsd] = useState('25');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [cockpitLoading, setCockpitLoading] = useState(false);

  const refreshBalances = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBalances();
      setWalletBalances(data.balances);
      setPortfolioData({
        totalValueUsd: data.totalValueUsd,
        pnlUsd: data.pnlUsd,
        pnlPct: data.pnlPct,
        prices: data.prices,
      });
      setLastRefresh(new Date().toLocaleTimeString());
    } catch {
      // silent fail
    }
    setLoading(false);
  }, [setWalletBalances, setPortfolioData]);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.getPortfolioHistory(12);
      setPortfolioHistory(data);
    } catch {
      // silent fail
    }
  }, [setPortfolioHistory]);

  const refreshCockpit = useCallback(async () => {
    setCockpitLoading(true);
    try {
      const snapshot: TradingCockpitSnapshot = await api.getTradingCockpit();
      setTradingSnapshot(snapshot);
      if (snapshot.recommendation.symbol) setOrderSymbol(snapshot.recommendation.symbol);
      if (snapshot.recommendation.side === 'SELL') setOrderSide('SELL');
    } catch {
      // silent fail
    }
    setCockpitLoading(false);
  }, [setTradingSnapshot]);

  useEffect(() => {
    refreshBalances();
    loadHistory();
    refreshCockpit();
    const interval = setInterval(() => {
      refreshBalances();
      refreshCockpit();
    }, 60_000);
    return () => clearInterval(interval);
  }, [refreshBalances, loadHistory, refreshCockpit]);

  const connectedCount = managedWallets.filter(w => w.enabled).length;
  const pnlPositive = pnlUsd >= 0;
  const validationReady = !!tradingValidation?.canSubmit;
  const tradableCapital = tradingAccount?.tradableCapitalUsd || 0;

  const handleSubmitOrder = async () => {
    const amount = Number(orderAmountUsd);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setExecutionResult(null);
    try {
      const validation = await api.validateTradingOrder({
        symbol: orderSymbol,
        side: orderSide,
        amountUsd: amount,
      });
      if (!validation.data.canSubmit) {
        setExecutionResult({
          mode: orderMode,
          symbol: orderSymbol,
          side: orderSide,
          amountUsd: amount,
          status: 'REJECTED',
          message: validation.data.issues.map(i => i.message).join(' • '),
        });
        return;
      }
      const result = await api.submitTradingOrder({
        symbol: orderSymbol,
        side: orderSide,
        amountUsd: amount,
        mode: orderMode,
        confirmationPhrase: orderMode === 'LIVE' ? confirmationPhrase : undefined,
      });
      setExecutionResult(result.data);
    } catch (error) {
      setExecutionResult({
        mode: orderMode,
        symbol: orderSymbol,
        side: orderSide,
        amountUsd: amount,
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Order failed',
      });
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={LayoutDashboard}
        title="Trading Cockpit"
        subtitle="Binance prices, server-side balances, risk gates, and execution controls"
        action={
          <button
            onClick={() => {
              refreshBalances();
              refreshCockpit();
            }}
            disabled={loading || cockpitLoading}
            className="btn-secondary flex items-center gap-2"
          >
            {loading || cockpitLoading ? <LoadingSpinner size={14} /> : <RefreshCw size={14} />}
            <span>Refresh</span>
          </button>
        }
      />

      {settings?.kill_switch && (
        <div className="card p-4 mb-6 border-l-4 border-l-danger-500 bg-danger-600/5 flex items-center gap-3">
          <AlertTriangle size={18} className="text-danger-400 shrink-0" />
          <p className="text-sm text-danger-400">Kill switch is ACTIVE. Trading is blocked until validation clears.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon={DollarSign} label="Total Portfolio" value={formatUsd(totalValueUsd)} sub={lastRefresh ? `Updated ${lastRefresh}` : 'Loading...'} color="text-brand-400" bgColor="bg-brand-600/10" />
        <SummaryCard icon={pnlPositive ? TrendingUp : TrendingDown} label="P&L" value={`${pnlPositive ? '+' : ''}${formatUsd(pnlUsd)}`} sub={`${pnlPositive ? '+' : ''}${pnlPct.toFixed(2)}%`} color={pnlPositive ? 'text-brand-400' : 'text-danger-400'} bgColor={pnlPositive ? 'bg-brand-600/10' : 'bg-danger-600/10'} />
        <SummaryCard icon={Wallet} label="Connected Wallets" value={String(connectedCount)} sub={`${managedWallets.length} total`} color="text-blue-400" bgColor="bg-blue-500/10" />
        <SummaryCard icon={Cpu} label="Active Strategies" value={String(enabledStrategies.length)} sub={settings?.kill_switch ? 'Blocked by kill switch' : 'Trading ready'} color="text-warn-400" bgColor="bg-warn-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Activity size={18} className="text-brand-400" />Portfolio History</h2>
              <StatusBadge status={validationReady ? 'CONFIRMED' : 'PREPARED'} size="md" />
            </div>
            <PortfolioChart history={portfolioHistory} />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Binance Prices</h3>
                <Zap size={16} className="text-brand-400" />
              </div>
              <div className="space-y-3">
                {tradingTickers.length === 0 ? (
                  <p className="text-sm text-surface-500">Loading Binance quotes...</p>
                ) : tradingTickers.map(ticker => (
                  <TickerRow key={ticker.symbol} ticker={ticker} />
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Tradable Capital</h3>
                <BadgeDollarSign size={16} className="text-brand-400" />
              </div>
              <p className="text-3xl font-bold text-white">{formatUsd(tradableCapital)}</p>
              <p className="text-xs text-surface-500 mt-2">Free stable value + risk-adjusted capital</p>
              <div className="mt-4 space-y-2 text-sm">
                <Row label="Account value" value={formatUsd(tradingAccount?.totalAccountValueUsd || 0)} />
                <Row label="Free stable" value={formatUsd(tradingAccount?.freeStableUsd || 0)} />
                <Row label="Live ready" value={tradingAccount?.canTradeLive ? 'Yes' : 'No'} />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Recommendation</h3>
              <StatusBadge status={tradingRecommendation?.action === 'BUY' ? 'CONFIRMED' : tradingRecommendation?.action === 'SELL' ? 'FAILED' : 'PREPARED'} />
            </div>
            {tradingRecommendation ? (
              <div className="space-y-3">
                <p className="text-2xl font-bold text-white">{tradingRecommendation.action} {tradingRecommendation.symbol}</p>
                <p className="text-sm text-surface-400">{tradingRecommendation.reasoning.join(' • ')}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Row label="Confidence" value={`${tradingRecommendation.confidence}%`} />
                  <Row label="Size" value={formatUsd(tradingRecommendation.amountUsd)} />
                  <Row label="Momentum" value={`${tradingRecommendation.momentum.toFixed(2)}%`} />
                  <Row label="Side" value={tradingRecommendation.side} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-surface-500">No recommendation loaded yet.</p>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Validation</h3>
              <StatusBadge status={tradingValidation?.canSubmit ? 'CONFIRMED' : 'REFUSED'} />
            </div>
            {tradingValidation ? (
              <div className="space-y-2 text-sm">
                <Row label="Pass" value={tradingValidation.passed ? 'Yes' : 'No'} />
                <Row label="Kill switch" value={tradingValidation.killSwitchActive ? 'On' : 'Off'} />
                <Row label="Live enabled" value={tradingValidation.liveTradingEnabled ? 'Yes' : 'No'} />
                <Row label="Max order" value={formatUsd(tradingValidation.maxOrderUsd)} />
                {tradingValidation.issues.map(issue => (
                  <div key={issue.field} className={`text-xs rounded-lg px-3 py-2 ${issue.severity === 'error' ? 'bg-danger-600/10 text-danger-300' : 'bg-warn-600/10 text-warn-300'}`}>
                    {issue.message}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-500">Validation not loaded yet.</p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-base font-semibold text-white mb-4">Execution</h3>
            <div className="space-y-3">
              <select value={orderMode} onChange={e => setOrderMode(e.target.value as 'TEST' | 'LIVE')} className="input">
                <option value="TEST">Real Binance test order</option>
                <option value="LIVE">Live order gated</option>
              </select>
              <input value={orderSymbol} onChange={e => setOrderSymbol(e.target.value.toUpperCase())} className="input" placeholder="Symbol" />
              <div className="grid grid-cols-2 gap-3">
                <select value={orderSide} onChange={e => setOrderSide(e.target.value as 'BUY' | 'SELL')} className="input">
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
                <input value={orderAmountUsd} onChange={e => setOrderAmountUsd(e.target.value)} className="input" placeholder="USD amount" inputMode="decimal" />
              </div>
              {orderMode === 'LIVE' && (
                <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3">
                  <p className="text-xs text-danger-200 mb-2">
                    Live order requires server switch ALLOW_LIVE_TRADING=true and the exact confirmation phrase configured on the Edge Function.
                  </p>
                  <input
                    value={confirmationPhrase}
                    onChange={e => setConfirmationPhrase(e.target.value)}
                    className="input"
                    placeholder="Confirmation phrase"
                  />
                </div>
              )}
              <button onClick={handleSubmitOrder} className="btn-primary w-full">
                {orderMode === 'TEST' ? 'Submit real Binance test order' : 'Submit gated live order'}
              </button>
              {executionResult && (
                <div className="rounded-lg border border-surface-700 bg-surface-900/60 p-3 text-sm">
                  <p className="font-semibold text-white flex items-center gap-2"><CheckCircle2 size={14} className="text-brand-400" />{executionResult.status}</p>
                  <p className="text-surface-400 mt-1">{executionResult.message}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">PnL</h3>
              <StatusBadge status={(tradingPnl?.pnlUsd || pnlUsd) >= 0 ? 'SUCCESS' : 'FAILED'} />
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Total value" value={formatUsd(tradingPnl?.totalValueUsd || totalValueUsd)} />
              <Row label="PnL USD" value={formatUsd(tradingPnl?.pnlUsd || pnlUsd)} />
              <Row label="PnL %" value={`${(tradingPnl?.pnlPct || pnlPct).toFixed(2)}%`} />
              <Row label="Window" value={tradingPnl?.sinceLabel || '24h'} />
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Wallet size={18} className="text-brand-400" />
        Wallet Balances
      </h2>
      {loading && walletBalances.length === 0 ? (
        <div className="card p-12 flex items-center justify-center">
          <LoadingSpinner size={24} />
          <span className="ml-3 text-surface-400">Fetching balances...</span>
        </div>
      ) : walletBalances.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-surface-400">No enabled wallets found. Connect a wallet to see balances.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {walletBalances.map(wb => (
            <WalletCard key={wb.walletId} data={wb} totalPortfolio={totalValueUsd} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-surface-500">{label}</span>
      <span className="text-white font-medium text-right">{value}</span>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color, bgColor }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center`}>
          <Icon size={18} className={color} />
        </div>
        <span className="text-xs text-surface-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-surface-500 mt-1">{sub}</p>
    </div>
  );
}

function TickerRow({ ticker }: { ticker: BinanceTicker }) {
  const positive = ticker.priceChangePercent >= 0;
  return (
    <div className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-900/60 px-3 py-2">
      <div>
        <p className="text-sm font-semibold text-white">{ticker.symbol}</p>
        <p className="text-[10px] text-surface-500">24h volume {ticker.quoteVolume.toLocaleString()}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-white">{formatUsd(ticker.lastPrice)}</p>
        <p className={positive ? 'text-brand-400 text-xs' : 'text-danger-400 text-xs'}>{positive ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%</p>
      </div>
    </div>
  );
}

function PortfolioChart({ history }: { history: PortfolioSnapshot[] }) {
  if (history.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-surface-400 text-sm">No portfolio history yet. Refresh balances to start tracking.</p>
      </div>
    );
  }

  const reversed = [...history].reverse();
  const maxVal = Math.max(...reversed.map(s => s.total_value_usd), 1);

  return (
    <div className="card p-5">
      <div className="flex items-end gap-1.5 h-40">
        {reversed.map((snap, i) => {
          const height = maxVal > 0 ? (snap.total_value_usd / maxVal) * 100 : 0;
          const isPositive = snap.total_pnl_usd >= 0;
          return (
            <div key={snap.id} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
              <div
                className={`w-full rounded-t-sm transition-all duration-300 ${isPositive ? 'bg-brand-500/60 hover:bg-brand-500' : 'bg-danger-500/60 hover:bg-danger-500'}`}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-[10px] whitespace-nowrap z-10 pointer-events-none">
                <p className="text-surface-200 font-semibold">{formatUsd(snap.total_value_usd)}</p>
                <p className={isPositive ? 'text-brand-400' : 'text-danger-400'}>
                  {isPositive ? '+' : ''}{formatUsd(snap.total_pnl_usd)}
                </p>
                <p className="text-surface-500">{new Date(snap.created_at).toLocaleString()}</p>
              </div>
              {i % Math.max(1, Math.floor(reversed.length / 6)) === 0 && (
                <span className="text-[8px] text-surface-600 mt-1">
                  {new Date(snap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-800">
        <span className="text-[10px] text-surface-500">{history.length} snapshots</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-brand-400">
            <ArrowUpRight size={10} /> Gain
          </span>
          <span className="flex items-center gap-1 text-[10px] text-danger-400">
            <ArrowDownRight size={10} /> Loss
          </span>
        </div>
      </div>
    </div>
  );
}

function WalletCard({ data, totalPortfolio }: { data: WalletBalanceData; totalPortfolio: number }) {
  const pct = totalPortfolio > 0 ? (data.totalValueUsd / totalPortfolio) * 100 : 0;
  const chainColor = data.chain === 'solana' ? 'text-[#9945FF]' : 'text-[#627EEA]';

  return (
    <div className="card p-5 hover:border-surface-700 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-sm font-bold ${chainColor}`}>
            {data.chain === 'solana' ? 'S' : 'E'}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{data.walletLabel}</p>
            <p className="text-[10px] text-surface-500 font-mono">{data.address.slice(0, 8)}...{data.address.slice(-6)}</p>
          </div>
        </div>
        <span className="badge-neutral text-[10px]">{data.platform}</span>
      </div>

      {data.error ? (
        <p className="text-xs text-danger-400">{data.error}</p>
      ) : (
        <>
          <div className="space-y-2.5">
            {data.tokens.map(token => (
              <div key={token.address} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-surface-200">{token.symbol}</span>
                  <span className="text-[10px] text-surface-500">{formatToken(token.balance)}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-white">{formatUsd(token.valueUsd)}</span>
                  <span className="text-[10px] text-surface-500 ml-2">@{formatUsd(token.price)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-surface-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-surface-500">Portfolio share</span>
              <span className="text-xs font-semibold text-surface-300">{pct.toFixed(1)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 bg-surface-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
