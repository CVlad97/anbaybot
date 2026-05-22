import { useState, useEffect, useCallback } from 'react';
import {
  Brain, ToggleLeft, ToggleRight, Play, RefreshCw,
  TrendingUp, TrendingDown, Minus, Shield, Gauge,
  Clock, AlertTriangle, Target, BarChart3,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAppStore } from '../store/appStore';
import { api } from '../lib/api';
import type { AIConfig, AIRecommendation } from '../lib/types';

const RISK_LEVELS = [
  { value: 'conservative', label: 'Prudent', desc: 'Risque plus faible, positions plus petites', icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { value: 'moderate', label: 'Équilibré', desc: 'Compromis risque / rendement', icon: Target, color: 'text-warn-400', bg: 'bg-warn-500/10' },
  { value: 'aggressive', label: 'Dynamique', desc: 'Risque plus élevé, positions plus grandes', icon: Gauge, color: 'text-danger-400', bg: 'bg-danger-500/10' },
] as const;

const SENTIMENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  bullish: { icon: TrendingUp, color: 'text-brand-400', bg: 'bg-brand-600/10' },
  bearish: { icon: TrendingDown, color: 'text-danger-400', bg: 'bg-danger-600/10' },
  neutral: { icon: Minus, color: 'text-surface-400', bg: 'bg-surface-700/50' },
};

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  HOLD: { label: 'ATTENTE', color: 'text-surface-300' },
  INCREASE_EXPOSURE: { label: 'AUGMENTER L’EXPOSITION', color: 'text-brand-400' },
  REDUCE_EXPOSURE: { label: 'RÉDUIRE L’EXPOSITION', color: 'text-warn-400' },
  EMERGENCY_STOP: { label: 'ARRÊT D’URGENCE', color: 'text-danger-400' },
};

