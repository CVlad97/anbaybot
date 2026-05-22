import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface WalletState {
  solanaAddress: string | null;
  solanaProvider: 'phantom' | 'solflare' | null;
  evmAddress: string | null;
  evmProvider: 'metamask' | 'trust' | 'base' | null;
  setSolana: (address: string | null, provider: 'phantom' | 'solflare' | null) => void;
  setEvm: (address: string | null, provider: 'metamask' | 'trust' | 'base' | null) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      solanaAddress: null,
      solanaProvider: null,
      evmAddress: null,
      evmProvider: null,
      setSolana: (address, provider) => set({ solanaAddress: address, solanaProvider: provider }),
      setEvm: (address, provider) => set({ evmAddress: address, evmProvider: provider }),
      disconnect: () => set({ solanaAddress: null, solanaProvider: null, evmAddress: null, evmProvider: null }),
    }),
    {
      name: 'ikb-wallet-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        solanaAddress: state.solanaAddress,
        solanaProvider: state.solanaProvider,
        evmAddress: state.evmAddress,
        evmProvider: state.evmProvider,
      }),
    }
  )
);
