export interface CircuitBreakerConfig {
  maxDrawdownPct: number;
  maxDailyLossPct: number;
  maxConsecutiveLosses: number;
  cooldownMinutes: number;
  autoRecovery: boolean;
}

export interface RiskMetrics {
  currentDrawdown: number;
  dailyLoss: number;
  consecutiveLosses: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface CircuitBreakerState {
  isTripped: boolean;
  reason: string;
  trippedAt: number | null;
  cooldownEndsAt: number | null;
  metrics: RiskMetrics;
}

export type CircuitBreakerEvent =
  | { type: 'tripped'; reason: string; timestamp: number }
  | { type: 'reset'; timestamp: number }
  | { type: 'warning'; reason: string; timestamp: number };

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private tradeHistory: Array<{ profit: number; timestamp: number }> = [];
  private peakValue: number = 0;
  private dailyStartValue: number = 0;
  private dailyStartTime: number = 0;
  private eventListeners: Set<(event: CircuitBreakerEvent) => void> = new Set();

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.state = {
      isTripped: false,
      reason: '',
      trippedAt: null,
      cooldownEndsAt: null,
      metrics: {
        currentDrawdown: 0,
        dailyLoss: 0,
        consecutiveLosses: 0,
        volatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
      },
    };
  }

  async checkRiskLimits(
    currentValue: number,
    newTrade?: { profit: number; timestamp: number }
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (newTrade) {
      this.tradeHistory.push(newTrade);
      this.pruneOldTrades();
    }

    this.updateMetrics(currentValue);

    if (this.state.isTripped) {
      if (this.state.cooldownEndsAt && Date.now() > this.state.cooldownEndsAt) {
        if (this.config.autoRecovery) {
          this.reset();
          this.notifyListeners({ type: 'reset', timestamp: Date.now() });
        } else {
          return {
            allowed: false,
            reason: 'Circuit breaker tripped. Manual reset required.',
          };
        }
      } else {
        return {
          allowed: false,
          reason: `Circuit breaker in cooldown until ${new Date(
            this.state.cooldownEndsAt || 0
          ).toLocaleTimeString()}`,
        };
      }
    }

    if (this.state.metrics.currentDrawdown > this.config.maxDrawdownPct) {
      this.trip(`Maximum drawdown exceeded: ${this.state.metrics.currentDrawdown.toFixed(2)}%`);
      return { allowed: false, reason: this.state.reason };
    }

    if (this.state.metrics.dailyLoss > this.config.maxDailyLossPct) {
      this.trip(`Daily loss limit exceeded: ${this.state.metrics.dailyLoss.toFixed(2)}%`);
      return { allowed: false, reason: this.state.reason };
    }

    if (this.state.metrics.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.trip(`Too many consecutive losses: ${this.state.metrics.consecutiveLosses}`);
      return { allowed: false, reason: this.state.reason };
    }

    if (this.state.metrics.currentDrawdown > this.config.maxDrawdownPct * 0.8) {
      this.notifyListeners({
        type: 'warning',
        reason: `Approaching drawdown limit: ${this.state.metrics.currentDrawdown.toFixed(2)}%`,
        timestamp: Date.now(),
      });
    }

    return { allowed: true };
  }

  private updateMetrics(currentValue: number): void {
    if (this.peakValue === 0) {
      this.peakValue = currentValue;
      this.dailyStartValue = currentValue;
      this.dailyStartTime = Date.now();
    }

    if (currentValue > this.peakValue) {
      this.peakValue = currentValue;
    }

    this.state.metrics.currentDrawdown =
      ((this.peakValue - currentValue) / this.peakValue) * 100;

    if (this.state.metrics.currentDrawdown > this.state.metrics.maxDrawdown) {
      this.state.metrics.maxDrawdown = this.state.metrics.currentDrawdown;
    }

    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    if (now - this.dailyStartTime > dayInMs) {
      this.dailyStartValue = currentValue;
      this.dailyStartTime = now;
    }

    this.state.metrics.dailyLoss =
      ((this.dailyStartValue - currentValue) / this.dailyStartValue) * 100;

    const recentTrades = this.tradeHistory.slice(-20);
    let consecutiveLosses = 0;
    for (let i = recentTrades.length - 1; i >= 0; i--) {
      if (recentTrades[i].profit < 0) {
        consecutiveLosses++;
      } else {
        break;
      }
    }
    this.state.metrics.consecutiveLosses = consecutiveLosses;

    if (recentTrades.length > 1) {
      const returns = recentTrades.map((t) => t.profit);
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance =
        returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      this.state.metrics.volatility = Math.sqrt(variance);

      if (this.state.metrics.volatility > 0) {
        this.state.metrics.sharpeRatio = mean / this.state.metrics.volatility;
      }
    }
  }

  private trip(reason: string): void {
    this.state.isTripped = true;
    this.state.reason = reason;
    this.state.trippedAt = Date.now();
    this.state.cooldownEndsAt =
      Date.now() + this.config.cooldownMinutes * 60 * 1000;

    console.error(`🔴 CIRCUIT BREAKER TRIPPED: ${reason}`);

    this.notifyListeners({
      type: 'tripped',
      reason,
      timestamp: Date.now(),
    });
  }

  reset(): void {
    this.state.isTripped = false;
    this.state.reason = '';
    this.state.trippedAt = null;
    this.state.cooldownEndsAt = null;
    this.state.metrics.consecutiveLosses = 0;

    console.log('✅ Circuit breaker reset');
  }

  resetMetrics(): void {
    this.peakValue = 0;
    this.dailyStartValue = 0;
    this.tradeHistory = [];
    this.state.metrics = {
      currentDrawdown: 0,
      dailyLoss: 0,
      consecutiveLosses: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
    };
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  subscribe(callback: (event: CircuitBreakerEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  private notifyListeners(event: CircuitBreakerEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  private pruneOldTrades(): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.tradeHistory = this.tradeHistory.filter((t) => t.timestamp > cutoff);
  }
}

export const createCircuitBreaker = (config?: Partial<CircuitBreakerConfig>) => {
  const defaultConfig: CircuitBreakerConfig = {
    maxDrawdownPct: 10,
    maxDailyLossPct: 5,
    maxConsecutiveLosses: 5,
    cooldownMinutes: 60,
    autoRecovery: true,
    ...config,
  };

  return new CircuitBreaker(defaultConfig);
};
