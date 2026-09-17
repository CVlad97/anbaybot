import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Smartphone, Wallet } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ManualSolanaWalletAdd from '../components/ManualSolanaWalletAdd';
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
  getEvmWalletDeeplink,
  isEvmWalletInstalled,
  type EvmWalletId,
} from '../lib/wallets/evm';
import { fetchWalletBalances } from '../lib/walletBalances';
import { backendApiUrl } from '../lib/supabase';
import { publicApi, type PublicExchangeAccount, type PublicPortfolio } from '../lib/publicApi';
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
  const [exchanges, setExchanges] = useState<PublicExchangeAccount[]>([]);
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
      const [serverPortfolio, exchangeData, phantom, solflare] = await Promise.all([
        publicApi.portfolio(), publicApi.exchanges(),
        getConnectedSolanaAddress('phantom'), getConnectedSolanaAddress('solflare'),
      ]);
      setPortfolio(serverPortfolio);
      setExchanges(exchangeData.exchanges);
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
        } catch { solPrice = 0; }
      }
      setLocalSolana(await fetchWalletBalances(localWallets, { sol: solPrice, eth: 0 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lecture portefeuille impossible');
    } finally {
      setLoading(false);
    }
  }, [setSolana]);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  async function connectSolana(provider: 'phantom' | 'solflare') {
    setConnecting(provider); setError('');
    try {
      const address = provider === 'phantom' ? await connectPhantom() : await connectSolflare();
      if (provider === 'phantom') setPhantomAddress(address); else setSolflareAddress(address);
      setSolana(address, provider);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Connexion refusée'); }
    finally { setConnecting(null); }
  }

  async function connectEvm(provider: EvmWalletId) {
    setConnecting(provider); setError('');
    try { setEvm(await connectEvmWallet(provider), provider); }
    catch (e) { setError(e instanceof Error ? e.message : 'Connexion refusée'); }
    finally { setConnecting(null); }
  }

  const browserWalletTotal = useMemo(() => localSolana.reduce((sum, row) => sum + row.totalValueUsd, 0), [localSolana]);
  const connectedExchangeTotal = useMemo(() => exchanges.filter(x => x.connection_status !== 'NOT_CONFIGURED').reduce((s,x)=>s+Number(x.balance_usd||0),0), [exchanges]);

  return (
    <div className="animate-fade-in">
      <PageHeader icon={Wallet} title="Wallets & exchanges" subtitle="Toutes les sources séparées : on-chain, navigateur et comptes d'exchange" action={
        <button onClick={refresh} disabled={loading} className="btn-secondary flex items-center gap-2">
          {loading ? <LoadingSpinner size={14} /> : <RefreshCw size={14} />} Actualiser
        </button>
      } />

      <div className="card p-4 mb-6 border-l-4 border-l-brand-500/50">
        <div className="flex gap-3"><CheckCircle2 size={18} className="text-brand-400 mt-0.5 shrink-0" /><div className="text-sm text-surface-300">
          <p className="font-medium text-white">Aucun token admin requis pour consulter les soldes.</p>
          <p className="mt-1 text-surface-400">Binance/MEXC apparaissent même non connectés. « — » signifie solde inconnu, pas solde nul.</p>
        </div></div>
      </div>

      {error && <div className="card p-4 mb-6 border-l-4 border-l-warn-500 flex gap-3"><AlertTriangle size={18} className="text-warn-400 shrink-0" /><p className="text-sm text-warn-200">{error}</p></div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <WalletConnector name="Phantom" chain="Solana" address={phantomAddress} installed={isPhantomInstalled()} connecting={connecting === 'phantom'} onConnect={() => connectSolana('phantom')} deeplink={isMobile ? getPhantomDeeplink(appUrl) : null} />
        <WalletConnector name="Solflare" chain="Solana" address={solflareAddress} installed={isSolflareInstalled()} connecting={connecting === 'solflare'} onConnect={() => connectSolana('solflare')} deeplink={isMobile ? getSolflareDeeplink(appUrl) : null} />
        <WalletConnector name="Trust Wallet" chain="Base / Ethereum" address={evmProvider === 'trust' ? evmAddress : null} installed={isEvmWalletInstalled('trust')} connecting={connecting === 'trust'} onConnect={() => connectEvm('trust')} deeplink={isMobile ? getEvmWalletDeeplink('trust', appUrl) : null} />
        <WalletConnector name="MetaMask / Coinbase" chain="Base / Ethereum" address={evmProvider === 'metamask' || evmProvider === 'base' ? evmAddress : null} installed={isEvmWalletInstalled('metamask') || isEvmWalletInstalled('base')} connecting={connecting === 'metamask' || connecting === 'base'} onConnect={() => connectEvm(isEvmWalletInstalled('base') ? 'base' : 'metamask')} deeplink={isMobile ? getEvmWalletDeeplink('metamask', appUrl) : null} />
      </div>

      <ManualSolanaWalletAdd onAdded={refresh} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Stat label="On-chain serveur" value={formatUsd(portfolio?.totalValueUsd || 0)} />
        <Stat label="Solana navigateur" value={formatUsd(browserWalletTotal)} />
        <Stat label="Exchanges connectés" value={formatUsd(connectedExchangeTotal)} />
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Comptes d'exchange</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exchanges.map(x => (
            <div key={x.exchange} className="card p-5">
              <div className="flex justify-between gap-3"><div><p className="font-semibold text-white">{x.label}</p><p className="text-xs text-surface-500 mt-1">{x.exchange}</p></div><span className="badge-neutral">{x.connection_status}</span></div>
              <p className="text-2xl font-bold text-white mt-4">{x.connection_status === 'NOT_CONFIGURED' ? '—' : formatUsd(Number(x.balance_usd || 0))}</p>
              <p className="text-xs text-surface-500 mt-1">{x.connection_status === 'NOT_CONFIGURED' ? 'API privée serveur non connectée : solde non lu.' : 'Solde lu via le backend.'}</p>
              <p className="text-xs text-surface-400 mt-3">LIVE trading : {x.live_trading_enabled ? 'activé' : 'désactivé'}</p>
            </div>
          ))}
        </div>
      </section>

      {localSolana.length > 0 && <section className="mb-8"><h2 className="text-lg font-semibold text-white mb-4">Solana connecté dans ce navigateur</h2><div className="space-y-3">{localSolana.map(row => <BalanceRow key={row.walletId} title={row.walletLabel} subtitle={shorten(row.address)} total={row.totalValueUsd} tokens={row.tokens.map(t => `${t.balance.toLocaleString('fr-FR',{maximumFractionDigits:6})} ${t.symbol}`)} />)}</div></section>}

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Wallets on-chain vérifiés</h2>
        <div className="space-y-3">
          {(portfolio?.wallets || []).map(wallet => <BalanceRow key={wallet.walletId} title={wallet.label} subtitle={`${wallet.chain} · ${wallet.platform} · ${wallet.addressMasked}`} total={wallet.totalValueUsd} tokens={wallet.tokens.map(t => `${t.balance.toLocaleString('fr-FR',{maximumFractionDigits:6})} ${t.symbol} · ${formatUsd(t.valueUsd)}`)} error={wallet.error} />)}
        </div>
      </section>
    </div>
  );
}

