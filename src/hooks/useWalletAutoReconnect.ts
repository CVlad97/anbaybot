import { useEffect } from 'react';
import { getConnectedEvmAddress } from '../lib/wallets/evm';
import { getConnectedSolanaAddress } from '../lib/wallets/solana';
import { useWalletStore } from '../store/walletStore';
import { api } from '../lib/api';

async function syncWallet(body: Record<string, unknown>) {
  try {
    await api.createManagedWallet(body);
  } catch {
    // Private backend requires the cockpit token. Wallet remains connected locally
    // and will sync automatically on the next reconnect after token activation.
  }
}

export function useWalletAutoReconnect() {
  const { solanaProvider, evmProvider, setSolana, setEvm } = useWalletStore();

  useEffect(() => {
    let cancelled = false;

    async function reconnect() {
      if (solanaProvider) {
        const solanaAddress = await getConnectedSolanaAddress(solanaProvider);
        if (!cancelled) {
          if (solanaAddress) {
            setSolana(solanaAddress, solanaProvider);
            await syncWallet({
              chain: 'solana',
              label: `${solanaProvider === 'phantom' ? 'Phantom' : 'Solflare'} / Solana`,
              address: solanaAddress,
              platform: solanaProvider.toUpperCase(),
              enabled: true,
            });
          } else setSolana(null, null);
        }
      }

      if (evmProvider) {
        const evmAddress = await getConnectedEvmAddress(evmProvider);
        if (!cancelled) {
          if (evmAddress) {
            setEvm(evmAddress, evmProvider);
            const platform = evmProvider === 'trust' ? 'TRUST_WALLET' : evmProvider.toUpperCase();
            await Promise.all([
              syncWallet({ chain: 'base', label: `${evmProvider} / Base`, address: evmAddress, platform, enabled: true }),
              syncWallet({ chain: 'eth', label: `${evmProvider} / Ethereum`, address: evmAddress, platform, enabled: true }),
            ]);
          } else setEvm(null, null);
        }
      }
    }

    reconnect();
    return () => {
      cancelled = true;
    };
  }, [evmProvider, setEvm, setSolana, solanaProvider]);
}