export default function AIPage() {
  const { aiConfig, setAIConfig, settings } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const { data } = await api.getAIConfig();
      if (data) {
        setAIConfig(data);
        if (data.last_recommendation) {
          setRecommendation(data.last_recommendation);
        }
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [setAIConfig]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function toggleEnabled() {
    if (!aiConfig) return;
    try {
      await api.updateAIConfig({ enabled: !aiConfig.enabled });
      await loadConfig();
    } catch {
      // silent
    }
  }

  async function updateRisk(risk: AIConfig['risk_tolerance']) {
    try {
      await api.updateAIConfig({ risk_tolerance: risk });
      await loadConfig();
    } catch {
      // silent
    }
  }

  async function toggleRebalance() {
    if (!aiConfig) return;
    try {
      await api.updateAIConfig({ auto_rebalance: !aiConfig.auto_rebalance });
      await loadConfig();
    } catch {
      // silent
    }
  }

  async function updateInterval(hours: number) {
    try {
      await api.updateAIConfig({ rebalance_interval_hours: hours });
      await loadConfig();
    } catch {
      // silent
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const { recommendation: rec } = await api.runAIAnalysis();
      setRecommendation(rec);
      await loadConfig();
    } catch {
      // silent
    }
    setAnalyzing(false);
  }

  const killActive = settings?.kill_switch || false;

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageHeader icon={Brain} title="Gestion IA" subtitle="Pilotage algorithmique du portefeuille" />
        <div className="card p-12 flex items-center justify-center">
          <LoadingSpinner size={24} />
        </div>
      </div>
    );
  }

  const isEnabled = aiConfig?.enabled ?? false;
  const riskTolerance = aiConfig?.risk_tolerance ?? 'moderate';
  const autoRebalance = aiConfig?.auto_rebalance ?? false;
  const interval = aiConfig?.rebalance_interval_hours ?? 24;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Brain}
        title="Gestion IA"
        subtitle="Analyse IA et pilotage du portefeuille"
        action={
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="btn-primary flex items-center gap-2"
          >
            {analyzing ? <LoadingSpinner size={14} /> : <Play size={14} />}
            <span>Lancer l’analyse</span>
          </button>
        }
      />

      <div className="card p-4 mb-6 border-l-4 border-l-warn-500/50">
        <p className="text-xs text-surface-300">
          Les recommandations IA restent des suggestions techniques. La décision d’investissement vous appartient et doit être confirmée par vous.
        </p>
      </div>

      {killActive && (
        <div className="card p-4 mb-6 border-l-4 border-l-danger-500 bg-danger-600/5 flex items-center gap-3">
          <AlertTriangle size={18} className="text-danger-400 shrink-0" />
          <p className="text-sm text-danger-400">Kill switch actif: les opérations IA sont en pause.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className={`card p-6 transition-all ${isEnabled ? 'border-brand-600/20' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEnabled ? 'bg-brand-600/10' : 'bg-surface-800'}`}>
                <Brain size={20} className={isEnabled ? 'text-brand-400' : 'text-surface-500'} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Moteur IA</h3>
                <p className="text-[10px] text-surface-500">Interrupteur principal</p>
              </div>
            </div>
            <button onClick={toggleEnabled} className="p-1">
              {isEnabled
                ? <ToggleRight size={32} className="text-brand-400" />
                : <ToggleLeft size={32} className="text-surface-600" />}
            </button>
          </div>
          <div className={`text-2xl font-bold ${isEnabled ? 'text-brand-400' : 'text-surface-500'}`}>
            {isEnabled ? 'ACTIF' : 'ARRÊT'}
          </div>
          {aiConfig?.last_run_at && (
            <p className="text-[10px] text-surface-500 mt-2 flex items-center gap-1">
              <Clock size={10} />
              Dernière analyse: {new Date(aiConfig.last_run_at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center">
              <RefreshCw size={20} className="text-surface-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Rééquilibrage auto</h3>
              <p className="text-[10px] text-surface-500">Rééquilibrage périodique</p>
            </div>
          </div>
          <button
            onClick={toggleRebalance}
            className={`w-full px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all mb-3 ${
              autoRebalance
                ? 'bg-brand-600/10 text-brand-400 border border-brand-600/20'
                : 'bg-surface-800 text-surface-500 border border-surface-700'
            }`}
          >
            {autoRebalance ? 'Activé' : 'Désactivé'}
          </button>
          <div>
            <label className="text-[10px] text-surface-500 block mb-1">Intervalle: {interval}h</label>
            <input
              type="range"
              min={1}
              max={72}
              step={1}
              value={interval}
              onChange={e => updateInterval(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Niveau de risque</h3>
          <div className="space-y-2">
            {RISK_LEVELS.map(level => {
              const selected = riskTolerance === level.value;
              return (
                <button
                  key={level.value}
                  onClick={() => updateRisk(level.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    selected
                      ? `${level.bg} border border-current/20 ${level.color}`
                      : 'bg-surface-800/50 text-surface-400 border border-surface-700 hover:border-surface-600'
                  }`}
                >
                  <level.icon size={16} />
                  <div className="text-left">
                    <p className="text-xs font-semibold">{level.label}</p>
                    <p className="text-[10px] opacity-70">{level.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {recommendation && <RecommendationPanel rec={recommendation} />}

      {!recommendation && (
        <div className="card p-8 text-center">
          <Brain size={32} className="text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400">Aucun résultat pour l’instant. Cliquez sur “Lancer l’analyse”.</p>
        </div>
      )}
    </div>
  );
}

function RecommendationPanel({ rec }: { rec: AIRecommendation }) {
  const sentimentConf = SENTIMENT_CONFIG[rec.marketSentiment] || SENTIMENT_CONFIG.neutral;
  const actionConf = ACTION_CONFIG[rec.action] || ACTION_CONFIG.HOLD;
  const SentimentIcon = sentimentConf.icon;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <BarChart3 size={18} className="text-brand-400" />
        Recommandation IA
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-2">Action proposée</p>
          <p className={`text-xl font-bold ${actionConf.color}`}>{actionConf.label}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${rec.confidence}%` }}
              />
            </div>
            <span className="text-xs text-surface-400">{rec.confidence}%</span>
          </div>
        </div>

        <div className="card p-5">
          <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-2">Sentiment marché</p>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${sentimentConf.bg} flex items-center justify-center`}>
              <SentimentIcon size={16} className={sentimentConf.color} />
            </div>
            <span className={`text-xl font-bold capitalize ${sentimentConf.color}`}>{rec.marketSentiment}</span>
          </div>
          <p className="text-xs text-surface-500 mt-2">
            Tendance: {rec.trend >= 0 ? '+' : ''}{rec.trend.toFixed(2)}%
          </p>
        </div>

        <div className="card p-5">
          <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-2">Portefeuille</p>
          <p className="text-xl font-bold text-white">
            ${rec.portfolioValueUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-surface-500 mt-2">{rec.walletCount} wallets suivis</p>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-white mb-3">Explication</h3>
        <p className="text-sm text-surface-300 leading-relaxed">{rec.reasoning}</p>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Allocations suggérées</h3>
        <div className="space-y-3">
          {Object.entries(rec.suggestedAllocations).map(([stratId, pct]) => (
            <div key={stratId} className="flex items-center gap-3">
              <span className="text-xs text-surface-400 w-40 truncate">{stratId.replace(/_/g, ' ')}</span>
              <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500/70 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-surface-300 w-12 text-right">{pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-surface-600 text-center">
        Analyse effectuée le {new Date(rec.timestamp).toLocaleString()}
      </p>
    </div>
  );
}
