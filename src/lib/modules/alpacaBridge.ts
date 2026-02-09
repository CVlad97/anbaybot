export interface AlpacaConfig {
  keyId: string;
  secretKey: string;
  paper: boolean;
  baseUrl?: string;
}

export interface StockPosition {
  symbol: string;
  qty: number;
  marketValue: number;
  currentPrice: number;
  unrealizedPl: number;
  unrealizedPlpc: number;
}

export interface AlpacaOrder {
  id: string;
  symbol: string;
  qty?: number;
  notional?: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  status: string;
  filledAvgPrice?: number;
}

export interface DiversificationStrategy {
  cryptoAllocation: number;
  stockAllocation: number;
  targetSymbols: string[];
  rebalanceThreshold: number;
}

export class AlpacaBridge {
  private config: AlpacaConfig;
  private baseUrl: string;

  constructor(config: AlpacaConfig) {
    this.config = config;
    this.baseUrl =
      config.baseUrl ||
      (config.paper
        ? 'https://paper-api.alpaca.markets'
        : 'https://api.alpaca.markets');
  }

  private getHeaders(): HeadersInit {
    return {
      'APCA-API-KEY-ID': this.config.keyId,
      'APCA-API-SECRET-KEY': this.config.secretKey,
      'Content-Type': 'application/json',
    };
  }

  async getAccount(): Promise<{
    equity: number;
    cash: number;
    buyingPower: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/account`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.statusText}`);
      }

      const account = await response.json();

      return {
        equity: parseFloat(account.equity),
        cash: parseFloat(account.cash),
        buyingPower: parseFloat(account.buying_power),
      };
    } catch (error) {
      console.error('Failed to fetch Alpaca account:', error);
      throw error;
    }
  }

  async getPositions(): Promise<StockPosition[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/positions`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.statusText}`);
      }

      const positions = await response.json();

      return positions.map((pos: Record<string, string>) => ({
        symbol: pos.symbol,
        qty: parseFloat(pos.qty),
        marketValue: parseFloat(pos.market_value),
        currentPrice: parseFloat(pos.current_price),
        unrealizedPl: parseFloat(pos.unrealized_pl),
        unrealizedPlpc: parseFloat(pos.unrealized_plpc),
      }));
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      return [];
    }
  }

  async diversifyToStocks(
    amountUsd: number,
    symbols: string[] = ['SPY', 'QQQ', 'VTI']
  ): Promise<AlpacaOrder[]> {
    const orders: AlpacaOrder[] = [];
    const perSymbol = amountUsd / symbols.length;

    for (const symbol of symbols) {
      try {
        const order = await this.createOrder({
          symbol,
          notional: perSymbol,
          side: 'buy',
          type: 'market',
          timeInForce: 'day',
        });

        orders.push(order);
        console.log(`Created order for ${symbol}: $${perSymbol}`);
      } catch (error) {
        console.error(`Failed to create order for ${symbol}:`, error);
      }
    }

    return orders;
  }

  async createOrder(params: {
    symbol: string;
    qty?: number;
    notional?: number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
    limitPrice?: number;
  }): Promise<AlpacaOrder> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Order failed: ${error.message}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create order:', error);
      throw error;
    }
  }

  async rebalancePortfolio(
    strategy: DiversificationStrategy,
    totalCryptoValue: number
  ): Promise<{
    executed: boolean;
    orders: AlpacaOrder[];
    message: string;
  }> {
    try {
      const account = await this.getAccount();
      const positions = await this.getPositions();

      const stockValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
      const totalValue = totalCryptoValue + stockValue;

      const currentStockAllocation = totalValue > 0 ? stockValue / totalValue : 0;
      const targetStockAllocation = strategy.stockAllocation / 100;

      const diff = Math.abs(currentStockAllocation - targetStockAllocation);

      if (diff < strategy.rebalanceThreshold / 100) {
        return {
          executed: false,
          orders: [],
          message: `Portfolio within rebalance threshold (${diff.toFixed(2)}%)`,
        };
      }

      const targetStockValue = totalValue * targetStockAllocation;
      const amountToInvest = targetStockValue - stockValue;

      if (amountToInvest > 0 && amountToInvest < account.cash) {
        const orders = await this.diversifyToStocks(
          amountToInvest,
          strategy.targetSymbols
        );

        return {
          executed: true,
          orders,
          message: `Rebalanced: Invested $${amountToInvest.toFixed(2)} into stocks`,
        };
      } else if (amountToInvest < 0) {
        return {
          executed: false,
          orders: [],
          message: 'Rebalancing would require selling stocks (not implemented)',
        };
      } else {
        return {
          executed: false,
          orders: [],
          message: 'Insufficient cash for rebalancing',
        };
      }
    } catch (error) {
      console.error('Rebalance failed:', error);
      return {
        executed: false,
        orders: [],
        message: `Rebalance error: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  }

  async autoConvertProfits(
    cryptoProfitUsd: number,
    conversionThreshold: number = 1000
  ): Promise<AlpacaOrder[]> {
    if (cryptoProfitUsd < conversionThreshold) {
      console.log(`Profit $${cryptoProfitUsd} below threshold $${conversionThreshold}`);
      return [];
    }

    const symbols = ['SPY', 'BND'];
    return this.diversifyToStocks(cryptoProfitUsd, symbols);
  }
}

export const createAlpacaBridge = (config: AlpacaConfig) => {
  return new AlpacaBridge(config);
};
