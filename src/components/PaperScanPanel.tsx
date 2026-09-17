import { useEffect, useState } from 'react';
import { RefreshCw, SearchCheck } from 'lucide-react';
import { runRevenueScan, type RevenueScanResult } from '../lib/revenueScanApi';

const AUTO_KEY = 'anbaybot_paper_scan_auto';

export default function PaperScanPanel() {
  const [result, setResult] = useState<RevenueScanResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [auto, setAuto] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(AUTO_KEY) === '1');

  async function scan() {
    setRunning(true);
    setError('');
    try {
      setResult(await runRevenueScan());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan impossible');
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (!auto) return;
    void scan();
    const timer = window.setInterval(() => void scan(), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [auto]);

  function toggleAuto() {
    const next = !auto;
    setAuto(next);
    window.localStorage.setItem(AUTO_KEY, next ? '1' : '0');
  }

  return (
    <div className="card p-5 mb-6 border-l-4 border-l-brand-500/60">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SearchCheck size={18} className="text-brand-400" />
            <h2 className="font-semibold text-white">Scanner PAPER / arbitrage</h2>
          </div>
          <p className="text-xs text-surface-500 mt-1">Funding, momentum et spread bid/ask Binance↔MEXC. Aucun ordre LIVE n’est envoyé.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary flex items-center gap-2" disabled={running} onClick={scan}>
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Scan…' : 'Scanner maintenant'}
          </button>
          <button className={auto ? 'btn-primary' : 'btn-ghost'} onClick={toggleAuto}>{auto ? 'Auto 15 min ON' : 'Auto 15 min OFF'}</button>
        </div>
      </div>

      {error && <p className="text-xs text-danger-300 mt-4">{error}</p>}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <Result label="Funding" value={result.bestFunding ? `${result.bestFunding.symbol} ${result.bestFunding.grossPct.toFixed(4)}% brut` : result.fundingStatus} />
          <Result label="Momentum 24h" value={result.strongest24h ? `${result.strongest24h.symbol} ${result.strongest24h.changePct.toFixed(2)}%` : result.marketStatus} />
          <Result label="Arbitrage brut" value={result.bestArbitrage ? `${result.bestArbitrage.symbol} ${result.bestArbitrage.buyVenue}→${result.bestArbitrage.sellVenue} ${result.bestArbitrage.grossSpreadPct.toFixed(4)}%` : result.arbitrageStatus} />
        </div>
      )}
      {result?.bestArbitrage && <p className="text-[11px] text-warn-300 mt-3">Spread brut uniquement : frais, slippage, retraits et latence ne sont pas encore soustraits.</p>}
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-surface-800 bg-surface-900 p-3"><p className="text-[10px] uppercase tracking-wider text-surface-500">{label}</p><p className="text-sm text-white mt-1">{value}</p></div>;
}
