import { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

function looksLikeSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

export default function ManualSolanaWalletAdd({ onAdded }: { onAdded: () => void | Promise<void> }) {
  const [provider, setProvider] = useState<'PHANTOM' | 'SOLFLARE'>('PHANTOM');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function add() {
    const normalized = address.trim();
    setMessage('');
    if (!looksLikeSolanaAddress(normalized)) {
      setMessage('Adresse Solana invalide. Collez uniquement votre adresse publique.');
      return;
    }
    setSaving(true);
    try {
      await api.createManagedWallet({
        chain: 'solana',
        label: `${provider === 'PHANTOM' ? 'Phantom' : 'Solflare'} / Solana`,
        address: normalized,
        platform: provider,
        enabled: true,
      });
      setAddress('');
      setMessage('Wallet ajouté en lecture seule. Aucune seed ni clé privée n’est enregistrée.');
      await onAdded();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ajout impossible');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5 mb-8">
      <div className="flex items-start gap-3 mb-4">
        <ShieldCheck size={18} className="text-brand-400 mt-0.5" />
        <div>
          <h2 className="font-semibold text-white">Ajouter Phantom / Solflare manuellement</h2>
          <p className="text-xs text-surface-500 mt-1">Utile sur mobile ou si l’extension n’est pas détectée. Lecture seule tant que vous ne signez aucune transaction dans le wallet.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3">
        <select className="input" value={provider} onChange={e => setProvider(e.target.value as 'PHANTOM' | 'SOLFLARE')}>
          <option value="PHANTOM">Phantom</option>
          <option value="SOLFLARE">Solflare</option>
        </select>
        <input className="input font-mono" placeholder="Adresse publique Solana" value={address} onChange={e => setAddress(e.target.value)} />
        <button className="btn-primary flex items-center justify-center gap-2" disabled={saving} onClick={add}>
          <Plus size={15} /> {saving ? 'Ajout…' : 'Ajouter'}
        </button>
      </div>
      {message && <p className="text-xs text-surface-400 mt-3">{message}</p>}
    </div>
  );
}
