import { useState } from 'react';
import { Zap, X, Target, TrendingUp, Cpu } from 'lucide-react';

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
          <h3 className="text-lg font-bold text-white mb-2">Mode débutant sécurisé</h3>
          <p className="text-sm text-surface-300 mb-4">
            Le cockpit vous aide à analyser et préparer des ordres, mais la validation finale reste toujours côté utilisateur.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-start gap-3 p-3 bg-surface-900/50 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                <Target size={16} className="text-brand-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white mb-1">1. Réglez vos limites</p>
                <p className="text-[10px] text-surface-400">
                  Dans <span className="text-brand-400">Pilotage des ordres</span>, fixez allocation et perte max.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-surface-900/50 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                <TrendingUp size={16} className="text-brand-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white mb-1">2. Gardez le semi-auto</p>
                <p className="text-[10px] text-surface-400">
                  L’IA propose, vous confirmez chaque ordre avant envoi.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-surface-900/50 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                <Cpu size={16} className="text-brand-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white mb-1">3. Lancez l’analyse IA</p>
                <p className="text-[10px] text-surface-400">
                  Vérifiez la recommandation, puis validez manuellement en connaissance du risque.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-surface-800">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
              <span className="text-surface-400">Aucun profit n’est garanti. Les notifications servent d’aide à la décision.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
