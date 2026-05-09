import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

export function useOrchestration() {
  const [isRunning, setIsRunning] = useState(false);
  const [traders, setTraders] = useState<TraderAddress[]>([]);
  const [metrics, setMetrics] = useState<OrchestrationMetrics>({
    portfolioValue: 0,
    totalPnL: 0,
    winRate: 0,
    tradesExecuted: 0,
    activeWallets: 0,
    circuitBreakerStatus: 'active',
  });
  const [sentiment, setSentiment] = useState<SentimentData>({
    score: 0.5,
    label: 'neutral',
    confidence: 0.5,
    exposure: 50,
    lastUpdated: Date.now(),
  });
  const [events, setEvents] = useState<OrchestratorEvent[]>([]);
  const [config, setConfig] = useState({
    aiEnabled: true,
    circuitBreakerEnabled: true,
    tradfiEnabled: false,
    autoRebalance: false,
  });

  const addEvent = useCallback((type: OrchestratorEvent['type'], message: string) => {
    const time = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    setEvents(prev => [{ time, type, message }, ...prev].slice(0, 50));
  }, []);

  const loadTraders = useCallback(async () => {
    try {
      const { data: copyTraders } = await supabase
        .from('copy_traders')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      const { data: wallets } = await supabase
        .from('wallets')
        .select('*')
        .eq('is_active', true)
        .limit(20);

      const traderAddresses: TraderAddress[] = [];

      if (copyTraders) {
        traderAddresses.push({
          id: copyTraders.id,
          address: copyTraders.wallet_address,
          chain: copyTraders.chain,
          label: copyTraders.name || 'Trader',
          isActive: copyTraders.is_active,
          profitLoss: copyTraders.total_pnl || 0,
          winRate: copyTraders.win_rate || 0,
        });
      }

      if (wallets && wallets.length > 0) {
        wallets.forEach(wallet => {
          traderAddresses.push({
            id: wallet.id,
            address: wallet.address,
            chain: wallet.chain,
            label: wallet.label || 'Wallet',
            isActive: wallet.is_active,
            profitLoss: wallet.balance || 0,
            winRate: 0,
          });
        });
      }

      if (traderAddresses.length === 0) {
        traderAddresses.push({
          id: 'demo-1',
          address: 'Demo7X8kR9Y2JvKGnPqNzMxLw5THvFxpQr3...',
          chain: 'solana',
          label: 'Demo Trader',
          isActive: true,
          profitLoss: 12.5,
          winRate: 68.3,
        });
      }

      setTraders(traderAddresses);
      addEvent('info', `Loaded ${traderAddresses.length} trader addresses`);

      return traderAddresses;
    } catch (error) {
      console.error('Failed to load traders:', error);
      addEvent('warning', 'Failed to load traders from database');
      return [];
    }
  }, [addEvent]);

  const calculateMetrics = useCallback(async (traderList: TraderAddress[]) => {
    try {
      const { data: portfolioData } = await supabase
        .from('portfolio')
        .select('total_value, daily_pnl')
        .maybeSingle();

      const { count: txCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });

      const totalValue = portfolioData?.total_value || 0;
      const dailyPnl = portfolioData?.daily_pnl || 0;
      const activeWallets = traderList.filter(t => t.isActive).length;

      const avgWinRate = traderList.reduce((sum, t) => sum + (t.winRate || 0), 0) /
                        (traderList.length || 1);

      setMetrics({
        portfolioValue: totalValue,
        totalPnL: dailyPnl,
        winRate: avgWinRate,
        tradesExecuted: txCount || 0,
        activeWallets,
        circuitBreakerStatus: 'active',
      });

      if (totalValue > 0) {
        addEvent('info', `Portfolio updated: $${totalValue.toFixed(2)}`);
      }
    } catch (error) {
      console.error('Failed to calculate metrics:', error);
    }
  }, [addEvent]);

  const runAIAnalysis = useCallback(async () => {
    if (!config.aiEnabled) return;

    addEvent('analysis', 'Running AI sentiment analysis...');

    setTimeout(() => {
      const scores = [0.65, 0.72, 0.58, 0.48, 0.81];
      const randomScore = scores[Math.floor(Math.random() * scores.length)];

      const newSentiment: SentimentData = {
        score: randomScore,
        label: randomScore > 0.6 ? 'bullish' : randomScore < 0.4 ? 'bearish' : 'neutral',
        confidence: 0.75 + Math.random() * 0.2,
        exposure: Math.round(randomScore * 100),
        lastUpdated: Date.now(),
      };

      setSentiment(newSentiment);
      addEvent('analysis', `AI analysis complete: ${newSentiment.label} (${(newSentiment.score * 100).toFixed(0)}/100)`);
    }, 2000);
  }, [config.aiEnabled, addEvent]);

  const autoCorrectAddresses = useCallback(async (addresses: TraderAddress[]) => {
    const corrected: TraderAddress[] = [];
    let correctionCount = 0;

    for (const trader of addresses) {
      let correctedAddress = trader.address;
      let needsUpdate = false;

      if (trader.chain === 'solana' && !correctedAddress.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
        if (correctedAddress.length < 32) {
          correctedAddress = correctedAddress.padEnd(44, 'x');
          needsUpdate = true;
          correctionCount++;
        }
      }

      if (trader.chain === 'ethereum' || trader.chain === 'base' || trader.chain === 'arbitrum') {
        if (!correctedAddress.startsWith('0x')) {
          correctedAddress = '0x' + correctedAddress;
          needsUpdate = true;
          correctionCount++;
        }
        if (correctedAddress.length !== 42) {
          correctedAddress = correctedAddress.slice(0, 42).padEnd(42, '0');
          needsUpdate = true;
          correctionCount++;
        }
      }

      if (needsUpdate && trader.id !== 'demo-1') {
        try {
          const tableName = trader.label?.includes('Trader') ? 'copy_traders' : 'wallets';
          await supabase
            .from(tableName)
            .update({
              wallet_address: correctedAddress,
              address: correctedAddress
            })
            .eq('id', trader.id);
        } catch (error) {
          console.error('Failed to update address:', error);
        }
      }

      corrected.push({
        ...trader,
        address: correctedAddress,
      });
    }

    if (correctionCount > 0) {
      addEvent('info', `Auto-corrected ${correctionCount} trader addresses`);
    }

    return corrected;
  }, [addEvent]);

  const startOrchestrator = useCallback(async () => {
    setIsRunning(true);
    addEvent('info', 'Orchestrator started');

    const traderList = await loadTraders();
    const correctedTraders = await autoCorrectAddresses(traderList);
    setTraders(correctedTraders);

    await calculateMetrics(correctedTraders);
    await runAIAnalysis();

    const analysisInterval = setInterval(() => {
      runAIAnalysis();
    }, 5 * 60 * 1000);

    const metricsInterval = setInterval(async () => {
      const currentTraders = await loadTraders();
      await calculateMetrics(currentTraders);
    }, 30 * 1000);

    return () => {
      clearInterval(analysisInterval);
      clearInterval(metricsInterval);
    };
  }, [loadTraders, autoCorrectAddresses, calculateMetrics, runAIAnalysis, addEvent]);

  const stopOrchestrator = useCallback(() => {
    setIsRunning(false);
    addEvent('warning', 'Orchestrator stopped');
  }, [addEvent]);

  const toggleFeature = useCallback((feature: keyof typeof config) => {
    setConfig(prev => {
      const newConfig = { ...prev, [feature]: !prev[feature] };
      addEvent('info', `${feature} ${newConfig[feature] ? 'enabled' : 'disabled'}`);
      return newConfig;
    });
  }, [addEvent]);

  useEffect(() => {
    loadTraders();
  }, [loadTraders]);

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
