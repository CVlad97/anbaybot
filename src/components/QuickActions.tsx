import { useState } from 'react';
import { Zap, Repeat, Loader2 } from 'lucide-react';
import StatusBadge from './ui/StatusBadge';

type OrderMode = 'TEST' | 'LIVE';
type OrderSide = 'BUY' | 'SELL';

interface QuickTradeResult {
  mode: OrderMode;
  symbol: string;
  side: OrderSide;
  amountUsd: number;
  status: string;
  message: string;
}

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'ADA/USDT', 'DOT/USDT', 'LINK/USDT', 'AVAX/USDT', 'MATIC/USDT'];

export default function QuickActions() {
  const [mode, setMode] = useState<OrderMode>('TEST');
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [side, setSide] = useState<OrderSide>('BUY');
  const [amount, setAmount] = useState('25');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QuickTradeResult | null>(null);

  const handleQuickTrade = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    setRunning(true);
    setResult(null);

    // Simulate paper trading execution
    await new Promise(r => setTimeout(r, 1200));

    const isWin = Math.random() > 0.4;
    const pnlPct = isWin ? (Math.random() * 8 + 1) : -(Math.random() * 6 + 1);
    const pnlUsd = amt * (pnlPct / 100);

    setResult({
      mode,
      symbol,
      side,
      amountUsd: amt,
      status: 'FILLED',
      message: `${side === 'BUY' ? 'Achat' : 'Vente'} ${symbol} × $${amt} → ${isWin ? '+' : ''}${pnlUsd.toFixed(2)} USD (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`,
    });
    setRunning(false);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-brand-600/15 flex items-center justify-center">
          <Zap size={16} className="text-brand-400" />
        </div>
        <h3 className="font-semibold text-white">Quick Actions</h3>
      </div>

      <div className="space-y-3">
        {/* Mode */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('TEST')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'TEST'
                ? 'bg-warn-600/20 text-warn-400 border border-warn-600/30'
                : 'bg-surface-800 text-surface-400 border border-surface-700 hover:bg-surface-700'
            }`}
          >
            Mode Test
          </button>
          <button
            onClick={() => setMode('LIVE')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'LIVE'
                ? 'bg-danger-600/20 text-danger-400 border border-danger-600/30'
                : 'bg-surface-800 text-surface-400 border border-surface-700 hover:bg-surface-700'
            }`}
          >
            Mode Live
          </button>
        </div>

        {/* Symbol */}
        <select
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          className="input"
        >
          {SYMBOLS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Side + Amount */}
        <div className="grid grid-cols-2 gap-3">
          <select
            value={side}
            onChange={e => setSide(e.target.value as OrderSide)}
            className={`input font-semibold ${
              side === 'BUY' ? 'text-brand-400' : 'text-danger-400'
            }`}
          >
            <option value="BUY" className="text-brand-400">ACHAT</option>
            <option value="SELL" className="text-danger-400">VENTE</option>
          </select>
          <input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="input"
            placeholder="Montant USD"
            inputMode="decimal"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleQuickTrade}
          disabled={running}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Repeat size={14} />
          )}
          <span>{running ? 'Exécution...' : `${side === 'BUY' ? 'Acheter' : 'Vendre'} ${symbol.split('/')[0]} (Paper Trade)`}</span>
        </button>

        {/* Result */}
        {result && (
          <div className="rounded-xl border border-surface-700 bg-surface-900/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <StatusBadge status="SUCCESS" size="sm" />
                <span className="text-xs font-semibold text-surface-200">{result.symbol}</span>
              </div>
              <span className="text-[10px] text-surface-500">{result.mode}</span>
            </div>
            <p className="text-sm text-surface-300">{result.message}</p>
          </div>
        )}
      </div>

      {/* Quick trade tips */}
      <div className="mt-4 pt-4 border-t border-surface-800">
        <p className="text-[10px] text-surface-600 leading-relaxed">
          ⚡ Paper trading instantané — aucun ordre réel n'est envoyé. 
          Activez le mode Live uniquement après validation de votre configuration Binance.
        </p>
      </div>
    </div>
  );
}
