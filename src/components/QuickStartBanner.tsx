import { useState } from 'react';
import { Zap, ChevronRight, X, Target, TrendingUp, Cpu } from 'lucide-react';

export default function QuickStartBanner() {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('quickstart_dismissed') === 'true';
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem('quickstart_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div className="card p-6 mb-6 border-l-4 border-l-brand-500 bg-gradient-to-r from-brand-600/5 to-transparent relative">
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-surface-500 hover:text-surface-300 transition-colors"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center shrink-0">
          <Zap size={24} className="text-brand-400" />
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-2">Mode ULTRA RAPIDE activé</h3>
          <p className="text-sm text-surface-300 mb-4">
            L'application est maintenant configurée pour détecter et trader automatiquement tous les tokens à fort potentiel de gains.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-start gap-3 p-3 bg-surface-900/50 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                <Target size={16} className="text-brand-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white mb-1">1. Activez Auto-Trade</p>
                <p className="text-[10px] text-surface-400">
                  Allez dans <span className="text-brand-400">Auto-Trade</span> → Activez "Ultra Aggressive" et "All Tokens Scanner"
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-surface-900/50 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                <TrendingUp size={16} className="text-brand-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white mb-1">2. Mode Full Auto</p>
                <p className="text-[10px] text-surface-400">
                  Sélectionnez "Full Auto" pour approuver automatiquement les trades sans validation
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-surface-900/50 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                <Cpu size={16} className="text-brand-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white mb-1">3. AI Manager</p>
                <p className="text-[10px] text-surface-400">
                  Activez l'IA en mode "Aggressive" pour optimisation maximale
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-surface-800">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
              <span className="text-surface-400">Les notifications apparaîtront en haut à droite pour chaque opportunité détectée</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
