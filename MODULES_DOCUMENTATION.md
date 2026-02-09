# IKB-Copybot Advanced Trading Modules

## Vue d'Ensemble

Cette implémentation intègre les 6 modules avancés proposés dans l'analyse stratégique :

1. **Multi-Wallet Manager** - Gestion et agrégation de portefeuilles multi-chaînes
2. **Jito Bundle Executor** - Exécution atomique de transactions groupées sur Solana
3. **AI Sentiment Analyzer** - Analyse de sentiment avec ajustement automatique des stratégies
4. **Alpaca Bridge** - Pont vers la finance traditionnelle (actions/ETFs)
5. **Circuit Breaker** - Système de protection et gestion des risques
6. **Trading Orchestrator** - Orchestration globale de tous les modules

## Architecture

```
src/lib/modules/
├── multiWalletManager.ts    # Gestion multi-wallet
├── jitoBundle.ts             # Jito Bundle atomique
├── aiSentiment.ts            # Analyse IA et sentiment
├── alpacaBridge.ts           # Pont TradFi via Alpaca
├── circuitBreaker.ts         # Circuit breaker & risques
├── orchestrator.ts           # Orchestration globale
└── index.ts                  # Exports centralisés
```

## 1. Multi-Wallet Manager

### Fonctionnalités
- Agrégation de soldes en temps réel (Solana, Ethereum, Base, Arbitrum)
- Synchronisation automatique toutes les 30 secondes
- Support de listeners pour mises à jour réactives

### Utilisation

```typescript
import { createMultiWalletManager } from '@/lib/modules';

const manager = createMultiWalletManager();

const portfolio = await manager.aggregateBalances(
  [
    { address: 'SOL_ADDRESS_1', chain: 'solana' },
    { address: 'ETH_ADDRESS_1', chain: 'ethereum' },
    { address: 'BASE_ADDRESS_1', chain: 'base' },
  ],
  { sol: 150, eth: 3200 }
);

console.log(`Total: $${portfolio.totalBalanceUsd}`);

manager.startAutoSync(wallets, prices, 30000);

manager.subscribe((portfolio) => {
  console.log('Portfolio updated:', portfolio);
});
```

### Données Retournées

```typescript
{
  totalBalanceUsd: 45230.50,
  wallets: [
    {
      address: "...",
      chain: "solana",
      balance: 150.5,
      balanceUsd: 22575,
      status: "active"
    }
  ],
  byChain: {
    solana: { count: 5, totalUsd: 30000 },
    ethereum: { count: 3, totalUsd: 15230.50 }
  },
  lastSync: 1675890123456
}
```

## 2. Jito Bundle Executor

### Fonctionnalités
- Exécution atomique de jusqu'à 27+ transactions simultanées
- Protection MEV intégrée
- Support de simulation avant exécution
- Actions de consolidation et distribution

### Utilisation

```typescript
import { createJitoBundleExecutor } from '@/lib/modules';
import { Keypair } from '@solana/web3.js';

const executor = createJitoBundleExecutor();

const wallets = [
  Keypair.fromSecretKey(Buffer.from(key1, 'hex')),
  Keypair.fromSecretKey(Buffer.from(key2, 'hex')),
];

const result = await executor.executeAtomicMultiWalletAction(
  wallets,
  'consolidate',
  'MASTER_WALLET_ADDRESS'
);

console.log(`Bundle ${result.bundleId}: ${result.status}`);
```

### Actions Supportées

- **consolidate** : Regroupe tous les fonds vers un wallet maître
- **distribute** : Distribue un montant identique à plusieurs wallets
- **custom** : Exécution de transactions personnalisées

### Résultat

```typescript
{
  bundleId: "abc123...",
  status: "submitted" | "confirmed" | "failed",
  transactions: [
    { signature: "...", wallet: "...", status: "pending" }
  ],
  timestamp: 1675890123456
}
```

## 3. AI Sentiment Analyzer

### Fonctionnalités
- Analyse de sentiment via GPT-4 (-1 à +1)
- Ajustement automatique des tailles de position
- Recommandations d'exposition au risque
- Fallback intelligent si API indisponible

### Utilisation

