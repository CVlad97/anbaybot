import { useState, useEffect } from 'react';
import { Wallet, ExternalLink, Smartphone } from 'lucide-react';

interface WalletConnectProps {
  onConnect: (publicKey: string, provider: 'phantom' | 'solflare') => void;
  onDisconnect: () => void;
  connectedWallet?: { publicKey: string; provider: 'phantom' | 'solflare' } | null;
}

export default function WalletConnect({ onConnect, onDisconnect, connectedWallet }: WalletConnectProps) {
  const [hasPhantom, setHasPhantom] = useState(false);
  const [hasSolflare, setHasSolflare] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkWallets = () => {
      setHasPhantom(!!window.solana?.isPhantom);
      setHasSolflare(!!window.solflare?.isSolflare);
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };

    checkWallets();
    const interval = setInterval(checkWallets, 500);
    setTimeout(() => clearInterval(interval), 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!window.solana && !window.solflare) return;

    const handleAccountChanged = (publicKey: any) => {
      if (publicKey) {
        const currentProvider = connectedWallet?.provider;
        if (currentProvider) {
          onConnect(publicKey.toString(), currentProvider);
        }
      } else {
        onDisconnect();
      }
    };

    if (window.solana?.on) {
      window.solana.on('accountChanged', handleAccountChanged);
    }
    if (window.solflare?.on) {
      window.solflare.on('accountChanged', handleAccountChanged);
    }

    return () => {
      if (window.solana?.removeListener) {
        window.solana.removeListener('accountChanged', handleAccountChanged);
      }
      if (window.solflare?.removeListener) {
        window.solflare.removeListener('accountChanged', handleAccountChanged);
      }
    };
  }, [connectedWallet, onConnect, onDisconnect]);

  const connectPhantom = async () => {
    setConnecting(true);
    setError(null);
    try {
      const provider = window.solana;
      if (!provider) {
        throw new Error('Phantom wallet not found');
      }
      const resp = await provider.connect();
      if (resp && resp.publicKey) {
        onConnect(resp.publicKey.toString(), 'phantom');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const connectSolflare = async () => {
    setConnecting(true);
    setError(null);
    try {
      const provider = window.solflare;
      if (!provider) {
        throw new Error('Solflare wallet not found');
      }
      const resp = await provider.connect();
      if (resp && resp.publicKey) {
        onConnect(resp.publicKey.toString(), 'solflare');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      if (connectedWallet?.provider === 'phantom' && window.solana) {
        await window.solana.disconnect();
      } else if (connectedWallet?.provider === 'solflare' && window.solflare) {
        await window.solflare.disconnect();
      }
      onDisconnect();
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  const openPhantomDeeplink = () => {
    const baseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
    const dappUrl = encodeURIComponent(baseUrl);
    window.location.href = `https://phantom.app/ul/browse/${dappUrl}?ref=${dappUrl}`;
  };

  const openSolflareDeeplink = () => {
    const baseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
    const dappUrl = encodeURIComponent(baseUrl);
    window.location.href = `https://solflare.com/ul/v1/browse/${dappUrl}?ref=${dappUrl}`;
  };

  if (connectedWallet) {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Wallet className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-green-700 font-medium capitalize">
              {connectedWallet.provider}
            </span>
            <span className="text-xs text-green-600 font-mono truncate">
              {connectedWallet.publicKey.slice(0, 4)}...{connectedWallet.publicKey.slice(-4)}
            </span>
          </div>
        </div>
        <button
          onClick={disconnect}
          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {isMobile && !hasPhantom && !hasSolflare ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 mb-3">
            Open this app in your wallet browser:
          </p>
          <button
            onClick={openPhantomDeeplink}
            className="w-full flex items-center justify-between p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5" />
              <span className="font-medium">Open in Phantom</span>
            </div>
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={openSolflareDeeplink}
            className="w-full flex items-center justify-between p-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5" />
              <span className="font-medium">Open in Solflare</span>
            </div>
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {hasPhantom && (
            <button
              onClick={connectPhantom}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-3 p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg transition-colors font-medium"
            >
              <Wallet className="w-5 h-5" />
              {connecting ? 'Connecting...' : 'Connect Phantom'}
            </button>
          )}
          {hasSolflare && (
            <button
              onClick={connectSolflare}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-3 p-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white rounded-lg transition-colors font-medium"
            >
              <Wallet className="w-5 h-5" />
              {connecting ? 'Connecting...' : 'Connect Solflare'}
            </button>
          )}
          {!hasPhantom && !hasSolflare && !isMobile && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 mb-3">
                No Solana wallet detected. Please install:
              </p>
              <div className="flex gap-2">
                <a
                  href="https://phantom.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 p-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md transition-colors"
                >
                  Phantom
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href="https://solflare.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 p-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-md transition-colors"
                >
                  Solflare
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
