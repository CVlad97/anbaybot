import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Brain, Play, RefreshCw, Shield, Target, Gauge } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAppStore } from '../store/appStore';
import { api } from '../lib/api';
import { runDedicatedAIAnalysis } from '../lib/aiAnalysisApi';
import type { AIConfig, AIRecommendation } from '../lib/types';

const riskLevels = [
  { value: 'conservative' as const, label: 'Prudent', icon: Shield },
  { value: 'moderate' as const, label: 'Équilibré', icon: Target },
  { value: 'aggressive' as const, label: 'Dynamique', icon: Gauge },
];

export default function AIPage() {
  const { aiConfig, setAIConfig, settings } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [error, setError] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      const { data } = await api.getAIConfig();
      if (data) {
        setAIConfig(data);
        if (data.last_recommendation) setRecommendation(data.last_recommendation);
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Configuration IA indisponible');
    } finally {
      setLoading(false);
    }
  }, [setAIConfig]);

  useEffect(() => { void loadConfig(); }, [loadConfig]);

  async function mutate(body: Partial<AIConfig>) {
    try {
      setError('');
      await api.updateAIConfig(body);
      await loadConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mise à jour IA impossible');
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setError('');
    try {
      const rec = await runDedicatedAIAnalysis();
      setRecommendation(rec);
      await loadConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyse IA impossible');
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return <div className="card p-12 flex justify-center"><LoadingSpinner size={24} /></div>;
  }

  const enabled = aiConfig?.enabled ?? false;
  const risk = aiConfig?.risk_tolerance ?? 'moderate';

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Brain}
        title="Gestion IA"
        subtitle="Analyse algorithmique sur portefeuille et marché réels"
        action={
          <button className="btn-primary flex items-center gap-2" onClick={analyze} disabled={analyzing || !enabled}>
            {analyzing ? <LoadingSpinner size={14} /> : <Play size={14} />}
            {analyzing ? 'Analyse…' : 'Lancer l’analyse'}
          </button>
        }
      />

      <div className="card p-4 mb-6 border-l-4 border-l-brand-500">
        <p className="text-sm text-white">Moteur IA : {enabled ? 'ACTIF' : 'ARRÊT'}</p>
        <p className="text-xs text-surface-400 mt-1">
          Analyse uniquement. Aucun ordre, transfert ou rééquilibrage n’est exécuté sans validation séparée.
        </p>
      </div>

      {error && (
        <div className="card p-4 mb-6 border-l-4 border-l-danger-500 text-sm text-danger-300">
          {error}
        </div>
      )}

      {settings?.kill_switch && (
        <div className="card p-4 mb-6 flex gap-3 border-l-4 border-l-warn-500">
          <AlertTriangle size={18} className="text-warn-400" />
          <p className="text-sm text-surface-300">Kill switch LIVE actif : l’analyse reste disponible, les ordres restent bloqués.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-xs text-surface-500 uppercase">Moteur</p>
          <p className="text-2xl font-bold text-white mt-2">{enabled ? 'ACTIF' : 'ARRÊT'}</p>
          <button className="btn-secondary w-full mt-4" onClick={() => mutate({ enabled: !enabled })}>
            {enabled ? 'Désactiver' : 'Activer'}
          </button>
        </div>

        <div className="card p-5">
          <p className="text-xs text-surface-500 uppercase">Rééquilibrage automatique</p>
          <p className="text-2xl font-bold text-white mt-2">{aiConfig?.auto_rebalance ? 'ACTIF' : 'DÉSACTIVÉ'}</p>
          <p className="text-xs text-surface-500 mt-3">Conservé désactivé par défaut pour éviter tout mouvement autonome de fonds.</p>
        </div>

        <div className="card p-5">
          <p className="text-xs text-surface-500 uppercase">Dernière analyse</p>
          <p className="text-sm text-white mt-2">
            {aiConfig?.last_run_at ? new Date(aiConfig.last_run_at).toLocaleString('fr-FR') : 'Aucune'}
          </p>
          <RefreshCw size={18} className="text-surface-500 mt-4" />
        </div>
      </div>

      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-white mb-3">Niveau de risque de l’analyse</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {riskLevels.map(level => {
            const Icon = level.icon;
            const selected = risk === level.value;
            return (
              <button
                key={level.value}
                onClick={() => mutate({ risk_tolerance: level.value })}
                className={(selected ? 'border-brand-500 text-brand-300 ' : 'border-surface-700 text-surface-400 ') + 'border rounded-xl p-3 flex items-center gap-2'}
              >
                <Icon size={16} /> {level.label}
              </button>
            );
          })}
        </div>
      </div>

      {recommendation ? <Recommendation rec={recommendation} /> : (
        <div className="card p-8 text-center text-surface-400">Clique sur « Lancer l’analyse » pour produire et enregistrer une recommandation.</div>
      )}
    </div>
  );
}

function Recommendation({ rec }: { rec: AIRecommendation }) {
  return (
    <div className="card p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <p className="text-xs text-surface-500 uppercase">Recommandation</p>
          <p className="text-2xl font-bold text-white mt-1">{rec.action}</p>
          <p className="text-sm text-surface-300 mt-2">{rec.reasoning}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-surface-500">Confiance</p>
          <p className="text-2xl font-bold text-brand-400">{rec.confidence}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        <Stat label="Sentiment" value={rec.marketSentiment} />
        <Stat label="Tendance moyenne" value={(rec.trend >= 0 ? '+' : '') + rec.trend.toFixed(2) + '%'} />
        <Stat label="Portefeuille observé" value={'$' + rec.portfolioValueUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} />
      </div>

      <div className="mt-5">
        <p className="text-xs text-surface-500 uppercase mb-2">Allocations suggérées</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(rec.suggestedAllocations).map(([name, pct]) => (
            <span key={name} className="badge-neutral">{name.replace(/_/g, ' ')} · {pct.toFixed(0)}%</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-surface-800 p-3"><p className="text-[10px] text-surface-500 uppercase">{label}</p><p className="text-sm text-white mt-1">{value}</p></div>;
}
