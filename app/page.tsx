'use client';

import { useState, useEffect } from 'react';
import {
  connectPhantom,
  connectSolflare,
  connectMetaMask,
  isPhantomInstalled,
  isSolflareInstalled,
  isMetaMaskInstalled,
  getPhantomDeeplink,
  getSolflareDeeplink,
  validateSolanaAddress,
  validateEvmAddress,
} from '@/lib/wallet-utils';
import { Activity, TrendingUp, Shield, Zap, Wallet, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface Action {
  id: string;
  status: string;
  actionType: string;
  strategyId: string;
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedAmountOut?: string;
  txData?: string;
  payload: any;
  riskChecks: any;
  createdAt: string;
  wallet?: any;
}

interface MarketToken {
  symbol: string;
  address: string;
  chain: string;
  price?: number;
  priceChange24h?: number;
  volume24h?: number;
  liquidity?: number;
}

export default function Home() {
  const [connectedWallet, setConnectedWallet] = useState<{ address: string; platform: string; chain: string } | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [signals, setSignals] = useState<MarketToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [killSwitch, setKillSwitch] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'actions' | 'signals' | 'wallet'>('actions');
  const [walletError, setWalletError] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadActions();
    loadSignals();
    loadKillSwitch();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadActions = async () => {
    try {
      const res = await fetch('/api/actions?limit=20');
      const data = await res.json();
      setActions(data.actions || []);
    } catch (err) {
      console.error('Failed to load actions:', err);
    }
  };

  const loadSignals = async () => {
    try {
      const res = await fetch('/api/market/dex-movers');
      const data = await res.json();
      setSignals(data.items?.slice(0, 10) || []);
    } catch (err) {
      console.error('Failed to load signals:', err);
    }
  };

  const loadKillSwitch = async () => {
    try {
      const res = await fetch('/api/kill');
      const data = await res.json();
      setKillSwitch(data.settings?.killSwitch || false);
    } catch (err) {
      console.error('Failed to load kill switch:', err);
    }
  };

  const handleConnectWallet = async (platform: 'phantom' | 'solflare' | 'metamask') => {
    try {
      setWalletError('');
      let address = '';
      let chain = '';

      if (platform === 'phantom') {
        if (!isPhantomInstalled()) {
          if (typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            const appUrl = window.location.origin;
            window.location.href = getPhantomDeeplink(appUrl);
            return;
          }
          setWalletError('Phantom wallet not found. Please install it.');
          return;
        }
        address = await connectPhantom();
        chain = 'solana';
      } else if (platform === 'solflare') {
        if (!isSolflareInstalled()) {
          if (typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            const appUrl = window.location.origin;
            window.location.href = getSolflareDeeplink(appUrl);
            return;
          }
          setWalletError('Solflare wallet not found. Please install it.');
          return;
        }
        address = await connectSolflare();
        chain = 'solana';
      } else if (platform === 'metamask') {
        if (!isMetaMaskInstalled()) {
          setWalletError('MetaMask not found. Please install it.');
          return;
        }
        address = await connectMetaMask();
        chain = 'ethereum';
      }

      if (chain === 'solana' && !validateSolanaAddress(address)) {
        setWalletError('Invalid Solana address');
        return;
      }

      if (chain === 'ethereum' && !validateEvmAddress(address)) {
        setWalletError('Invalid Ethereum address');
        return;
      }

      setConnectedWallet({ address, platform, chain });

      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: `${platform} wallet`,
          platform,
          chain,
          address,
          enabled: true,
        }),
      });

      if (res.ok) {
        showNotification('success', `Connected to ${platform}!`);
      }
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setWalletError(err.message || 'Failed to connect wallet');
    }
  };

  const handleToggleKillSwitch = async () => {
    try {
      const res = await fetch('/api/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !killSwitch }),
      });

      if (res.ok) {
        setKillSwitch(!killSwitch);
        showNotification('success', `Kill switch ${!killSwitch ? 'enabled' : 'disabled'}`);
      }
    } catch (err) {
      console.error('Failed to toggle kill switch:', err);
      showNotification('error', 'Failed to toggle kill switch');
    }
  };

  const handleBuildTransaction = async (actionId: string) => {
    if (!connectedWallet) {
      showNotification('error', 'Please connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/actions/${actionId}/build?userPublicKey=${connectedWallet.address}`);
      const data = await res.json();

      if (res.ok) {
        showNotification('success', 'Transaction built successfully!');
        await loadActions();

        await handleSignTransaction(actionId, data.txData);
      } else {
        showNotification('error', data.error || 'Failed to build transaction');
      }
    } catch (err: any) {
      console.error('Build transaction error:', err);
      showNotification('error', err.message || 'Failed to build transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleSignTransaction = async (actionId: string, txData: string) => {
    if (!connectedWallet || connectedWallet.chain !== 'solana') {
      showNotification('error', 'Solana wallet required for signing');
      return;
    }

    try {
      const { VersionedTransaction } = await import('@solana/web3.js');

      const txBytes = Uint8Array.from(atob(txData), c => c.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(txBytes);

      const provider = connectedWallet.platform === 'phantom' ? window.solana : window.solflare;
      if (!provider) {
        showNotification('error', 'Wallet provider not found');
        return;
      }

      let signature: string;

      if (provider.signAndSendTransaction) {
        const result = await provider.signAndSendTransaction(transaction);
        signature = result.signature;
      } else if (provider.signTransaction) {
        const signedTx = await provider.signTransaction(transaction);
        const { Connection } = await import('@solana/web3.js');
        const connection = new Connection('https://api.mainnet-beta.solana.com');
        const sig = await connection.sendRawTransaction(signedTx.serialize());
        signature = sig;
      } else {
        throw new Error('Wallet does not support transaction signing');
      }

      const confirmRes = await fetch(`/api/actions/${actionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txSignature: signature,
          signedBy: connectedWallet.address,
        }),
      });

      if (confirmRes.ok) {
        showNotification('success', `Transaction confirmed! Signature: ${signature.slice(0, 16)}...`);
        await loadActions();
      } else {
        const errorData = await confirmRes.json();
        showNotification('error', errorData.error || 'Failed to confirm transaction');
      }
    } catch (err: any) {
      console.error('Sign transaction error:', err);
      showNotification('error', err.message || 'Failed to sign transaction');
    }
  };

  const handleRefuseAction = async (actionId: string) => {
    try {
      const res = await fetch(`/api/actions/${actionId}/refuse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manually refused by user' }),
      });

      if (res.ok) {
        showNotification('success', 'Action refused');
        await loadActions();
      } else {
        showNotification('error', 'Failed to refuse action');
      }
    } catch (err) {
      console.error('Refuse action error:', err);
      showNotification('error', 'Failed to refuse action');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-950 via-surface-900 to-surface-950 text-white">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 animate-slide-up ${
          notification.type === 'success' ? 'bg-brand-600' : 'bg-danger-600'
        }`}>
          {notification.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span>{notification.message}</span>
        </div>
      )}

      <nav className="bg-surface-900/50 backdrop-blur-sm border-b border-surface-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
                IKB CopyBot Stable Pro
              </h1>
              <p className="text-sm text-surface-400">Semi-Auto Trading Assistant</p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleToggleKillSwitch}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  killSwitch
                    ? 'bg-danger-600 hover:bg-danger-700'
                    : 'bg-brand-600 hover:bg-brand-700'
                }`}
              >
                <Shield size={16} />
                {killSwitch ? 'Kill Switch ON' : 'Kill Switch OFF'}
              </button>

              {connectedWallet ? (
                <div className="bg-surface-800 px-4 py-2 rounded-lg flex items-center gap-2">
                  <Wallet size={16} className="text-brand-400" />
                  <span className="text-sm font-mono">
                    {connectedWallet.address.slice(0, 4)}...{connectedWallet.address.slice(-4)}
                  </span>
                  <span className="text-xs text-surface-400">({connectedWallet.platform})</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConnectWallet('phantom')}
                    className="px-4 py-2 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm transition-all"
                  >
                    Phantom
                  </button>
                  <button
                    onClick={() => handleConnectWallet('solflare')}
                    className="px-4 py-2 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm transition-all"
                  >
                    Solflare
                  </button>
                  <button
                    onClick={() => handleConnectWallet('metamask')}
                    className="px-4 py-2 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm transition-all"
                  >
                    MetaMask
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {walletError && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-danger-600/20 border border-danger-600 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle size={20} className="text-danger-400" />
            <span className="text-danger-200">{walletError}</span>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-surface-800/50 backdrop-blur-sm rounded-xl p-6 border border-surface-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-brand-600/20 p-3 rounded-lg">
                <Activity className="text-brand-400" size={24} />
              </div>
              <div>
                <p className="text-surface-400 text-sm">Active Actions</p>
                <p className="text-2xl font-bold">{actions.filter(a => ['PREPARED', 'TX_BUILT'].includes(a.status)).length}</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-800/50 backdrop-blur-sm rounded-xl p-6 border border-surface-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-brand-600/20 p-3 rounded-lg">
                <TrendingUp className="text-brand-400" size={24} />
              </div>
              <div>
                <p className="text-surface-400 text-sm">Live Signals</p>
                <p className="text-2xl font-bold">{signals.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-800/50 backdrop-blur-sm rounded-xl p-6 border border-surface-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-brand-600/20 p-3 rounded-lg">
                <Zap className="text-brand-400" size={24} />
              </div>
              <div>
                <p className="text-surface-400 text-sm">Strategies</p>
                <p className="text-2xl font-bold">3</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface-800/50 backdrop-blur-sm rounded-xl border border-surface-700 overflow-hidden">
          <div className="flex border-b border-surface-700">
            <button
              onClick={() => setSelectedTab('actions')}
              className={`px-6 py-4 font-medium transition-colors ${
                selectedTab === 'actions'
                  ? 'bg-surface-700 text-brand-400 border-b-2 border-brand-400'
                  : 'text-surface-400 hover:text-white'
              }`}
            >
              Actions ({actions.length})
            </button>
            <button
              onClick={() => setSelectedTab('signals')}
              className={`px-6 py-4 font-medium transition-colors ${
                selectedTab === 'signals'
                  ? 'bg-surface-700 text-brand-400 border-b-2 border-brand-400'
                  : 'text-surface-400 hover:text-white'
              }`}
            >
              Market Signals ({signals.length})
            </button>
          </div>

          <div className="p-6">
            {selectedTab === 'actions' && (
              <div className="space-y-4">
                {actions.length === 0 ? (
                  <p className="text-surface-400 text-center py-8">No actions yet. Connect your wallet and wait for signals.</p>
                ) : (
                  actions.map((action) => (
                    <div key={action.id} className="bg-surface-900/50 rounded-lg p-6 border border-surface-700">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-bold">{action.actionType}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              action.status === 'PREPARED' ? 'bg-blue-600/20 text-blue-400' :
                              action.status === 'TX_BUILT' ? 'bg-yellow-600/20 text-yellow-400' :
                              action.status === 'CONFIRMED' ? 'bg-brand-600/20 text-brand-400' :
                              action.status === 'REFUSED' ? 'bg-danger-600/20 text-danger-400' :
                              'bg-surface-700 text-surface-400'
                            }`}>
                              {action.status}
                            </span>
                          </div>
                          <p className="text-sm text-surface-400 mt-1">Strategy: {action.strategyId}</p>
                        </div>
                        <span className="text-sm text-surface-500">{action.chain}</span>
                      </div>

                      <div className="bg-surface-800 rounded-lg p-4 mb-4 font-mono text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-surface-400">Amount:</span>
                          <span>{action.amountIn}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-surface-400">Token In:</span>
                          <span className="text-xs">{action.tokenIn.slice(0, 12)}...</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-surface-400">Token Out:</span>
                          <span className="text-xs">{action.tokenOut.slice(0, 12)}...</span>
                        </div>
                        {action.expectedAmountOut && (
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-surface-400">Expected Out:</span>
                            <span>{action.expectedAmountOut}</span>
                          </div>
                        )}
                      </div>

                      {action.payload?.reasons && (
                        <div className="mb-4">
                          <p className="text-sm text-surface-400 mb-2">Reasons:</p>
                          <ul className="space-y-1">
                            {action.payload.reasons.map((reason: string, i: number) => (
                              <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                                <span className="text-brand-400">•</span>
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(action.status === 'PREPARED' || action.status === 'TX_BUILT') && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleBuildTransaction(action.id)}
                            disabled={loading || !connectedWallet}
                            className="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-700 disabled:text-surface-500 rounded-lg font-medium transition-all"
                          >
                            {loading ? 'Building...' : action.status === 'TX_BUILT' ? 'Sign Transaction' : 'Build & Sign'}
                          </button>
                          <button
                            onClick={() => handleRefuseAction(action.id)}
                            className="px-4 py-3 bg-surface-700 hover:bg-surface-600 rounded-lg font-medium transition-all"
                          >
                            Refuse
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {selectedTab === 'signals' && (
              <div className="space-y-3">
                {signals.length === 0 ? (
                  <p className="text-surface-400 text-center py-8">No signals available</p>
                ) : (
                  signals.map((token, i) => (
                    <div key={i} className="bg-surface-900/50 rounded-lg p-4 border border-surface-700 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-lg">{token.symbol}</span>
                        <span className="text-sm text-surface-400 ml-3">{token.chain}</span>
                        <p className="text-xs text-surface-500 mt-1 font-mono">{token.address.slice(0, 20)}...</p>
                      </div>
                      <div className="text-right">
                        {token.priceChange24h !== undefined && (
                          <p className={`font-bold ${token.priceChange24h >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                            {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                          </p>
                        )}
                        {token.volume24h !== undefined && (
                          <p className="text-xs text-surface-400">Vol: ${(token.volume24h / 1000).toFixed(0)}k</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="mt-12 text-center text-surface-500 text-sm border-t border-surface-800 pt-8">
          <p className="mb-2">Built with Next.js 14 App Router • TypeScript • Prisma • Tailwind CSS</p>
          <p>Semi-automatic trading with manual confirmation • No auto-execution</p>
        </footer>
      </main>
    </div>
  );
}