```typescript
import { createAISentimentAnalyzer } from '@/lib/modules';

const analyzer = createAISentimentAnalyzer(OPENAI_API_KEY);

const analysis = await analyzer.analyzeMarketSentiment(
  "Bitcoin up 5%, ETH consolidating, market fear index at 45",
  50000,
  8.5
);

console.log(`Sentiment: ${analysis.sentiment.label} (${analysis.sentiment.score})`);
console.log(`Recommended exposure: ${analysis.adjustment.recommendedExposure}%`);

const newSize = analyzer.calculateDynamicPositionSize(
  1000,
  analysis.sentiment,
  analysis.adjustment
);
```

### Résultat

```typescript
{
  sentiment: {
    score: 0.65,
    label: "bullish",
    confidence: 0.82,
    factors: [...]
  },
  adjustment: {
    positionSizeMultiplier: 1.5,
    riskLevel: "high",
    recommendedExposure: 70,
    stopLossAdjustment: 0,
    reasoning: "Strong bullish indicators..."
  },
  marketConditions: {
    volatility: 0.42,
    trend: "up",
    volume: 50000
  },
  recommendations: [
    "Increase position sizes moderately",
    "Monitor for reversal signals"
  ]
}
```

## 4. Alpaca Bridge (TradFi)

### Fonctionnalités
- Diversification automatique vers actions/ETFs
- Rebalancing portfolio crypto/actions
- Conversion automatique des profits
- Support mode Paper et Live

### Configuration

```typescript
import { createAlpacaBridge } from '@/lib/modules';

const bridge = createAlpacaBridge({
  keyId: process.env.ALPACA_KEY_ID,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
});
```

### Utilisation

```typescript
const account = await bridge.getAccount();
console.log(`Buying power: $${account.buyingPower}`);

const orders = await bridge.diversifyToStocks(
  5000,
  ['SPY', 'QQQ', 'VTI']
);

const rebalanceResult = await bridge.rebalancePortfolio(
  {
    cryptoAllocation: 70,
    stockAllocation: 30,
    targetSymbols: ['SPY', 'BND'],
    rebalanceThreshold: 5
  },
  totalCryptoValue
);

const profitOrders = await bridge.autoConvertProfits(
  cryptoProfitUsd,
  1000
);
```

### Stratégies de Diversification

- **SPY** : S&P 500 (stabilité)
- **QQQ** : Nasdaq 100 (tech growth)
- **VTI** : Total Stock Market (diversification maximale)
- **BND** : Bond Index (sécurité)

## 5. Circuit Breaker

### Fonctionnalités
- Protection contre les drawdowns excessifs
- Limites de pertes journalières
- Détection de séries de pertes consécutives
- Cooldown automatique configurable
- Métriques de performance (Sharpe ratio, volatilité)

### Configuration

```typescript
import { createCircuitBreaker } from '@/lib/modules';

const breaker = createCircuitBreaker({
  maxDrawdownPct: 10,
  maxDailyLossPct: 5,
  maxConsecutiveLosses: 5,
  cooldownMinutes: 60,
  autoRecovery: true,
});
```

### Utilisation

```typescript
breaker.subscribe((event) => {
  if (event.type === 'tripped') {
    console.error(`🔴 TRADING HALTED: ${event.reason}`);
  }
  if (event.type === 'warning') {
    console.warn(`⚠️ WARNING: ${event.reason}`);
  }
});

const check = await breaker.checkRiskLimits(currentPortfolioValue, {
  profit: -150,
  timestamp: Date.now()
});

if (!check.allowed) {
  console.log(`Trade blocked: ${check.reason}`);
}

const state = breaker.getState();
console.log(`Current drawdown: ${state.metrics.currentDrawdown}%`);
console.log(`Sharpe ratio: ${state.metrics.sharpeRatio}`);
```

### Limites par Défaut

| Métrique | Limite | Action |
|----------|--------|--------|
| Drawdown max | 10% | Stop immédiat |
| Perte journalière | 5% | Stop immédiat |
| Pertes consécutives | 5 | Stop immédiat |
| Cooldown | 60 min | Avant reprise |

## 6. Trading Orchestrator

### Fonctionnalités
- Coordination de tous les modules
- Analyses IA périodiques automatiques
- Rebalancing TradFi automatique
- Enregistrement et analytics des trades
- Event system pour monitoring

### Configuration

```typescript
import { createTradingOrchestrator } from '@/lib/modules';

const orchestrator = createTradingOrchestrator({
  enableAI: true,
  enableCircuitBreaker: true,
  enableTradFiDiversification: false,
  autoRebalance: false,
  rebalanceIntervalMinutes: 1440,
  aiAnalysisIntervalMinutes: 60,
});
```

