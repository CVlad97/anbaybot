import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, RefreshCw, Smartphone, CheckCircle2, AlertTriangle } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useWalletStore } from '../store/walletStore';
import {
  connectPhantom,
  connectSolflare,
  getConnectedSolanaAddress,
  getPhantomDeeplink,
  getSolflareDeeplink,
  isPhantomInstalled,
  isSolflareInstalled,
} from '../lib/wallets/solana';
import {
  connectEvmWallet,
  formatEvmAddress,
  getEvmWalletDeeplink,
  isEvmWalletInstalled,
  type EvmWalletId,
} from '../lib/wallets/evm';
import { fetchWalletBalances } from '../lib/walletBalances';
import { backendApiUrl } from '../lib/supabase';
import { publicApi, type PublicPortfolio } from '../lib/publicApi';
import type { ManagedWallet, WalletBalanceData } from '../lib/types';

function formatUsd(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function shorten(address: string | null) {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function WalletsPage() {
  const { evmAddress, evmProvider, setSolana, setEvm } = useWalletStore();
  const [phantomAddress, setPhantomAddress] = useState<string | null>(null);
  const [solflareAddress, setSolflareAddress] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [localSolana, setLocalSolana] = useState<WalletBalanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const appUrl = typeof window !== 'undefined' ? window.location.href : '';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [serverPortfolio, phantom, solflare] = await Promise.all([
        publicApi.portfolio(),
        getConnectedSolanaAddress('phantom'),
        getConnectedSolanaAddress('solflare'),
      ]);
      setPortfolio(serverPortfolio);
      setPhantomAddress(phantom);
      setSolflareAddress(solflare);

      if (phantom) setSolana(phantom, 'phantom');
      else if (solflare) setSolana(solflare, 'solflare');

      const localWallets: ManagedWallet[] = [];
      if (phantom) localWallets.push({ id: 'local-phantom', chain: 'solana', label: 'Phantom / Solana', address: phantom, platform: 'PHANTOM', enabled: true, created_at: new Date().toISOString() });
      if (solflare && solflare !== phantom) localWallets.push({ id: 'local-solflare', chain: 'solana', label: 'Solflare / Solana', address: solflare, platform: 'SOLFLARE', enabled: true, created_at: new Date().toISOString() });

      let solPrice = 0;
      if (backendApiUrl) {
        try {
          const res = await fetch(`${backendApiUrl}?path=trading/prices`, { cache: 'no-store' });
          if (res.ok) {
            const body = await res.json() as { data?: Array<{ symbol: string; lastPrice: number }> };
            solPrice = Number(body.data?.find(row => row.symbol === 'SOLUSDT')?.lastPrice || 0);
          }
        } catch {
          solPrice = 0;
        }
      }
      setLocalSolana(await fetchWalletBalances(localWallets, { sol: solPrice, eth: 0 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lecture portefeuille impossible');
    } finally {
      setLoading(false);
    }
  }, [setSolana]);

  useEffect(() => {
    refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  async function connectSolana(provider: 'phantom' | 'solflare') {
    setConnecting(provider);
    setError('');
    try {
      const address = provider === 'phantom' ? await connectPhantom() : await connectSolflare();
      if (provider === 'phantom') setPhantomAddress(address);
      else setSolflareAddress(address);
      setSolana(address, provider);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion refusée');
    } finally {
      setConnecting(null);
    }
  }

  async function connectEvm(provider: EvmWalletId) {
    setConnecting(provider);
    setError('');
    try {
      const address = await connectEvmWallet(provider);
      setEvm(address, provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion refusée');
    } finally {
      setConnecting(null);
    }
  }

  const browserWalletTotal = useMemo(
    () => localSolana.reduce((sum, row) => sum + row.totalValueUsd, 0),
    [localSolana],
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Wallet}
        title="Portefeuilles"
        subtitle="Lecture réelle, reconnexion automatique après la première autorisation"
        action={
          <button onClick={refresh} disabled={loading} className="btn-secondary flex items-center gap-2">
            {loading ? <LoadingSpinner size={14} /> : <RefreshCw size={14} />}
            Actualiser
          </button>
        }
      />

      <div className="card p-4 mb-6 border-l-4 border-l-brand-500/50">
        <div className="flex gap-3">
          <CheckCircle2 size={18} className="text-brand-400 mt-0.5 shrink-0" />
          <div className="text-sm text-surface-300">
            <p className="font-medium text-white">Aucun token admin requis pour voir les soldes.</p>
            <p className="mt-1 text-surface-400">Phantom et Solflare demandent obligatoirement une autorisation la première fois. Ensuite ANBAYBOT tente la reconnexion silencieuse avec <code>onlyIfTrusted</code>.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-6 border-l-4 border-l-warn-500 flex gap-3">
          <AlertTriangle size={18} className="text-warn-400 shrink-0" />
          <p className="text-sm text-warn-200">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <WalletConnector
          name="Phantom"
          chain="Solana"
          address={phantomAddress}
          installed={isPhantomInstalled()}
          connecting={connecting === 'phantom'}
          onConnect={() => connectSolana('phantom')}
          deeplink={isMobile ? getPhantomDeeplink(appUrl) : null}
        />
        <WalletConnector
          name="Solflare"
          chain="Solana"
          address={solflareAddress}
          installed={isSolflareInstalled()}
          connecting={connecting === 'solflare'}
          onConnect={() => connectSolana('solflare')}
          deeplink={isMobile ? getSolflareDeeplink(appUrl) : null}
        />
        <WalletConnector
          name="Trust Wallet"
          chain="Base / Ethereum"
          address={evmProvider === 'trust' ? evmAddress : null}
          installed={isEvmWalletInstalled('trust')}
          connecting={connecting === 'trust'}
          onConnect={() => connectEvm('trust')}
          deeplink={isMobile ? getEvmWalletDeeplink('trust', appUrl) : null}
        />
        <WalletConnector
          name="MetaMask / Coinbase"
          chain="Base / Ethereum"
          address={evmProvider === 'metamask' || evmProvider === 'base' ? evmAddress : null}
          installed={isEvmWalletInstalled('metamask') || isEvmWalletInstalled('base')}
          connecting={connecting === 'metamask' || connecting === 'base'}
          onConnect={() => connectEvm(isEvmWalletInstalled('base') ? 'base' : 'metamask')}
          deeplink={isMobile ? getEvmWalletDeeplink('metamask', appUrl) : null}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Stat label="Portefeuille serveur" value={formatUsd(portfolio?.totalValueUsd || 0)} />
        <Stat label="Solana navigateur" value={formatUsd(browserWalletTotal)} />
        <Stat label="Wallets serveur actifs" value={String(portfolio?.wallets.length || 0)} />
      </div>

      {localSolana.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Wallets Solana connectés dans ce navigateur</h2>
          <div className="space-y-3">
            {localSolana.map(row => (
              <div key={row.walletId} className="card p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{row.walletLabel}</p>
                    <p className="text-xs text-surface-500 font-mono">{shorten(row.address)}</p>
                  </div>
                  <p className="text-lg font-semibold text-brand-400">{formatUsd(row.totalValueUsd)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.tokens.length === 0 ? <span className="text-xs text-surface-500">Aucun SOL/USDC détecté</span> : row.tokens.map(token => (
                    <span key={`${row.walletId}-${token.symbol}`} className="badge-neutral">{token.balance.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} {token.symbol}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Portefeuille serveur vérifié</h2>
        <div className="space-y-3">
          {(portfolio?.wallets || []).map(wallet => (
            <div key={wallet.walletId} className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{wallet.label}</p>
                  <p className="text-xs text-surface-500">{wallet.chain} · {wallet.platform} · {wallet.addressMasked}</p>
                </div>
                <p className="text-lg font-semibold text-brand-400">{formatUsd(wallet.totalValueUsd)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {wallet.tokens.length === 0 ? <span className="text-xs text-surface-500">Aucun actif valorisé détecté</span> : wallet.tokens.map(token => (
                  <span key={`${wallet.walletId}-${token.symbol}`} className="badge-neutral">{token.balance.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} {token.symbol} · {formatUsd(token.valueUsd)}</span>
                ))}
              </div>
              {wallet.error && <p className="text-xs text-warn-300 mt-2">{wallet.error}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function WalletConnector({ name, chain, address, installed, connecting, onConnect, deeplink }: {
  name: string;
  chain: string;
  address: string | null;
  installed: boolean;
  connecting: boolean;
  onConnect: () => void;
  deeplink: string | null;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{name}</p>
          <p className="text-xs text-surface-500">{chain}</p>
        </div>
        {address && <CheckCircle2 size={18} className="text-brand-400" />}
      </div>
      {address ? (
        <div className="mt-4">
          <p className="text-xs text-brand-400 font-mono">{shorten(address)}</p>
          <p className="text-[11px] text-surface-500 mt-1">Reconnexion auto activée</p>
        </div>
      ) : installed ? (
        <button className="btn-primary w-full mt-4" disabled={connecting} onClick={onConnect}>
          {connecting ? 'Connexion…' : 'Connecter une fois'}
        </button>
      ) : deeplink ? (
        <a className="btn-secondary w-full mt-4 flex items-center justify-center gap-2" href={deeplink} rel="noopener noreferrer">
          <Smartphone size={15} /> Ouvrir dans le wallet
        </a>
      ) : (
        <p className="text-xs text-surface-500 mt-4">Wallet non détecté dans ce navigateur.</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-surface-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
