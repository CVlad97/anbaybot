import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ethers } from 'ethers';

export interface WalletBalance {
  address: string;
  chain: 'solana' | 'ethereum' | 'base' | 'arbitrum';
  balance: number;
  balanceUsd: number;
  lastUpdated: number;
  status: 'active' | 'syncing' | 'error';
  error?: string;
}

export interface AggregatedPortfolio {
  totalBalanceUsd: number;
  wallets: WalletBalance[];
  byChain: Record<string, { count: number; totalUsd: number }>;
  lastSync: number;
}

export class MultiWalletManager {
  private solanaConnection: Connection;
  private evmProviders: Map<string, ethers.JsonRpcProvider>;
  private updateInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(portfolio: AggregatedPortfolio) => void> = new Set();

  constructor(
    solanaRpcUrl: string,
    evmRpcUrls: Record<string, string> = {}
  ) {
    this.solanaConnection = new Connection(solanaRpcUrl, 'confirmed');
    this.evmProviders = new Map();

    Object.entries(evmRpcUrls).forEach(([chain, url]) => {
      this.evmProviders.set(chain, new ethers.JsonRpcProvider(url));
    });
  }

  async fetchSolanaBalance(address: string, solPriceUsd: number): Promise<WalletBalance> {
    try {
      const pubKey = new PublicKey(address);
      const balance = await this.solanaConnection.getBalance(pubKey);
      const balanceSol = balance / LAMPORTS_PER_SOL;

      return {
        address,
        chain: 'solana',
        balance: balanceSol,
        balanceUsd: balanceSol * solPriceUsd,
        lastUpdated: Date.now(),
        status: 'active',
      };
    } catch (error) {
      return {
        address,
        chain: 'solana',
        balance: 0,
        balanceUsd: 0,
        lastUpdated: Date.now(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async fetchEvmBalance(
    address: string,
    chain: 'ethereum' | 'base' | 'arbitrum',
    ethPriceUsd: number
  ): Promise<WalletBalance> {
    try {
      const provider = this.evmProviders.get(chain);
      if (!provider) {
        throw new Error(`No provider configured for ${chain}`);
      }

      const balance = await provider.getBalance(address);
      const balanceEth = parseFloat(ethers.formatEther(balance));

      return {
        address,
        chain,
        balance: balanceEth,
        balanceUsd: balanceEth * ethPriceUsd,
        lastUpdated: Date.now(),
        status: 'active',
      };
    } catch (error) {
      return {
        address,
        chain,
        balance: 0,
        balanceUsd: 0,
        lastUpdated: Date.now(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async aggregateBalances(
    walletAddresses: Array<{ address: string; chain: WalletBalance['chain'] }>,
    prices: { sol: number; eth: number }
  ): Promise<AggregatedPortfolio> {
    const balancePromises = walletAddresses.map((wallet) => {
      if (wallet.chain === 'solana') {
        return this.fetchSolanaBalance(wallet.address, prices.sol);
      } else {
        return this.fetchEvmBalance(wallet.address, wallet.chain, prices.eth);
      }
    });

    const wallets = await Promise.all(balancePromises);

    const byChain = wallets.reduce((acc, wallet) => {
      if (!acc[wallet.chain]) {
        acc[wallet.chain] = { count: 0, totalUsd: 0 };
      }
      acc[wallet.chain].count++;
      acc[wallet.chain].totalUsd += wallet.balanceUsd;
      return acc;
    }, {} as Record<string, { count: number; totalUsd: number }>);

    const totalBalanceUsd = wallets.reduce((sum, w) => sum + w.balanceUsd, 0);

    return {
      totalBalanceUsd,
      wallets,
      byChain,
      lastSync: Date.now(),
    };
  }

  startAutoSync(
    walletAddresses: Array<{ address: string; chain: WalletBalance['chain'] }>,
    prices: { sol: number; eth: number },
    intervalMs: number = 30000
  ): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    const sync = async () => {
      const portfolio = await this.aggregateBalances(walletAddresses, prices);
      this.notifyListeners(portfolio);
    };

    sync();
    this.updateInterval = setInterval(sync, intervalMs);
  }

  stopAutoSync(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  subscribe(callback: (portfolio: AggregatedPortfolio) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(portfolio: AggregatedPortfolio): void {
    this.listeners.forEach((listener) => listener(portfolio));
  }
}

export const createMultiWalletManager = () => {
  return new MultiWalletManager(
    'https://api.mainnet-beta.solana.com',
    {
      ethereum: 'https://eth.llamarpc.com',
      base: 'https://mainnet.base.org',
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    }
  );
};
