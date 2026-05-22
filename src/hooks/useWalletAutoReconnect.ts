import { useEffect } from 'react';
import { getConnectedEvmAddress } from '../lib/wallets/evm';
import { getConnectedSolanaAddress } from '../lib/wallets/solana';
import { useWalletStore } from '../store/walletStore';

export function useWalletAutoReconnect() {
  const { solanaProvider, evmProvider, setSolana, setEvm } = useWalletStore();

  useEffect(() => {
    let cancelled = false;

    async function reconnect() {
      if (solanaProvider) {
        const solanaAddress = await getConnectedSolanaAddress(solanaProvider);
        if (!cancelled) {
          if (solanaAddress) setSolana(solanaAddress, solanaProvider);
          else setSolana(null, null);
        }
      }

      if (evmProvider) {
        const evmAddress = await getConnectedEvmAddress(evmProvider);
        if (!cancelled) {
          if (evmAddress) setEvm(evmAddress, evmProvider);
          else setEvm(null, null);
        }
      }
    }

    reconnect();
    return () => {
      cancelled = true;
    };
  }, [evmProvider, setEvm, setSolana, solanaProvider]);
}
