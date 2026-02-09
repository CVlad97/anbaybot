export { MultiWalletManager, createMultiWalletManager } from './multiWalletManager';
export type { WalletBalance, AggregatedPortfolio } from './multiWalletManager';

export { JitoBundleExecutor, createJitoBundleExecutor } from './jitoBundle';
export type { BundleTransaction, BundleResult } from './jitoBundle';

export { AISentimentAnalyzer, createAISentimentAnalyzer } from './aiSentiment';
export type {
  MarketSentiment,
  SentimentFactor,
  StrategyAdjustment,
  AIAnalysisResult,
} from './aiSentiment';

export { AlpacaBridge, createAlpacaBridge } from './alpacaBridge';
export type {
  AlpacaConfig,
  StockPosition,
  AlpacaOrder,
  DiversificationStrategy,
} from './alpacaBridge';

export { CircuitBreaker, createCircuitBreaker } from './circuitBreaker';
export type {
  CircuitBreakerConfig,
  RiskMetrics,
  CircuitBreakerState,
  CircuitBreakerEvent,
} from './circuitBreaker';

export { TradingOrchestrator, createTradingOrchestrator } from './orchestrator';
export type {
  OrchestratorConfig,
  OrchestratorState,
  OrchestratorEvent,
} from './orchestrator';
