import { useState } from 'react';
import { Check, X, ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import { Connection, VersionedTransaction } from '@solana/web3.js';

interface Action {
  id: string;
  type: string;
  status: string;
  chain: string;
  strategy_id: string;
  wallet_id: string;
  token_in: string;
  token_out: string;
  amount_in: string;
  min_amount_out?: string;
  quote_data?: Record<string, unknown>;
  tx_data?: string;
  tx_signature?: string;
  refusal_reason?: string;
  payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  managed_wallets?: {
    label: string;
    address: string;
  };
}

interface ActionCardProps {
  action: Action;
  onConfirm: (id: string, signature: string) => void;
  onRefuse: (id: string, reason: string) => void;
  onBuild: (id: string) => void;
}

export default function ActionCard({ action, onConfirm, onRefuse, onBuild }: ActionCardProps) {
  const [building, setBuilding] = useState(false);
  const [signing, setSigning] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [refusalReason, setRefusalReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PREPARED':
      case 'QUOTED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'TX_BUILT':
      case 'AWAITING_SIGNATURE':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'SUBMITTED':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'CONFIRMED':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'FAILED':
      case 'REJECTED':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const handleBuild = async () => {
    setBuilding(true);
    setError(null);
    try {
      await onBuild(action.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Build failed');
    } finally {
      setBuilding(false);
    }
  };

  const handleSign = async () => {
    if (!action.tx_data || !action.managed_wallets?.address) {
      setError('Transaction data or wallet address missing');
      return;
    }

    setSigning(true);
    setError(null);

    try {
      const provider = window.solana || window.solflare;
      if (!provider) {
        throw new Error('Wallet not connected');
      }

      const txBuffer = Uint8Array.from(atob(action.tx_data), c => c.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(txBuffer);

      let signature: string;

      if (provider.signAndSendTransaction) {
        const result = await provider.signAndSendTransaction(transaction);
        signature = result.signature;
      } else if (provider.signTransaction) {
        const signedTx = await provider.signTransaction(transaction) as VersionedTransaction;
        const connection = new Connection('https://api.mainnet-beta.solana.com');
        const rawTransaction = signedTx.serialize();
        signature = await connection.sendRawTransaction(rawTransaction);
      } else {
        throw new Error('Wallet does not support signing transactions');
      }

      await onConfirm(action.id, signature);
    } catch (err) {
      console.error('Sign error:', err);
      setError(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setSigning(false);
    }
  };

  const handleRefuse = async () => {
    if (!refusalReason.trim()) {
      setError('Please provide a reason for refusal');
      return;
    }

    setRefusing(true);
    setError(null);

    try {
      await onRefuse(action.id, refusalReason);
      setRefusalReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refusal failed');
    } finally {
      setRefusing(false);
    }
  };

  const formatAmount = (amount: string, decimals: number = 9) => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toFixed(4);
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(action.status)}`}>
              {action.status}
            </span>
            <span className="text-xs text-surface-500 font-medium uppercase">{action.type}</span>
            <span className="text-xs text-surface-600">{action.strategy_id}</span>
          </div>
          {action.managed_wallets && (
            <p className="text-xs text-surface-500 font-mono">
              Wallet: {action.managed_wallets.label} ({action.managed_wallets.address.slice(0, 4)}...{action.managed_wallets.address.slice(-4)})
            </p>
          )}
        </div>
        <span className="text-xs text-surface-600">
          {new Date(action.created_at).toLocaleString()}
        </span>
      </div>

      <div className="flex items-center gap-3 p-3 bg-surface-900 rounded-lg">
        <div className="flex-1">
          <p className="text-xs text-surface-500 mb-1">From</p>
          <p className="text-sm text-white font-mono truncate">{action.token_in}</p>
          <p className="text-xs text-surface-400 mt-1">{formatAmount(action.amount_in)}</p>
        </div>
        <ArrowRight className="text-surface-600" size={20} />
        <div className="flex-1">
          <p className="text-xs text-surface-500 mb-1">To</p>
          <p className="text-sm text-white font-mono truncate">{action.token_out}</p>
          {(() => {
            const outAmount = action.quote_data && typeof action.quote_data === 'object'
              ? (action.quote_data as { outAmount?: string }).outAmount
              : undefined;
            return outAmount ? (
              <p className="text-xs text-surface-400 mt-1">{formatAmount(outAmount)}</p>
            ) : null;
          })()}
        </div>
      </div>

      {(() => {
        const reason = action.payload && typeof action.payload === 'object' ? (action.payload as { reason?: string }).reason : undefined;
        return reason ? (
          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-400">{reason}</p>
          </div>
        ) : null;
      })()}

      {error && (
        <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {action.refusal_reason && (
        <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">Refused: {action.refusal_reason}</p>
        </div>
      )}

      {action.tx_signature && (
        <a
          href={`https://solscan.io/tx/${action.tx_signature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-brand-400 hover:text-brand-300"
        >
          View on Solscan
          <ExternalLink size={12} />
        </a>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-surface-800">
        {action.status === 'PREPARED' && (
          <>
            <button
              onClick={handleBuild}
              disabled={building}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {building ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {building ? 'Building...' : 'Build Transaction'}
            </button>
            <button
              onClick={() => setRefusing(!refusing)}
              className="btn-ghost px-4"
            >
              <X size={16} />
            </button>
          </>
        )}

        {action.status === 'TX_BUILT' && (
          <>
            <button
              onClick={handleSign}
              disabled={signing}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {signing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {signing ? 'Signing...' : 'Sign & Submit'}
            </button>
            <button
              onClick={() => setRefusing(!refusing)}
              className="btn-ghost px-4"
            >
              <X size={16} />
            </button>
          </>
        )}

        {['CONFIRMED', 'FAILED', 'REJECTED'].includes(action.status) && (
          <span className="text-xs text-surface-500 italic">Action completed</span>
        )}
      </div>

      {refusing && (
        <div className="space-y-2 pt-2 border-t border-surface-800">
          <input
            type="text"
            placeholder="Reason for refusal..."
            value={refusalReason}
            onChange={(e) => setRefusalReason(e.target.value)}
            className="input"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRefuse}
              disabled={refusing}
              className="btn-ghost text-red-400 hover:bg-red-500/10 flex-1"
            >
              {refusing ? 'Refusing...' : 'Confirm Refusal'}
            </button>
            <button
              onClick={() => setRefusing(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
