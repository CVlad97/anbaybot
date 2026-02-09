import { useState, useEffect } from 'react';
import { Users, Plus, Ban, Eye, EyeOff, Star, Trash2 } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { useAppStore } from '../store/appStore';
import { supabase } from '../lib/supabase';
import type { FollowedWallet } from '../lib/types';

export default function TradersPage() {
  const { followedWallets, setFollowedWallets, addAuditLog } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newChain, setNewChain] = useState('solana');

  useEffect(() => { loadWallets(); }, []);

  async function loadWallets() {
    const { data } = await supabase.from('followed_wallets').select('*').order('score', { ascending: false });
    if (data) setFollowedWallets(data as FollowedWallet[]);
  }

  async function addWallet() {
    if (!newAddress.trim()) return;
    await supabase.from('followed_wallets').insert({
      address: newAddress.trim(),
      chain: newChain,
      label: newLabel || `Trader ${newAddress.slice(0, 8)}...`,
      score: 0,
      score_reasons: [],
    });
    setNewAddress('');
    setNewLabel('');
    setShowAdd(false);
    await loadWallets();
    addAuditLog('followed_wallet_added', { address: newAddress.trim() });
  }

  async function toggleFollow(id: string, enabled: boolean) {
    await supabase.from('followed_wallets').update({ enabled: !enabled }).eq('id', id);
    await loadWallets();
  }

  async function toggleBlacklist(id: string, blacklisted: boolean) {
    await supabase.from('followed_wallets').update({ blacklisted: !blacklisted, enabled: blacklisted }).eq('id', id);
    await loadWallets();
    addAuditLog('followed_wallet_blacklist_toggle', { id, blacklisted: !blacklisted });
  }

  async function removeWallet(id: string) {
    await supabase.from('followed_wallets').delete().eq('id', id);
    await loadWallets();
  }

  function scoreColor(score: number) {
    if (score >= 70) return 'text-brand-400';
    if (score >= 40) return 'text-warn-400';
    return 'text-surface-400';
  }

  const active = followedWallets.filter(w => !w.blacklisted);
  const blacklisted = followedWallets.filter(w => w.blacklisted);

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Users}
        title="Top Traders"
        subtitle="Follow and rank wallet addresses by observable metrics"
        action={
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            <span>Follow Wallet</span>
          </button>
        }
      />

      <div className="card p-4 mb-6 border-l-4 border-l-warn-500/50">
        <p className="text-xs text-surface-400">
          Rankings are based on observable on-chain metrics (volume, liquidity, trade frequency).
          This is purely technical analysis and does not constitute financial advice or guarantee any returns.
        </p>
      </div>

      {showAdd && (
        <div className="card p-6 mb-6 animate-slide-up">
          <h3 className="text-sm font-semibold text-surface-200 mb-4">Follow a New Wallet</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input className="input" placeholder="Label" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
            <input className="input" placeholder="Wallet address" value={newAddress} onChange={e => setNewAddress(e.target.value)} />
            <select className="input" value={newChain} onChange={e => setNewChain(e.target.value)}>
              <option value="solana">Solana</option>
              <option value="evm">EVM</option>
            </select>
          </div>
          <div className="flex gap-3 mt-4">
            <button className="btn-primary" onClick={addWallet}>Follow</button>
            <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Star size={18} className="text-warn-400" />
        Active ({active.length})
      </h2>

      {active.length === 0 ? (
        <EmptyState icon={Users} title="No followed wallets" description="Add wallet addresses to track and rank top traders." />
      ) : (
        <div className="space-y-3 mb-8">
          {active.map(w => (
            <div key={w.id} className="card-hover p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center">
                <span className={`text-lg font-bold ${scoreColor(w.score)}`}>{w.score}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-white truncate">{w.label}</p>
                  <span className="badge-neutral text-[10px]">{w.chain}</span>
                  {w.enabled && <span className="badge-green text-[10px]">Active</span>}
                </div>
                <p className="text-xs text-surface-500 font-mono truncate">{w.address}</p>
                {w.score_reasons && w.score_reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {w.score_reasons.map((r, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-surface-800 rounded-md text-surface-400">
                        {r.metric}: {r.value} ({r.weight}pts)
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggleFollow(w.id, w.enabled)} className="btn-ghost p-2" title={w.enabled ? 'Pause' : 'Resume'}>
                  {w.enabled ? <Eye size={16} className="text-brand-400" /> : <EyeOff size={16} />}
                </button>
                <button onClick={() => toggleBlacklist(w.id, w.blacklisted)} className="btn-ghost p-2" title="Blacklist">
                  <Ban size={16} />
                </button>
                <button onClick={() => removeWallet(w.id)} className="btn-ghost p-2 text-danger-400">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {blacklisted.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-surface-400 mb-4 flex items-center gap-2">
            <Ban size={18} />
            Blacklisted ({blacklisted.length})
          </h2>
          <div className="space-y-3">
            {blacklisted.map(w => (
              <div key={w.id} className="card p-4 flex items-center gap-4 opacity-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-400 truncate">{w.label}</p>
                  <p className="text-xs text-surface-600 font-mono truncate">{w.address}</p>
                </div>
                <button onClick={() => toggleBlacklist(w.id, w.blacklisted)} className="btn-ghost p-2 text-xs">
                  Restore
                </button>
                <button onClick={() => removeWallet(w.id)} className="btn-ghost p-2 text-danger-400">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
