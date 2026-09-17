import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { actionsApi } from '../lib/actionsApi';
import { publicApi, type LivePnl, type PublicPortfolio } from '../lib/publicApi';

function amountFor(wallet: PublicPortfolio['wallets'][number] | undefined, asset: 'USDT' | 'TRX') {
  return Number(wallet?.tokens.find(t => t.symbol === asset)?.balance || 0);
}

export default function TransferPlanner({ portfolio }: { portfolio: PublicPortfolio | null }) {
  const tronWallets = useMemo(() => (portfolio?.wallets || []).filter(w => w.chain.toLowerCase() === 'tron'), [portfolio]);
  const [sourceId, setSourceId] = useState('');
  const [asset, setAsset] = useState<'USDT' | 'TRX'>('USDT');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [pnl, setPnl] = useState<LivePnl | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sourceId && tronWallets[0]) setSourceId(tronWallets[0].walletId);
  }, [sourceId, tronWallets]);
  useEffect(() => { void publicApi.pnl().then(setPnl).catch(() => setPnl(null)); }, []);

  const source = tronWallets.find(w => w.walletId === sourceId);
  const available = amountFor(source, asset);

  async function prepare() {
    setMessage('');
    const value = Number(amount);
    if (!sourceId || !Number.isFinite(value) || value <= 0) {
      setMessage('Choisissez un wallet source et un montant positif.');
      return;
    }
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(destination.trim())) {
      setMessage('La destination TRON doit commencer par T. Une adresse Trust Wallet 0x… n’accepte pas directement USDT TRC20.');
      return;
    }
    setSaving(true);
    try {
      const result = await actionsApi.prepareTransfer({
        sourceWalletId: sourceId,
        asset,
        amount: value,
        destinationAddress: destination.trim(),
        note: 'Préparé depuis le tableau de bord ANBAYBOT',
      });
      setMessage(`Action préparée. Solde vérifié: ${result.balances.USDT.toFixed(6)} USDT / ${result.balances.TRX.toFixed(6)} TRX. Aucun transfert n’a été diffusé; signature wallet requise.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Préparation impossible');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5 mb-8">
      <div className="flex items-start gap-3 mb-4">
        <ArrowRightLeft size={18} className="text-brand-400 mt-0.5" />
        <div>
          <h2 className="font-semibold text-white">Transfert TRON → autre wallet</h2>
          <p className="text-xs text-surface-500 mt-1">Prépare le transfert et vérifie le réseau. La signature finale reste dans votre wallet.</p>
        </div>
      </div>

      <div className="card p-3 mb-4 border-l-4 border-l-warn-500/60">
        <div className="flex gap-2 text-xs text-surface-400">
          <ShieldAlert size={15} className="text-warn-400 shrink-0" />
          <p>P&L LIVE vérifié: <strong className="text-white">${Number(pnl?.totalNetPnlUsd || 0).toFixed(2)}</strong>. Ce registre n’attribue pas encore le gain à un wallet TRON précis; ANBAYBOT ne traitera donc jamais votre capital comme un « gain » automatiquement.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <select className="input" value={sourceId} onChange={e => setSourceId(e.target.value)}>
          {tronWallets.map(w => <option key={w.walletId} value={w.walletId}>{w.label}</option>)}
        </select>
        <select className="input" value={asset} onChange={e => setAsset(e.target.value as 'USDT' | 'TRX')}>
          <option value="USDT">USDT TRC20</option>
          <option value="TRX">TRX</option>
        </select>
        <div>
          <input className="input w-full" type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Montant (disponible ≈ ${available.toFixed(6)})`} />
          <div className="flex gap-2 mt-2">
            <button className="btn-ghost text-xs" onClick={() => setAmount((available * 0.5).toFixed(6))}>50% du solde</button>
            <button className="btn-ghost text-xs" onClick={() => setAmount(available.toFixed(6))}>100%</button>
          </div>
        </div>
        <input className="input font-mono" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Adresse Trust Wallet TRON (T…)" />
      </div>

      <button className="btn-primary mt-4" disabled={saving || tronWallets.length === 0} onClick={prepare}>
        {saving ? 'Vérification…' : 'Préparer le transfert'}
      </button>
      {tronWallets.length === 0 && <p className="text-xs text-warn-300 mt-3">Aucun wallet TRON suivi.</p>}
      {message && <p className="text-xs text-surface-300 mt-3">{message}</p>}
    </section>
  );
}
