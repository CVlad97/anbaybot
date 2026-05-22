import { useEffect, useState } from 'react';
import { TrendingUp, Zap, X, CheckCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { api } from '../lib/api';

interface Opportunity {
  id: string;
  token: string;
  chain: string;
  change: number;
  strategy: string;
  reason: string;
  timestamp: number;
  actionId?: string;
  autoApproved?: boolean;
}

interface PreparedAction {
  id: string;
  status: string;
  payload?: {
    token_symbol?: string;
    price_change_24h?: number;
    price_change_1h?: number;
    reason?: string;
  };
  chain?: string;
  strategy_id?: string;
  created_at: string;
}

export default function OpportunityNotifications() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { settings } = useAppStore();

  useEffect(() => {
    const interval = setInterval(async () => {
      if (settings?.kill_switch) return;

      try {
        const { data: actions } = await api.getActions();
        const prepared = ((actions || []) as PreparedAction[]).filter((a) => a.status === 'PREPARED');

        const newOpps: Opportunity[] = prepared.slice(0, 5).map((action) => {
          const payload = action.payload || {};
          return {
            id: action.id,
            token: payload.token_symbol || 'UNKNOWN',
            chain: action.chain || 'unknown',
            change: payload.price_change_24h || payload.price_change_1h || 0,
            strategy: action.strategy_id || 'unknown',
            reason: payload.reason || 'Nouvelle opportunité détectée',
            timestamp: new Date(action.created_at).getTime(),
            actionId: action.id,
            autoApproved: false,
          };
        });

        setOpportunities(prev => {
          const existing = new Set(prev.map(o => o.id));
          const fresh = newOpps.filter(o => !existing.has(o.id) && !dismissed.has(o.id));
          return [...prev, ...fresh].slice(-10);
        });
      } catch {
        // silent
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [settings, dismissed]);

  const dismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
    setOpportunities(prev => prev.filter(o => o.id !== id));
  };

  const approveForReview = async (opp: Opportunity) => {
    if (!opp.actionId) return;
    try {
      await api.buildAction(opp.actionId);
      setOpportunities(prev => prev.map(o =>
        o.id === opp.id ? { ...o, autoApproved: true } : o
      ));
      setTimeout(() => dismiss(opp.id), 3000);
    } catch {
      // silent
    }
  };

  const visible = opportunities.filter(o => !dismissed.has(o.id)).slice(-3);

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      {visible.map(opp => (
        <div
          key={opp.id}
          className="card p-4 border-l-4 border-l-brand-500 bg-surface-900/95 backdrop-blur-sm shadow-2xl animate-slide-in"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
              <Zap size={18} className="text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-white">{opp.token}</span>
                <span className="badge-success text-[10px]">
                  {opp.change > 0 ? '+' : ''}{opp.change.toFixed(1)}%
                </span>
                <span className="badge-neutral text-[10px]">{opp.chain}</span>
              </div>
              <p className="text-xs text-surface-300 mb-2 line-clamp-2">{opp.reason}</p>
              {opp.autoApproved ? (
                <div className="flex items-center gap-1 text-xs text-brand-400">
                  <CheckCircle size={12} />
                  <span>Action préparée pour validation</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveForReview(opp)}
                    className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
                  >
                    <TrendingUp size={12} />
                    <span>Préparer</span>
                  </button>
                  <button
                    onClick={() => dismiss(opp.id)}
                    className="text-surface-500 hover:text-surface-300 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
