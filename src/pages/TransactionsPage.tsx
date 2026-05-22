import { useState, useEffect } from 'react';
import { ListOrdered, ExternalLink, Clock, CheckCircle, XCircle } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import StatusBadge from '../components/ui/StatusBadge';
import { api } from '../lib/api';
import type { Transaction, Action } from '../lib/types';

interface TxWithAction extends Transaction {
  action?: Action;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TxWithAction[]>([]);
  const [actions, setActions] = useState<Action[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { transactions: txRows, actions: actionRows } = await api.getTransactionsTimeline();
    const txList = (txRows || []) as Transaction[];
    const actList = (actionRows || []) as Action[];
    setActions(actList);
    setTransactions(
      txList.map(tx => ({ ...tx, action: actList.find(a => a.id === tx.action_id) }))
    );
  }

  const statusIcon = (status: string) => {
    if (status === 'SUCCESS') return <CheckCircle size={16} className="text-brand-400" />;
    if (status === 'FAILED') return <XCircle size={16} className="text-danger-400" />;
    return <Clock size={16} className="text-warn-400" />;
  };

  const confirmedActions = actions.filter(a => a.status === 'CONFIRMED');
  const failedActions = actions.filter(a => a.status === 'FAILED');

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={ListOrdered}
        title="Historique"
        subtitle="Historique des transactions on-chain et des actions"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Total tx</p>
          <p className="text-2xl font-bold text-white">{transactions.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Réussies</p>
          <p className="text-2xl font-bold text-brand-400">{transactions.filter(t => t.status === 'SUCCESS').length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Actions confirmées</p>
          <p className="text-2xl font-bold text-white">{confirmedActions.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Failed</p>
          <p className="text-2xl font-bold text-danger-400">{failedActions.length}</p>
        </div>
      </div>

      {transactions.length === 0 && actions.filter(a => a.status !== 'PREPARED').length === 0 ? (
        <EmptyState icon={ListOrdered} title="Aucune transaction" description="Confirmez des actions dans la Console pour alimenter cet historique." />
      ) : (
        <>
          {transactions.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-white mb-4">Transactions on-chain</h2>
              <div className="space-y-3 mb-8">
                {transactions.map(tx => (
                  <div key={tx.id} className="card p-4 flex items-center gap-4">
                    {statusIcon(tx.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={tx.status} />
                        {tx.action && (
                          <span className="text-xs text-surface-400">
                            {(tx.action.payload as Record<string, string>).symbol || ''} -- {tx.action.type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-surface-500 font-mono truncate">{tx.signature || 'N/A'}</p>
                    </div>
                    <span className="text-xs text-surface-600 hidden sm:block">{new Date(tx.created_at).toLocaleString()}</span>
                    {tx.explorer_url && (
                      <a href={tx.explorer_url} target="_blank" rel="noopener noreferrer" className="btn-ghost p-2">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="text-lg font-semibold text-white mb-4">Chronologie des actions</h2>
          <div className="relative border-l-2 border-surface-800 ml-4 space-y-6">
            {actions.filter(a => a.status !== 'PREPARED').slice(0, 30).map(a => (
              <div key={a.id} className="relative pl-8">
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${
                  a.status === 'CONFIRMED' ? 'bg-brand-600 border-brand-400' :
                  a.status === 'FAILED' ? 'bg-danger-600 border-danger-400' :
                  a.status === 'REFUSED' ? 'bg-surface-600 border-surface-400' :
                  'bg-warn-600 border-warn-400'
                }`} />
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={a.status} />
                    <span className="text-xs text-surface-500">{a.type}</span>
                    <span className="text-xs text-surface-600 ml-auto">{new Date(a.updated_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-surface-300">
                    {(a.payload as Record<string, string>).symbol || 'N/A'} -- {(a.payload as Record<string, string>).reason || a.strategy_id}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
