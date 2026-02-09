import { MultiWalletManager, AggregatedPortfolio } from './multiWalletManager';
import { AISentimentAnalyzer, AIAnalysisResult } from './aiSentiment';
import { AlpacaBridge, DiversificationStrategy } from './alpacaBridge';
import { CircuitBreaker, CircuitBreakerEvent } from './circuitBreaker';

export interface OrchestratorConfig {
  enableAI: boolean;
  enableCircuitBreaker: boolean;
  enableTradFiDiversification: boolean;
  autoRebalance: boolean;
  rebalanceIntervalMinutes: number;
  aiAnalysisIntervalMinutes: number;
}

export interface OrchestratorState {
  isRunning: boolean;
  lastAIAnalysis: AIAnalysisResult | null;
  lastRebalance: number | null;
  portfolio: AggregatedPortfolio | null;
  circuitBreakerTripped: boolean;
  totalProfitUsd: number;
  stats: {
    tradesExecuted: number;
    profitableTrades: number;
    lossTrades: number;
    winRate: number;
    totalPnL: number;
  };
}

export type OrchestratorEvent =
  | { type: 'analysis_complete'; data: AIAnalysisResult }
  | { type: 'rebalance_complete'; success: boolean; message: string }
  | { type: 'circuit_breaker'; event: CircuitBreakerEvent }
  | { type: 'portfolio_update'; portfolio: AggregatedPortfolio }
  | { type: 'error'; error: string };

