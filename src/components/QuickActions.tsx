import { useState } from 'react';
import { Repeat, Zap } from 'lucide-react';
import StatusBadge from './ui/StatusBadge';

type OrderSide = 'BUY' | 'SELL';

interface QuickTradeResult {
  mode: 'TEST';
  symbol: string;
  side: OrderSide;
  amountUsd: number;
  status: 'PREPARED';
  message: string;
}

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];

export default function QuickActions() {
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [side, setSide] = useState<OrderSide>('BUY');
  const [amount, setAmount] = useState('25');
  const [result, setResult] = useState<QuickTradeResult | null>(null);

  const handlePrepare = () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setResult({
      mode: 'TEST',
      symbol,
      side,
      amountUsd: amt,
      status: 'PREPARED',
      message: `TEST préparé : ${side} ${symbol} pour ${amt.toFixed(2)} USD. Aucun ordre, aucun P&L et aucun mouvement de fonds n'ont été générés.`,
    });
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-brand-600/15 flex items-center justify-center"><Zap size={16} className="text-brand-400" /></div>
        <h3 className="font-semibold text-white">Ordre TEST</h3>
      </div>

      <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 p-3 mb-3">
        <p className="text-xs font-medium text-brand-200">Préparation uniquement</p>
        <p className="text-[10px] text-brand-100 mt-1">Aucun résultat aléatoire : le P&L reste à 0 tant qu'une exécution réellement enregistrée n'existe pas.</p>
      </div>

      <div className="space-y-3">
        <select value={symbol} onChange={e => setSymbol(e.target.value)} className="input">
          {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <select value={side} onChange={e => setSide(e.target.value as OrderSide)} className="input font-semibold">
            <option value="BUY">ACHAT</option><option value="SELL">VENTE</option>
          </select>
          <input value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="Montant USD" inputMode="decimal" />
        </div>
        <button onClick={handlePrepare} className="btn-primary w-full flex items-center justify-center gap-2"><Repeat size={14} />Préparer TEST</button>

        {result && <div className="rounded-xl border border-surface-700 bg-surface-900/60 p-3">
          <div className="flex items-center justify-between mb-2"><StatusBadge status="PREPARED" size="sm" /><span className="text-[10px] text-surface-500">{result.mode}</span></div>
          <p className="text-sm text-surface-300">{result.message}</p>
        </div>}
      </div>
    </div>
  );
}
