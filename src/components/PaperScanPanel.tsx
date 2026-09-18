import { useEffect, useState } from 'react';
import { RefreshCw, SearchCheck } from 'lucide-react';
import { actionsApi } from '../lib/actionsApi';
import { runRevenueScan, type RevenueScanResult } from '../lib/revenueScanApi';

const AUTO_KEY = 'anbaybot_paper_scan_auto';

export default function PaperScanPanel() {
  const [result, setResult] = useState<RevenueScanResult | null>(null);
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [auto, setAuto] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(AUTO_KEY) === '1');

  async function scan() {
    setRunning(true);
    setError('');
    setMessage('');
    try {
      setResult(await runRevenueScan());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan impossible');
    } finally {
      setRunning(false);
    }
  }

  async function prepareArbitrage() {
    const arb = result?.bestArbitrage;
    if (!arb) return;
    setPreparing(true);
    setError('');
    setMessage('');
    try {
      await actionsApi.prepareArbitrage({
        symbol: arb.symbol,
        buyVenue: arb.buyVenue,
        sellVenue: arb.sellVenue,
        amountUsd: 10,
        grossSpreadPct: arb.grossSpreadPct,
      });
      setMessage('Arbitrage PAPER 10 USD préparé et enregistré. Aucun ordre réel n’a été envoyé.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Préparation arbitrage impossible');
    } finally {
      setPreparing(false);
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
            <h2 className="font-semibold text-white">IA Opportunity Lab · horizon 60 min</h2>
          </div>
          <p className="text-xs text-surface-500 mt-1">Arbitrage, momentum, funding, Earn stablecoins et farming. Analyse/PAPER uniquement; aucun gain ni ordre LIVE n’est garanti.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary flex items-center gap-2" disabled={running} onClick={scan}>
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Scan…' : 'Scanner maintenant'}
          </button>
          <button className={auto ? 'btn-primary' : 'btn-ghost'} onClick={toggleAuto}>{auto ? 'Auto 15 min ON' : 'Auto 15 min OFF'}</button>
        </div>
      </div>

      {error && <p className="text-xs text-danger-300 mt-4">{error}</p>}
      {message && <p className="text-xs text-brand-300 mt-4">{message}</p>}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mt-4">
          <Result label="Funding" value={result.bestFunding ? `${result.bestFunding.symbol} ${result.bestFunding.grossPct.toFixed(4)}% brut` : result.fundingStatus} />
          <Result label="Momentum 24h" value={result.strongest24h ? `${result.strongest24h.symbol} ${result.strongest24h.changePct.toFixed(2)}%` : result.marketStatus} />
          <Result label="Arbitrage brut" value={result.bestArbitrage ? `${result.bestArbitrage.symbol} ${result.bestArbitrage.buyVenue}→${result.bestArbitrage.sellVenue} ${result.bestArbitrage.grossSpreadPct.toFixed(4)}%` : result.arbitrageStatus} />
          <Result label="Earn stablecoin" value={result.bestYield ? `${result.bestYield.project} · ${result.bestYield.symbol} · ${result.bestYield.apy.toFixed(2)}% APY` : result.yieldStatus} />
          <Result label="Farming / LP" value={result.bestFarm ? `${result.bestFarm.project} · ${result.bestFarm.symbol} · ${result.bestFarm.apy.toFixed(2)}% APY` : result.farmingStatus} />
        </div>
      )}
      {result && (
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-3 mt-3">
          <p className="text-[10px] uppercase tracking-wider text-surface-500">Équivalent simple sur 1 h</p>
          <p className="text-sm text-white mt-1">{result.yieldHourlyGrossUsd == null ? 'Aucun rendement stablecoin qualifié pour calculer un équivalent horaire.' : `≈ ${result.yieldHourlyGrossUsd.toFixed(4)} brut / heure si tout le capital observé (${result.capitalObservedUsd.toFixed(2)}) était placé au meilleur APY.`}</p>
          <p className="text-[11px] text-surface-500 mt-1">Conversion simple d’un APY annuel : rendement non garanti, hors frais et risques.</p>
        </div>
      )}
      {result?.bestYield && <p className="text-[11px] text-surface-400 mt-3">Earn : {result.bestYield.chain} · TVL ${(result.bestYield.tvlUsd / 1_000_000).toFixed(1)} M$ · IL {result.bestYield.ilRisk}. Aucun dépôt automatique.</p>}
      {result?.bestFarm && <p className="text-[11px] text-surface-400 mt-2">Farm : {result.bestFarm.chain} · TVL ${(result.bestFarm.tvlUsd / 1_000_000).toFixed(1)} M$ · IL {result.bestFarm.ilRisk}. Risque protocole/IL à contrôler.</p>}
      {result?.bestArbitrage && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-[11px] text-warn-300 flex-1">Spread brut uniquement : frais, slippage, retraits et latence ne sont pas encore soustraits.</p>
          <button className="btn-secondary whitespace-nowrap" disabled={preparing} onClick={prepareArbitrage}>
            {preparing ? 'Préparation…' : 'Préparer arbitrage PAPER · 10 USD'}
          </button>
        </div>
      )}
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-surface-800 bg-surface-900 p-3"><p className="text-[10px] uppercase tracking-wider text-surface-500">{label}</p><p className="text-sm text-white mt-1">{value}</p></div>;
}