export class TradingOrchestrator {
  private config: OrchestratorConfig;
  private state: OrchestratorState;
  private aiAnalyzer: AISentimentAnalyzer | null = null;
  private alpacaBridge: AlpacaBridge | null = null;
  private circuitBreaker: CircuitBreaker | null = null;
  private intervals: NodeJS.Timeout[] = [];
  private eventListeners: Set<(event: OrchestratorEvent) => void> = new Set();

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.state = {
      isRunning: false,
      lastAIAnalysis: null,
      lastRebalance: null,
      portfolio: null,
      circuitBreakerTripped: false,
      totalProfitUsd: 0,
      stats: {
        tradesExecuted: 0,
        profitableTrades: 0,
        lossTrades: 0,
        winRate: 0,
        totalPnL: 0,
      },
    };
  }

  async initialize(
    _walletManager: MultiWalletManager,
    aiAnalyzer?: AISentimentAnalyzer,
    alpacaBridge?: AlpacaBridge,
    circuitBreaker?: CircuitBreaker
  ): Promise<void> {
    if (this.config.enableAI && aiAnalyzer) {
      this.aiAnalyzer = aiAnalyzer;
    }

    if (this.config.enableTradFiDiversification && alpacaBridge) {
      this.alpacaBridge = alpacaBridge;
    }

    if (this.config.enableCircuitBreaker && circuitBreaker) {
      this.circuitBreaker = circuitBreaker;

      this.circuitBreaker.subscribe((event) => {
        this.state.circuitBreakerTripped = event.type === 'tripped';
        this.notifyListeners({ type: 'circuit_breaker', event });
      });
    }

    console.log('Trading orchestrator initialized');
  }

  async start(): Promise<void> {
    if (this.state.isRunning) {
      console.log('Orchestrator already running');
      return;
    }

    this.state.isRunning = true;
    console.log('Starting trading orchestrator...');

    if (this.config.enableAI && this.aiAnalyzer) {
      const aiInterval = setInterval(
        () => this.runAIAnalysis(),
        this.config.aiAnalysisIntervalMinutes * 60 * 1000
      );
      this.intervals.push(aiInterval);

      await this.runAIAnalysis();
    }

    if (this.config.autoRebalance && this.alpacaBridge) {
      const rebalanceInterval = setInterval(
        () => this.runRebalance(),
        this.config.rebalanceIntervalMinutes * 60 * 1000
      );
      this.intervals.push(rebalanceInterval);
    }

    console.log('✅ Trading orchestrator started');
  }

  async stop(): Promise<void> {
    this.state.isRunning = false;

    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];

    console.log('Trading orchestrator stopped');
  }

  private async runAIAnalysis(): Promise<void> {
    if (!this.aiAnalyzer || !this.state.portfolio) {
      return;
    }

    try {
      const marketData = `Portfolio Value: $${this.state.portfolio.totalBalanceUsd.toFixed(2)}
Wallets: ${this.state.portfolio.wallets.length}
Recent P&L: ${this.state.stats.totalPnL.toFixed(2)}%`;

      const analysis = await this.aiAnalyzer.analyzeMarketSentiment(
        marketData,
        this.state.portfolio.totalBalanceUsd,
        this.state.stats.totalPnL
      );

      this.state.lastAIAnalysis = analysis;

      this.notifyListeners({ type: 'analysis_complete', data: analysis });

      console.log(
        `AI Analysis: ${analysis.sentiment.label} (score: ${analysis.sentiment.score.toFixed(2)})`
      );
      console.log(`Recommended exposure: ${analysis.adjustment.recommendedExposure}%`);
    } catch (error) {
      console.error('AI analysis failed:', error);
      this.notifyListeners({
        type: 'error',
        error: `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      });
    }
  }

  private async runRebalance(): Promise<void> {
    if (!this.alpacaBridge || !this.state.portfolio) {
      return;
    }

    try {
      const strategy: DiversificationStrategy = {
        cryptoAllocation: 70,
        stockAllocation: 30,
        targetSymbols: ['SPY', 'QQQ', 'BND'],
        rebalanceThreshold: 5,
      };

      const result = await this.alpacaBridge.rebalancePortfolio(
        strategy,
        this.state.portfolio.totalBalanceUsd
      );

      this.state.lastRebalance = Date.now();

      this.notifyListeners({
        type: 'rebalance_complete',
        success: result.executed,
        message: result.message,
      });

      console.log(`Rebalance: ${result.message}`);
    } catch (error) {
      console.error('Rebalance failed:', error);
      this.notifyListeners({
        type: 'error',
        error: `Rebalance failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      });
    }
  }

  async updatePortfolio(portfolio: AggregatedPortfolio): Promise<void> {
    this.state.portfolio = portfolio;

    if (this.circuitBreaker) {
      const check = await this.circuitBreaker.checkRiskLimits(
        portfolio.totalBalanceUsd
      );

      if (!check.allowed) {
        console.warn(`Trading blocked: ${check.reason}`);
      }
    }

    this.notifyListeners({ type: 'portfolio_update', portfolio });
  }

  recordTrade(profitUsd: number): void {
    this.state.stats.tradesExecuted++;

    if (profitUsd > 0) {
      this.state.stats.profitableTrades++;
      this.state.totalProfitUsd += profitUsd;
    } else {
      this.state.stats.lossTrades++;
    }

    this.state.stats.winRate =
      this.state.stats.tradesExecuted > 0
        ? (this.state.stats.profitableTrades / this.state.stats.tradesExecuted) * 100
        : 0;

    this.state.stats.totalPnL += profitUsd;

    if (this.circuitBreaker) {
      this.circuitBreaker.checkRiskLimits(this.state.totalProfitUsd, {
        profit: profitUsd,
        timestamp: Date.now(),
      });
    }
  }

  getState(): OrchestratorState {
    return { ...this.state };
  }

  getRecommendedPositionSize(baseSize: number): number {
    if (!this.state.lastAIAnalysis) {
      return baseSize;
    }

    const { sentiment, adjustment } = this.state.lastAIAnalysis;

    return (
      baseSize * adjustment.positionSizeMultiplier * sentiment.confidence
    );
  }

  subscribe(callback: (event: OrchestratorEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  private notifyListeners(event: OrchestratorEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }
}

export const createTradingOrchestrator = (
  config?: Partial<OrchestratorConfig>
) => {
  const defaultConfig: OrchestratorConfig = {
    enableAI: true,
    enableCircuitBreaker: true,
    enableTradFiDiversification: false,
    autoRebalance: false,
    rebalanceIntervalMinutes: 1440,
    aiAnalysisIntervalMinutes: 60,
    ...config,
  };

  return new TradingOrchestrator(defaultConfig);
};