### Initialisation

```typescript
await orchestrator.initialize(
  walletManager,
  aiAnalyzer,
  alpacaBridge,
  circuitBreaker
);

orchestrator.subscribe((event) => {
  switch(event.type) {
    case 'analysis_complete':
      console.log('AI analysis:', event.data);
      break;
    case 'circuit_breaker':
      console.error('Circuit breaker event:', event.event);
      break;
    case 'portfolio_update':
      console.log('Portfolio:', event.portfolio);
      break;
  }
});

await orchestrator.start();
```

### Flux de Travail

```
┌─────────────────────┐
│  Start Orchestrator │
└──────────┬──────────┘
           │
           ├─► Multi-Wallet Sync (30s)
           ├─► AI Analysis (60min)
           ├─► Circuit Breaker Check
           ├─► TradFi Rebalance (24h)
           └─► Event Broadcasting
```

### Enregistrement des Trades

```typescript
orchestrator.recordTrade(profitUsd);

const state = orchestrator.getState();
console.log(`Win rate: ${state.stats.winRate}%`);
console.log(`Total P&L: $${state.stats.totalPnL}`);
```

### Ajustement Dynamique

```typescript
const recommendedSize = orchestrator.getRecommendedPositionSize(1000);
```

## Intégration Complète

### Exemple de Setup Global

```typescript
import {
  createMultiWalletManager,
  createJitoBundleExecutor,
  createAISentimentAnalyzer,
  createAlpacaBridge,
  createCircuitBreaker,
  createTradingOrchestrator,
} from '@/lib/modules';

const walletManager = createMultiWalletManager();
const jitoExecutor = createJitoBundleExecutor();
const aiAnalyzer = createAISentimentAnalyzer(process.env.OPENAI_API_KEY);
const alpacaBridge = createAlpacaBridge({
  keyId: process.env.ALPACA_KEY_ID,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
});
const circuitBreaker = createCircuitBreaker();

const orchestrator = createTradingOrchestrator({
  enableAI: true,
  enableCircuitBreaker: true,
  enableTradFiDiversification: true,
  autoRebalance: true,
  rebalanceIntervalMinutes: 1440,
  aiAnalysisIntervalMinutes: 60,
});

await orchestrator.initialize(
  walletManager,
  aiAnalyzer,
  alpacaBridge,
  circuitBreaker
);

orchestrator.subscribe((event) => {
  console.log('Orchestrator event:', event);
});

await orchestrator.start();
```

## Variables d'Environnement

Ajoutez au fichier `.env` :

```env
OPENAI_API_KEY=sk-...
ALPACA_KEY_ID=PK...
ALPACA_SECRET_KEY=...
```

## Sécurité

### Bonnes Pratiques

1. **Clés API** : Jamais exposées côté client, toujours en edge functions
2. **Permissions Alpaca** : Désactiver les retraits
3. **Circuit Breaker** : Toujours actif en production
4. **Multi-signature** : Pour wallets de grande valeur
5. **Audit des logs** : Traçabilité complète via Supabase

## Monitoring

La page `/orchestration` offre :

- Statut en temps réel de tous les modules
- Métriques de performance
- Analyse IA actualisée
- Limites de risque visuelles
- Events log complet
- Actions rapides (analyse, bundle, rebalance)

## Performance

| Opération | Temps Moyen |
|-----------|-------------|
| Agrégation 10 wallets | ~2s |
| Jito Bundle (5 tx) | ~500ms |
| AI Analysis | ~3-5s |
| Alpaca Order | ~1s |
| Circuit Breaker Check | <10ms |

## Extensibilité

Les modules sont conçus pour être :

- **Modulaires** : Utilisables indépendamment
- **Type-safe** : Full TypeScript
- **Testables** : Interfaces claires
- **Observable** : Event system complet
- **Configurables** : Tous paramètres ajustables

## Roadmap

- [ ] Support Phantom Mobile
- [ ] Intégration Base & Arbitrum natives
- [ ] AI Model fine-tuning sur données historiques
- [ ] Dashboard mobile optimisé
- [ ] Multi-utilisateurs & team trading
- [ ] API externe pour bots tiers

## Support

Pour questions techniques : voir code source dans `src/lib/modules/`

---

**IKB-Copybot v2.0** - Advanced Trading Orchestration Platform
