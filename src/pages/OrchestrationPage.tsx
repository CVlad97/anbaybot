import { Activity, TrendingUp, Shield, Zap, DollarSign, BarChart3, AlertTriangle, Users, RefreshCw } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { useOrchestration } from '../hooks/useOrchestration';

export default function OrchestrationPage() {
  const {
    isRunning,
    traders,
    metrics,
    sentiment,
    events,
    config,
    startOrchestrator,
    stopOrchestrator,
    toggleFeature,
    runAIAnalysis,
    loadTraders,
  } = useOrchestration();

  const handleToggleOrchestrator = async () => {
    if (isRunning) {
      stopOrchestrator();
    } else {
      await startOrchestrator();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="Orchestration trading"
        subtitle="Pilotage multi-wallet avec garde-fous risque"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                <h2 className="text-xl font-semibold text-gray-900">
                  {isRunning ? 'Orchestrateur actif' : 'Orchestrateur arrêté'}
                </h2>
              </div>
              <button
                onClick={handleToggleOrchestrator}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                  isRunning
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isRunning ? 'Arrêter' : 'Démarrer'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Portefeuille</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {metrics.portfolioValue > 0
                    ? `$${metrics.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : 'N/A'}
                </p>
                <p className={`text-sm font-medium mt-1 ${metrics.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.totalPnL >= 0 ? '+' : ''}{metrics.totalPnL.toFixed(1)}%
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Taux de réussite</span>
                </div>
                <p className="text-2xl font-bold text-green-900">{metrics.winRate.toFixed(1)}%</p>
                <p className="text-sm text-green-700 mt-1">{metrics.tradesExecuted} trades</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Score IA</span>
                </div>
                <p className="text-2xl font-bold text-purple-900">{sentiment.score.toFixed(2)}</p>
                <p className="text-sm text-purple-700 mt-1 capitalize">{sentiment.label}</p>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium text-orange-900">Protection</span>
                </div>
                <p className="text-2xl font-bold text-orange-900 capitalize">{metrics.circuitBreakerStatus}</p>
                <p className="text-sm text-orange-700 mt-1">Circuit breaker</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                Traders actifs ({traders.length})
                </h3>
              <button
                onClick={() => loadTraders()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Actualiser les traders"
              >
                <RefreshCw className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {traders.map((trader) => (
                <div
                  key={trader.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${trader.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-900">{trader.label}</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        {trader.chain}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-1 truncate">
                      {trader.address}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    {trader.profitLoss !== undefined && (
                      <p className={`text-sm font-medium ${trader.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {trader.profitLoss >= 0 ? '+' : ''}{trader.profitLoss.toFixed(1)}%
                      </p>
                    )}
                    {trader.winRate !== undefined && trader.winRate > 0 && (
                      <p className="text-xs text-gray-500">WR: {trader.winRate.toFixed(0)}%</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Analyse de sentiment IA</h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Sentiment marché</span>
                  <span className="font-medium text-gray-900">{(sentiment.score * 100).toFixed(0)}/100</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      sentiment.score > 0.5 ? 'bg-green-500' : sentiment.score < -0.3 ? 'bg-red-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${((sentiment.score + 1) / 2) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Niveau de confiance</span>
                  <span className="font-medium text-gray-900">{(sentiment.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${sentiment.confidence * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Exposition recommandée</span>
                  <span className="font-medium text-gray-900">{sentiment.exposure}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${sentiment.exposure}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Recommandation IA:</strong> sentiment <strong>{sentiment.label}</strong> avec {(sentiment.confidence * 100).toFixed(0)}% de confiance.
                Exposition conseillée: {sentiment.exposure}% selon les conditions actuelles.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Événements récents
            </h3>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Aucun événement pour l'instant. Démarrez l'orchestrateur.
                </p>
              ) : (
                events.map((event, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      event.type === 'trade' ? 'bg-green-500' :
                      event.type === 'warning' ? 'bg-yellow-500' :
                      event.type === 'analysis' ? 'bg-blue-500' :
                      event.type === 'rebalance' ? 'bg-purple-500' :
                      'bg-gray-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">{event.time}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          event.type === 'trade' ? 'bg-green-100 text-green-700' :
                          event.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                          event.type === 'analysis' ? 'bg-blue-100 text-blue-700' :
                          event.type === 'rebalance' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {event.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 mt-1">{event.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration système</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900">Analyse IA</span>
                </div>
                <button
                  onClick={() => toggleFeature('aiEnabled')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.aiEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.aiEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium text-gray-900">Circuit Breaker</span>
                </div>
                <button
                  onClick={() => toggleFeature('circuitBreakerEnabled')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.circuitBreakerEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.circuitBreakerEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">Pont TradFi</span>
                </div>
                <button
                  onClick={() => toggleFeature('tradfiEnabled')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.tradfiEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.tradfiEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">Rééquilibrage auto</span>
                </div>
                <button
                  onClick={() => toggleFeature('autoRebalance')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.autoRebalance ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.autoRebalance ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl shadow-sm border border-orange-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Limites de risque</h3>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">Drawdown max</span>
                  <span className="font-medium text-gray-900">7.2% / 10%</span>
                </div>
                <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: '72%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">Perte journalière</span>
                  <span className="font-medium text-gray-900">2.1% / 5%</span>
                </div>
                <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500" style={{ width: '42%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">Pertes consécutives</span>
                  <span className="font-medium text-gray-900">2 / 5</span>
                </div>
                <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: '40%' }} />
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-600 mt-4 leading-relaxed">
              Le circuit breaker coupe automatiquement le trading si une limite est dépassée.
              Un cooldown de 60 minutes s'applique.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h3>

            <div className="space-y-2">
              <button
                onClick={() => runAIAnalysis()}
                disabled={!config.aiEnabled}
                className="w-full px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Lancer l'analyse IA
              </button>

              <button
                onClick={() => loadTraders()}
                className="w-full px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                Recharger les traders
              </button>

              <button className="w-full px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors">
                Exécuter le bundle Jito
              </button>

              <button
                onClick={stopOrchestrator}
                disabled={!isRunning}
                className="w-full px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Arrêt d'urgence global
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
