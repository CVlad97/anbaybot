import {
  Connection,
  Keypair,
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

export interface BundleTransaction {
  walletIndex: number;
  instruction: 'transfer' | 'swap' | 'stake';
  destination?: string;
  amount?: number;
  payload?: Record<string, unknown>;
}

export interface BundleResult {
  bundleId: string;
  status: 'submitted' | 'confirmed' | 'failed';
  transactions: Array<{
    signature: string;
    wallet: string;
    status: string;
  }>;
  timestamp: number;
}

export class JitoBundleExecutor {
  private connection: Connection;
  private jitoBlockEngineUrl: string;

  constructor(rpcUrl: string, jitoUrl?: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.jitoBlockEngineUrl = jitoUrl || 'https://mainnet.block-engine.jito.wtf';
  }

  async createTransferBundle(
    wallets: Keypair[],
    destination: string,
    amountPerWallet: number
  ): Promise<Transaction[]> {
    const recentBlockhash = await this.connection.getLatestBlockhash();

    return wallets.map((wallet) => {
      const tx = new Transaction({
        feePayer: wallet.publicKey,
        ...recentBlockhash,
      });

      tx.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(destination),
          lamports: Math.floor(amountPerWallet * LAMPORTS_PER_SOL),
        })
      );

      tx.sign(wallet);
      return tx;
    });
  }

  async sendBundleViaJito(
    transactions: Transaction[],
    wallets: Keypair[]
  ): Promise<BundleResult> {
    try {
      const serializedTxs = transactions.map((tx) =>
        Buffer.from(tx.serialize()).toString('base64')
      );

      const jitoTipAccount = 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY';

      const tipTx = new Transaction();
      tipTx.add(
        SystemProgram.transfer({
          fromPubkey: wallets[0].publicKey,
          toPubkey: new PublicKey(jitoTipAccount),
          lamports: 10000,
        })
      );

      const response = await fetch(`${this.jitoBlockEngineUrl}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [serializedTxs],
        }),
      });

      if (!response.ok) {
        throw new Error(`Jito API error: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        bundleId: result.result || 'simulated',
        status: 'submitted',
        transactions: wallets.map((wallet, i) => ({
          signature: transactions[i].signatures[0].toString(),
          wallet: wallet.publicKey.toString(),
          status: 'pending',
        })),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Jito bundle submission failed:', error);

      return {
        bundleId: 'failed',
        status: 'failed',
        transactions: [],
        timestamp: Date.now(),
      };
    }
  }

  async executeAtomicMultiWalletAction(
    wallets: Keypair[],
    action: 'consolidate' | 'distribute',
    targetAddress: string,
    amount?: number
  ): Promise<BundleResult> {
    if (action === 'consolidate') {
      const balances = await Promise.all(
        wallets.map((w) => this.connection.getBalance(w.publicKey))
      );

      const txs = wallets
        .map((wallet, i) => {
          const availableBalance = balances[i] - 5000;
          if (availableBalance <= 0) return null;

          const tx = new Transaction();
          tx.add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: new PublicKey(targetAddress),
              lamports: availableBalance,
            })
          );
          tx.feePayer = wallet.publicKey;
          return { tx, wallet };
        })
        .filter((item): item is { tx: Transaction; wallet: Keypair } => item !== null);

      const recentBlockhash = await this.connection.getLatestBlockhash();
      txs.forEach(({ tx, wallet }) => {
        tx.recentBlockhash = recentBlockhash.blockhash;
        tx.sign(wallet);
      });

      return this.sendBundleViaJito(
        txs.map((t) => t.tx),
        txs.map((t) => t.wallet)
      );
    } else {
      if (!amount) throw new Error('Amount required for distribution');

      const transactions = await this.createTransferBundle(
        wallets,
        targetAddress,
        amount
      );

      return this.sendBundleViaJito(transactions, wallets);
    }
  }

  async simulateBundle(transactions: Transaction[]): Promise<boolean> {
    try {
      for (const tx of transactions) {
        const simulation = await this.connection.simulateTransaction(tx);
        if (simulation.value.err) {
          console.error('Simulation failed:', simulation.value.err);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Bundle simulation error:', error);
      return false;
    }
  }
}

export const createJitoBundleExecutor = (rpcUrl?: string) => {
  return new JitoBundleExecutor(
    rpcUrl || 'https://api.mainnet-beta.solana.com'
  );
};
