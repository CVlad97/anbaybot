import { useEffect } from 'react';
import {
  getConnectedEvmAddress,
  getConnectedEvmAddresses,
  type EvmWalletId,
} from '../lib/wallets/evm';
import { getConnectedSolanaAddress } from '../lib/wallets/solana';
import { useWalletStore } from '../store/walletStore';
import { api } from '../lib/api';
import { getAdminToken } from '../lib/auth';

const SOLANA_PROVIDERS = ['phantom', 'solflare'] as const;
const EVM_PROVIDERS: EvmWalletId[] = ['best', 'trust', 'metamask', 'base'];

async function syncBestWallets(addresses: string[]) {
  if (!addresses.length || !getAdminToken()) return;
  try {
    const response = await api.getManagedWallets();
    const existing = Array.isArray(response.data) ? response.data : [];
    const rows = existing.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');

    for (const [index, address] of addresses.entries()) {
      for (const chain of ['eth', 'base'] as const) {
        const found = rows.some(row =>
          String(row.address || '').toLowerCase() === address.toLowerCase()
          && String(row.chain || '').toLowerCase() === chain
          && String(row.platform || '').toUpperCase() === 'BEST'
        );
        if (found) continue;
        await api.createManagedWallet({
          chain,
          label: `Best Wallet ${index + 1} / ${chain === 'eth' ? 'Ethereum' : 'Base'}`,
          address,
          platform: 'BEST',
          enabled: true,
        });
      }
    }
  } catch {
    // Read-only browser reconnect stays active even when admin sync is unavailable.
  }
}

export function useWalletAutoReconnect() {
  const {
    solanaProvider,
    evmProvider,
    setSolana,
    setEvm,
    setBestAddresses,
  } = useWalletStore();

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
        if (provider === 'best') {
          const addresses = await getConnectedEvmAddresses('best');
          if (cancelled) return;
          if (addresses.length) {
            setBestAddresses(addresses);
            setEvm(addresses[0], 'best');
            void syncBestWallets(addresses);
            break;
          }
          continue;
        }

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
  }, [evmProvider, setBestAddresses, setEvm, setSolana, solanaProvider]);
}
