import { useCallback, useEffect, useState } from 'react';
import {
  Wallet, Plus, Trash2, ExternalLink, Smartphone,
  ToggleLeft, ToggleRight, RefreshCw, DollarSign,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useWalletStore } from '../store/walletStore';
import { useAppStore } from '../store/appStore';
import { api } from '../lib/api';
import {
  connectPhantom, connectSolflare,
  isPhantomInstalled, isSolflareInstalled,
  getPhantomDeeplink, getSolflareDeeplink,
} from '../lib/wallets/solana';
import {
  connectEvmWallet,
  formatEvmAddress,
  getEvmWalletDeeplink,
  isEvmWalletInstalled,
  walletLabel,
  type EvmWalletId,
} from '../lib/wallets/evm';
import type { ManagedWallet } from '../lib/types';

function formatUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function WalletsPage() {
  const { solanaAddress, solanaProvider, evmAddress, evmProvider, setSolana, setEvm } = useWalletStore();
  const { managedWallets, setManagedWallets, walletBalances, setWalletBalances, setPortfolioData, addAuditLog } = useAppStore();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newChain, setNewChain] = useState('solana');
  const [newPlatform, setNewPlatform] = useState<ManagedWallet['platform']>('PHANTOM');
  const [loadingBalances, setLoadingBalances] = useState(false);

  const refreshBalances = useCallback(async () => {
    setLoadingBalances(true);
    try {
      const result = await api.getBalances();
      setWalletBalances(result.balances);
      setPortfolioData({
        totalValueUsd: result.totalValueUsd,
        pnlUsd: result.pnlUsd,
        pnlPct: result.pnlPct,
        prices: result.prices,
      });
    } catch {
      // silent
    }
    setLoadingBalances(false);
  }, [setPortfolioData, setWalletBalances]);

  const loadWallets = useCallback(async () => {
    const { data } = await api.getManagedWallets();
    if (data) {
      setManagedWallets(data as ManagedWallet[]);
      if (data.length > 0) refreshBalances();
    }
  }, [refreshBalances, setManagedWallets]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  async function handleConnect(provider: 'phantom' | 'solflare' | EvmWalletId) {
    setConnecting(provider);
    try {
      let address: string;
      if (provider === 'phantom') {
        address = await connectPhantom();
        setSolana(address, 'phantom');
        await saveWallet(address, 'solana', 'PHANTOM', `Phantom (${address.slice(0, 6)}...)`);
      } else if (provider === 'solflare') {
        address = await connectSolflare();
        setSolana(address, 'solflare');
        await saveWallet(address, 'solana', 'SOLFLARE', `Solflare (${address.slice(0, 6)}...)`);
      } else {
        address = await connectEvmWallet(provider);
        setEvm(address, provider);
        const platform = provider === 'trust' ? 'TRUST' : provider === 'base' ? 'BASE' : 'METAMASK';
        await saveWallet(address, 'evm', platform, `${walletLabel(provider)} (${formatEvmAddress(address)})`);
      }
      addAuditLog('wallet_connected', { provider, address });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addAuditLog('wallet_connect_failed', { provider, error: msg });
    } finally {
      setConnecting(null);
    }
  }

  async function saveWallet(address: string, chain: string, platform: ManagedWallet['platform'], label: string) {
    const existing = managedWallets.find(w => w.address === address);
    if (existing) return;
    await api.createManagedWallet({ address, chain, platform, label });
    await loadWallets();
  }

  async function addManualWallet() {
    if (!newAddress.trim()) return;
    await api.createManagedWallet({
      address: newAddress.trim(),
      chain: newChain,
      platform: newPlatform,
      label: newLabel || `Wallet ${newAddress.slice(0, 8)}...`,
    });
    setNewAddress('');
    setNewLabel('');
    setShowAdd(false);
    await loadWallets();
    addAuditLog('wallet_added_manual', { address: newAddress.trim() });
  }

  async function toggleWallet(id: string, enabled: boolean) {
    await api.updateManagedWallet(id, { enabled: !enabled });
    await loadWallets();
  }

  async function removeWallet(id: string) {
    await api.deleteManagedWallet(id);
    await loadWallets();
    addAuditLog('wallet_removed', { id });
  }

  function getWalletBalance(walletId: string) {
    return walletBalances.find(wb => wb.walletId === walletId);
  }

  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const appUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Wallet}
        title="Wallets"
        subtitle="Connect and manage your trading wallets"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={refreshBalances}
              disabled={loadingBalances}
              className="btn-secondary flex items-center gap-2"
            >
              {loadingBalances ? <LoadingSpinner size={14} /> : <RefreshCw size={14} />}
              <span className="hidden sm:inline">Balances</span>
            </button>
            <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-2">
              <Plus size={16} />
              <span>Add Wallet</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <ConnectorCard
          name="Phantom"
          chain="Solana"
          color="#AB9FF2"
          letter="P"
          connected={!!(solanaAddress && solanaProvider === 'phantom')}
          address={solanaAddress && solanaProvider === 'phantom' ? solanaAddress : null}
          installed={isPhantomInstalled()}
          connecting={connecting === 'phantom'}
          onConnect={() => handleConnect('phantom')}
          deeplink={isMobile ? getPhantomDeeplink(appUrl) : null}
        />
        <ConnectorCard
          name="Solflare"
          chain="Solana"
          color="#FC8C2C"
          letter="S"
          connected={!!(solanaAddress && solanaProvider === 'solflare')}
          address={solanaAddress && solanaProvider === 'solflare' ? solanaAddress : null}
          installed={isSolflareInstalled()}
          connecting={connecting === 'solflare'}
          onConnect={() => handleConnect('solflare')}
          deeplink={isMobile ? getSolflareDeeplink(appUrl) : null}
        />
        <ConnectorCard
          name="MetaMask"
          chain="Base / Ethereum"
          color="#F6851B"
          letter="M"
          connected={!!(evmAddress && evmProvider === 'metamask')}
          address={evmAddress && evmProvider === 'metamask' ? formatEvmAddress(evmAddress) : null}
          installed={isEvmWalletInstalled('metamask')}
          connecting={connecting === 'metamask'}
          onConnect={() => handleConnect('metamask')}
          deeplink={isMobile ? getEvmWalletDeeplink('metamask', appUrl) : null}
        />
        <ConnectorCard
          name="Trust Wallet"
          chain="Base / EVM"
          color="#3375BB"
          letter="T"
          connected={!!(evmAddress && evmProvider === 'trust')}
          address={evmAddress && evmProvider === 'trust' ? formatEvmAddress(evmAddress) : null}
          installed={isEvmWalletInstalled('trust')}
          connecting={connecting === 'trust'}
          onConnect={() => handleConnect('trust')}
          deeplink={isMobile ? getEvmWalletDeeplink('trust', appUrl) : null}
        />
        <ConnectorCard
          name="Base Wallet"
          chain="Coinbase / Base"
          color="#0052FF"
          letter="B"
          connected={!!(evmAddress && evmProvider === 'base')}
          address={evmAddress && evmProvider === 'base' ? formatEvmAddress(evmAddress) : null}
          installed={isEvmWalletInstalled('base')}
          connecting={connecting === 'base'}
          onConnect={() => handleConnect('base')}
          deeplink={isMobile ? getEvmWalletDeeplink('base', appUrl) : null}
        />
      </div>

      {showAdd && (
        <div className="card p-6 mb-8 animate-slide-up">
          <h3 className="text-sm font-semibold text-surface-200 mb-4">Add Wallet Manually</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input className="input" placeholder="Label" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
            <input className="input" placeholder="Wallet address" value={newAddress} onChange={e => setNewAddress(e.target.value)} />
            <select className="input" value={newChain} onChange={e => setNewChain(e.target.value)}>
              <option value="solana">Solana</option>
              <option value="evm">EVM (Base/ETH)</option>
            </select>
            <select className="input" value={newPlatform} onChange={e => setNewPlatform(e.target.value as ManagedWallet['platform'])}>
              <option value="PHANTOM">Phantom</option>
              <option value="SOLFLARE">Solflare</option>
              <option value="METAMASK">MetaMask</option>
              <option value="TRUST">Trust Wallet</option>
              <option value="BASE">Base / Coinbase Wallet</option>
              <option value="EVM">EVM</option>
              <option value="CEX">CEX (V2)</option>
            </select>
          </div>
          <div className="flex gap-3 mt-4">
            <button className="btn-primary" onClick={addManualWallet}>Save</button>
            <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-white mb-4">Managed Wallets</h2>
      {managedWallets.length === 0 ? (
        <EmptyState icon={Wallet} title="No wallets yet" description="Connect a wallet above or add one manually to get started." />
      ) : (
        <div className="space-y-3">
          {managedWallets.map(w => {
            const bal = getWalletBalance(w.id);
            return (
              <div key={w.id} className="card p-4 flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${w.enabled ? 'bg-brand-400' : 'bg-surface-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{w.label}</p>
                    <span className="badge-neutral text-[10px]">{w.platform}</span>
                    <span className="badge-neutral text-[10px]">{w.chain}</span>
                  </div>
                  <p className="text-xs text-surface-500 font-mono mt-0.5 truncate">{w.address}</p>
                </div>
                {bal && bal.tokens.length > 0 && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-800/50 rounded-lg border border-surface-700/50">
                    <DollarSign size={12} className="text-brand-400" />
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{formatUsd(bal.totalValueUsd)}</p>
                      <p className="text-[10px] text-surface-500">
                        {bal.tokens[0].balance.toFixed(4)} {bal.tokens[0].symbol}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleWallet(w.id, w.enabled)} className="btn-ghost p-2">
                    {w.enabled ? <ToggleRight size={20} className="text-brand-400" /> : <ToggleLeft size={20} />}
                  </button>
                  <a
                    href={w.chain === 'solana' ? `https://solscan.io/account/${w.address}` : `https://basescan.org/address/${w.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost p-2"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button onClick={() => removeWallet(w.id)} className="btn-ghost p-2 text-danger-400 hover:text-danger-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConnectorCard({ name, chain, color, letter, connected, address, installed, connecting, onConnect, deeplink }: {
  name: string;
  chain: string;
  color: string;
  letter: string;
  connected: boolean;
  address: string | null;
  installed: boolean;
  connecting: boolean;
  onConnect: () => void;
  deeplink: string | null;
}) {
  return (
    <div className="card-hover p-5 text-left group">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <span className="text-lg font-bold" style={{ color }}>{letter}</span>
        </div>
        <div>
          <p className="font-semibold text-white">{name}</p>
          <p className="text-xs text-surface-500">{chain}</p>
        </div>
        {connecting && <LoadingSpinner size={14} />}
      </div>
      {connected && address ? (
        <p className="text-xs text-brand-400 font-mono truncate">{address}</p>
      ) : installed ? (
        <button onClick={onConnect} disabled={connecting} className="text-xs text-surface-300 hover:text-brand-300">
          Click to connect
        </button>
      ) : deeplink ? (
        <a href={deeplink} className="text-xs text-brand-400 flex items-center gap-1" rel="noopener noreferrer">
          <Smartphone size={12} /> Open in {name}
        </a>
      ) : (
        <p className="text-xs text-surface-500">Not installed</p>
      )}
    </div>
  );
}