function WalletConnector({ name, chain, address, installed, connecting, onConnect, deeplink }: { name:string; chain:string; address:string|null; installed:boolean; connecting:boolean; onConnect:()=>void; deeplink:string|null }) {
  return <div className="card p-5"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-white">{name}</p><p className="text-xs text-surface-500">{chain}</p></div>{address && <CheckCircle2 size={18} className="text-brand-400" />}</div>{address ? <div className="mt-4"><p className="text-xs text-brand-400 font-mono">{shorten(address)}</p><p className="text-[11px] text-surface-500 mt-1">Reconnexion auto activée</p></div> : installed ? <button className="btn-primary w-full mt-4" disabled={connecting} onClick={onConnect}>{connecting ? 'Connexion…' : 'Connecter une fois'}</button> : deeplink ? <a className="btn-secondary w-full mt-4 flex items-center justify-center gap-2" href={deeplink} rel="noopener noreferrer"><Smartphone size={15}/> Ouvrir dans le wallet</a> : <p className="text-xs text-surface-500 mt-4">Wallet non détecté. Vous pouvez ajouter l’adresse publique ci-dessous.</p>}</div>;
}
function BalanceRow({ title, subtitle, total, tokens, error }: { title:string; subtitle:string; total:number; tokens:string[]; error?:string }) {
  return <div className="card p-4"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"><div><p className="font-medium text-white">{title}</p><p className="text-xs text-surface-500">{subtitle}</p></div><p className="text-lg font-semibold text-brand-400">{formatUsd(total)}</p></div><div className="mt-3 flex flex-wrap gap-2">{tokens.length ? tokens.map((t,i)=><span key={`${t}-${i}`} className="badge-neutral">{t}</span>) : <span className="text-xs text-surface-500">Aucun actif valorisé détecté</span>}</div>{error && <p className="text-xs text-warn-300 mt-2">{error}</p>}</div>;
}
function Stat({ label, value }: { label:string; value:string }) {
  return <div className="card p-4"><p className="text-xs text-surface-500 uppercase tracking-wider">{label}</p><p className="text-2xl font-bold text-white mt-1">{value}</p></div>;
}
