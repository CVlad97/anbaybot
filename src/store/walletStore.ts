import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type SolanaWalletProvider = 'phantom' | 'solflare';
type EvmWalletProvider = 'metamask' | 'trust' | 'base' | 'best';

interface WalletState {
  solanaAddress: string | null;
  solanaProvider: SolanaWalletProvider | null;
  evmAddress: string | null;
  evmProvider: EvmWalletProvider | null;
  bestAddresses: string[];
  setSolana: (address: string | null, provider: SolanaWalletProvider | null) => void;
  setEvm: (address: string | null, provider: EvmWalletProvider | null) => void;
  setBestAddresses: (addresses: string[]) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      solanaAddress: null,
      solanaProvider: null,
      evmAddress: null,
      evmProvider: null,
      bestAddresses: [],
      setSolana: (address, provider) => set({ solanaAddress: address, solanaProvider: provider }),
      setEvm: (address, provider) => set({ evmAddress: address, evmProvider: provider }),
      setBestAddresses: (addresses) => set({ bestAddresses: Array.from(new Set(addresses.filter(Boolean))) }),
      disconnect: () => set({
        solanaAddress: null,
        solanaProvider: null,
        evmAddress: null,
        evmProvider: null,
        bestAddresses: [],
      }),
    }),
    {
      name: 'ikb-wallet-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        solanaAddress: state.solanaAddress,
        solanaProvider: state.solanaProvider,
        evmAddress: state.evmAddress,
        evmProvider: state.evmProvider,
        bestAddresses: state.bestAddresses,
      }),
    }
  )
);
