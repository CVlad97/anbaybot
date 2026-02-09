import { create } from 'zustand';
import type {
  Settings, Action, Signal, AuditLog, ManagedWallet, FollowedWallet,
  Transaction, WalletBalanceData, PortfolioSnapshot, AutoTradeConfig, AIConfig,
} from '../lib/types';

interface AppState {
  settings: Settings | null;
  actions: Action[];
  signals: Signal[];
  auditLogs: AuditLog[];
  managedWallets: ManagedWallet[];
  followedWallets: FollowedWallet[];
  transactions: Transaction[];
  enabledStrategies: string[];
  loading: boolean;
  walletBalances: WalletBalanceData[];
  portfolioHistory: PortfolioSnapshot[];
  totalValueUsd: number;
  pnlUsd: number;
  pnlPct: number;
  prices: { sol: number; eth: number };
  autoTradeConfigs: AutoTradeConfig[];
  aiConfig: AIConfig | null;

  setSettings: (s: Settings) => void;
  setActions: (a: Action[]) => void;
  setSignals: (s: Signal[]) => void;
  setAuditLogs: (l: AuditLog[]) => void;
  setManagedWallets: (w: ManagedWallet[]) => void;
  setFollowedWallets: (w: FollowedWallet[]) => void;
  setTransactions: (t: Transaction[]) => void;
  setEnabledStrategies: (ids: string[]) => void;
  setLoading: (l: boolean) => void;
  setWalletBalances: (b: WalletBalanceData[]) => void;
  setPortfolioData: (data: { totalValueUsd: number; pnlUsd: number; pnlPct: number; prices: { sol: number; eth: number } }) => void;
  setPortfolioHistory: (h: PortfolioSnapshot[]) => void;
  setAutoTradeConfigs: (c: AutoTradeConfig[]) => void;
  setAIConfig: (c: AIConfig | null) => void;
  addAuditLog: (event: string, meta?: Record<string, unknown>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: null,
  actions: [],
  signals: [],
  auditLogs: [],
  managedWallets: [],
  followedWallets: [],
  transactions: [],
  enabledStrategies: ['copy_swap_filtered', 'momentum_dex', 'defensive_exit', 'payout_150_eur'],
  loading: false,
  walletBalances: [],
  portfolioHistory: [],
  totalValueUsd: 0,
  pnlUsd: 0,
  pnlPct: 0,
  prices: { sol: 0, eth: 0 },
  autoTradeConfigs: [],
  aiConfig: null,

  setSettings: (s) => set({ settings: s }),
  setActions: (a) => set({ actions: a }),
  setSignals: (s) => set({ signals: s }),
  setAuditLogs: (l) => set({ auditLogs: l }),
  setManagedWallets: (w) => set({ managedWallets: w }),
  setFollowedWallets: (w) => set({ followedWallets: w }),
  setTransactions: (t) => set({ transactions: t }),
  setEnabledStrategies: (ids) => set({ enabledStrategies: ids }),
  setLoading: (l) => set({ loading: l }),
  setWalletBalances: (b) => set({ walletBalances: b }),
  setPortfolioData: (data) => set({
    totalValueUsd: data.totalValueUsd,
    pnlUsd: data.pnlUsd,
    pnlPct: data.pnlPct,
    prices: data.prices,
  }),
  setPortfolioHistory: (h) => set({ portfolioHistory: h }),
  setAutoTradeConfigs: (c) => set({ autoTradeConfigs: c }),
  setAIConfig: (c) => set({ aiConfig: c }),
  addAuditLog: (event, meta = {}) => {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      event,
      meta,
      created_at: new Date().toISOString(),
    };
    set({ auditLogs: [log, ...get().auditLogs].slice(0, 200) });
  },
}));
