import { useCallback, useEffect, useRef, useState } from 'react';
import { publicApi } from '../lib/publicApi';

export interface TraderAddress {
  id: string;
  address: string;
  chain: 'solana' | 'ethereum' | 'base' | 'arbitrum';
  label?: string;
  isActive: boolean;
  profitLoss?: number;
  winRate?: number;
}

export interface OrchestrationMetrics {
  portfolioValue: number;
  totalPnL: number;
  winRate: number;
  tradesExecuted: number;
  activeWallets: number;
  circuitBreakerStatus: 'active' | 'tripped' | 'cooldown';
}

export interface SentimentData {
  score: number;
  label: 'bearish' | 'neutral' | 'bullish';
  confidence: number;
  exposure: number;
  lastUpdated: number;
}

export interface OrchestratorEvent {
  time: string;
  type: 'analysis' | 'trade' | 'warning' | 'rebalance' | 'info';
  message: string;
}

const EMPTY_METRICS: OrchestrationMetrics = {
  portfolioValue: 0,
  totalPnL: 0,
  winRate: 0,
  tradesExecuted: 0,
  activeWallets: 0,
  circuitBreakerStatus: 'active',
};

const UNAVAILABLE_SENTIMENT: SentimentData = {
  score: 0.5,
  label: 'neutral',
  confidence: 0,
  exposure: 0,
  lastUpdated: 0,
};

export function useOrchestration() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [traders, setTraders] = useState<TraderAddress[]>([]);
  const [metrics, setMetrics] = useState<OrchestrationMetrics>(EMPTY_METRICS);
  const [sentiment, setSentiment] = useState<SentimentData>(UNAVAILABLE_SENTIMENT);
  const [events, setEvents] = useState<OrchestratorEvent[]>([]);
  const [config, setConfig] = useState({
    aiEnabled: false,
    circuitBreakerEnabled: true,
    tradfiEnabled: false,
    autoRebalance: false,
  });

  const addEvent = useCallback((type: OrchestratorEvent['type'], message: string) => {
    const time = new Date().toLocaleTimeString('fr-FR', { hour12: false, hour: '2-digit', minute: '2-digit' });
    setEvents(prev => [{ time, type, message }, ...prev].slice(0, 50));
  }, []);

  const refreshRealMetrics = useCallback(async () => {
    try {
      const [portfolio, pnl] = await Promise.all([publicApi.portfolio(), publicApi.pnl()]);
      const total = Number(portfolio.totalValueUsd || 0);
      const net = Number(pnl.totalNetPnlUsd || 0);
      setMetrics({
        portfolioValue: total,
        totalPnL: total > 0 ? (net / total) * 100 : 0,
        winRate: 0,
        tradesExecuted: pnl.count,
        activeWallets: portfolio.wallets.length,
        circuitBreakerStatus: 'active',
      });
      addEvent('info', `Données LIVE actualisées : ${portfolio.wallets.length} wallets, P&L ${net.toFixed(2)} USD`);
    } catch (error) {
      addEvent('warning', error instanceof Error ? error.message : 'Données LIVE indisponibles');
    }
  }, [addEvent]);

  const loadTraders = useCallback(async () => {
    setTraders([]);
    addEvent('info', 'Aucun trader source LIVE vérifié : aucun profil démo injecté.');
    return [] as TraderAddress[];
  }, [addEvent]);

  const runAIAnalysis = useCallback(async () => {
    setSentiment({ ...UNAVAILABLE_SENTIMENT, lastUpdated: Date.now() });
    addEvent('analysis', 'Analyse IA LIVE non connectée : aucun score aléatoire généré.');
  }, [addEvent]);

  const autoCorrectAddresses = useCallback(async (addresses: TraderAddress[]) => {
    return addresses.map(trader => {
      const solanaOk = trader.chain === 'solana' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trader.address);
      const evmOk = ['ethereum', 'base', 'arbitrum'].includes(trader.chain) && /^0x[a-fA-F0-9]{40}$/.test(trader.address);
      return solanaOk || evmOk ? trader : { ...trader, isActive: false };
    });
  }, []);

  const startOrchestrator = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(true);
    addEvent('info', 'Monitoring LIVE démarré. Aucune transaction automatique.');
    await refreshRealMetrics();
    await loadTraders();
    intervalRef.current = setInterval(() => { void refreshRealMetrics(); }, 60_000);
  }, [addEvent, loadTraders, refreshRealMetrics]);

  const stopOrchestrator = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsRunning(false);
    addEvent('warning', 'Monitoring arrêté');
  }, [addEvent]);

  const toggleFeature = useCallback((feature: keyof typeof config) => {
    setConfig(prev => {
      const next = { ...prev, [feature]: !prev[feature] };
      addEvent('info', `${feature}: ${next[feature] ? 'activé localement' : 'désactivé localement'} — aucune permission LIVE modifiée.`);
      return next;
    });
  }, [addEvent]);

  useEffect(() => {
    void refreshRealMetrics();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshRealMetrics]);

  return {
    isRunning,
    traders,
    metrics,
    sentiment,
    events,
    config,
    startOrchestrator,
    stopOrchestrator,
    toggleFeature,
    runAIAnalysis,
    loadTraders,
    autoCorrectAddresses,
  };
}
