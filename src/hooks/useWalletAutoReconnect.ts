import { useEffect } from 'react';
import { getConnectedEvmAddress, type EvmWalletId } from '../lib/wallets/evm';
import { getConnectedSolanaAddress } from '../lib/wallets/solana';
import { useWalletStore } from '../store/walletStore';

const SOLANA_PROVIDERS = ['phantom', 'solflare'] as const;
const EVM_PROVIDERS: EvmWalletId[] = ['trust', 'metamask', 'base'];

export function useWalletAutoReconnect() {
  const { solanaProvider, evmProvider, setSolana, setEvm } = useWalletStore();

  useEffect(() => {
    let cancelled = false;

    async function reconnect() {
      const solanaCandidates = solanaProvider
        ? [solanaProvider, ...SOLANA_PROVIDERS.filter(p => p !== solanaProvider)]
        : [...SOLANA_PROVIDERS];

      for (const provider of solanaCandidates) {
        const address = await getConnectedSolanaAddress(provider);
        if (cancelled) return;
        if (address) {
          setSolana(address, provider);
          break;
        }
      }

      const evmCandidates = evmProvider
        ? [evmProvider, ...EVM_PROVIDERS.filter(p => p !== evmProvider)]
        : [...EVM_PROVIDERS];

      for (const provider of evmCandidates) {
        const address = await getConnectedEvmAddress(provider);
        if (cancelled) return;
        if (address) {
          setEvm(address, provider);
          break;
        }
      }
    }

    const retry = () => void reconnect();
    reconnect();
    const t1 = window.setTimeout(retry, 700);
    const t2 = window.setTimeout(retry, 1800);
    window.addEventListener('focus', retry);
    document.addEventListener('visibilitychange', retry);

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('focus', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  }, [evmProvider, setEvm, setSolana, solanaProvider]);
}
