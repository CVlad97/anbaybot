# Guide Orchestration - Auto-Configuration des Traders

## Vue d'ensemble

Le système d'orchestration IKB-Copybot récupère et gère automatiquement les adresses de traders depuis la base de données Supabase, avec correction automatique des formats d'adresse.

## Fonctionnalités Clés

### 1. Récupération Automatique des Traders

Le système charge automatiquement :
- Les **copy_traders** actifs depuis la table `copy_traders`
- Les **wallets** actifs depuis la table `wallets`
- Génère un trader de démonstration si aucune donnée n'existe

### 2. Auto-Correction des Adresses

Le système corrige automatiquement les adresses invalides :

#### Solana
- Vérifie le format base58 (32-44 caractères)
- Complète les adresses trop courtes
- Format attendu : `[1-9A-HJ-NP-Za-km-z]{32,44}`

#### Ethereum/Base/Arbitrum
- Ajoute le préfixe `0x` si absent
- Normalise à 42 caractères
- Format attendu : `0x[0-9a-fA-F]{40}`

### 3. Synchronisation en Temps Réel

Quand l'orchestrator est démarré :
- Synchronisation des métriques toutes les **30 secondes**
- Analyse IA toutes les **5 minutes** (configurable)
- Mise à jour automatique des événements
- Rechargement des traders à la demande

## Utilisation

### Page d'Orchestration

Accédez à `/orchestration` dans l'interface pour :

1. **Démarrer/Arrêter** l'orchestration
2. **Visualiser** les traders actifs avec leurs performances
3. **Monitorer** les métriques en temps réel
4. **Configurer** les modules (AI, Circuit Breaker, TradFi, Auto-Rebalance)
5. **Consulter** les événements récents
6. **Exécuter** des actions manuelles

### Boutons d'Action

| Bouton | Action |
|--------|--------|
| **Start/Stop** | Démarre/arrête l'orchestration globale |
| **Run AI Analysis Now** | Lance une analyse IA immédiate |
| **Reload Traders** | Recharge les traders depuis la DB |
| **Execute Jito Bundle** | Exécute un bundle multi-wallet |
| **Emergency Stop All** | Arrêt d'urgence complet |

## Hook useOrchestration

### API

```typescript
const {
  isRunning,           // État de l'orchestrator
  traders,             // Liste des traders actifs
  metrics,             // Métriques de performance
  sentiment,           // Analyse IA sentiment
  events,              // Log des événements
  config,              // Configuration des modules
  startOrchestrator,   // Fonction: démarrer
  stopOrchestrator,    // Fonction: arrêter
  toggleFeature,       // Fonction: toggle module
  runAIAnalysis,       // Fonction: analyse IA
  loadTraders,         // Fonction: reload traders
  autoCorrectAddresses // Fonction: correction auto
} = useOrchestration();
```

### Types de Données

#### TraderAddress
```typescript
{
  id: string;
  address: string;
  chain: 'solana' | 'ethereum' | 'base' | 'arbitrum';
  label?: string;
  isActive: boolean;
  profitLoss?: number;
  winRate?: number;
}
```

#### OrchestrationMetrics
```typescript
{
  portfolioValue: number;
  totalPnL: number;
  winRate: number;
  tradesExecuted: number;
  activeWallets: number;
  circuitBreakerStatus: 'active' | 'tripped' | 'cooldown';
}
```

#### SentimentData
```typescript
{
  score: number;           // -1 à 1
  label: 'bearish' | 'neutral' | 'bullish';
  confidence: number;      // 0 à 1
  exposure: number;        // 0 à 100
  lastUpdated: number;
}
```

## Flux de Travail

```
┌─────────────────────────────┐
│  Démarrage Orchestrator     │
└──────────┬──────────────────┘
           │
           ├─► Chargement traders depuis DB
           │   ├─ copy_traders (actifs)
           │   ├─ wallets (actifs)
           │   └─ Création démo si vide
           │
           ├─► Auto-correction adresses
           │   ├─ Solana: format base58
           │   ├─ EVM: format 0x...
           │   └─ Mise à jour DB si corrigé
           │
           ├─► Calcul métriques initiales
           │   ├─ Portfolio total_value
           │   ├─ Transactions count
           │   └─ Win rate moyen
           │
           ├─► Analyse IA initiale
           │   └─ Sentiment & recommandations
           │
           └─► Démarrage intervalles
               ├─ Métriques: 30s
               └─ IA: 5min
```

## Configuration Base de Données

### Tables Utilisées

#### copy_traders
```sql
- id (uuid, PK)
- wallet_address (text)
- chain (text)
- name (text)
- is_active (boolean)
- total_pnl (numeric)
- win_rate (numeric)
```

#### wallets
```sql
- id (uuid, PK)
- address (text)
- chain (text)
- label (text)
- is_active (boolean)
- balance (numeric)
```

#### portfolio
```sql
- id (uuid, PK)
- total_value (numeric)
- daily_pnl (numeric)
```

#### transactions
```sql
- id (uuid, PK)
- [autres colonnes pour count]
```

## Exemple d'Intégration

### Ajouter un Trader Manuellement

```typescript
// Via Supabase
await supabase.from('copy_traders').insert({
  wallet_address: '7X8kR9Y2JvKGnPqNzMxLw5THvFxpQr3...',
  chain: 'solana',
  name: 'Top Trader #1',
  is_active: true,
  total_pnl: 15.2,
  win_rate: 72.5
});

// Recharger dans l'UI
loadTraders();
```

### Ajouter un Wallet

```typescript
await supabase.from('wallets').insert({
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  chain: 'ethereum',
  label: 'Trading Wallet 1',
  is_active: true,
  balance: 5000
});
```

## Événements

Le système génère des événements en temps réel :

| Type | Description | Couleur |
|------|-------------|---------|
| `info` | Information générale | Gris |
| `analysis` | Résultat analyse IA | Bleu |
| `trade` | Exécution de trade | Vert |
| `warning` | Avertissement | Jaune |
| `rebalance` | Rebalancement portfolio | Violet |

## Sécurité

### Auto-Correction
- Les corrections sont appliquées **avant** tout usage
- Mise à jour automatique dans la DB
- Validation stricte des formats
- Logs de toutes les corrections

### Circuit Breaker
- Protection drawdown max: **10%**
- Perte journalière max: **5%**
- Pertes consécutives max: **5**
- Cooldown: **60 minutes**

## Débogage

### Vérifier les Traders
```sql
SELECT * FROM copy_traders WHERE is_active = true;
SELECT * FROM wallets WHERE is_active = true;
```

### Vérifier les Métriques
```sql
SELECT * FROM portfolio ORDER BY created_at DESC LIMIT 1;
SELECT COUNT(*) FROM transactions;
```

### Console Browser
```javascript
// Ouvrir DevTools et vérifier
console.log('Traders loaded:', traders.length);
console.log('Metrics:', metrics);
console.log('Sentiment:', sentiment);
```

## Performance

| Opération | Temps |
|-----------|-------|
| Chargement traders | ~500ms |
| Auto-correction | ~100ms/trader |
| Calcul métriques | ~300ms |
| Analyse IA (simulée) | ~2s |
| Sync complète | ~1-2s |

## Roadmap

- [ ] Websocket real-time pour DB changes
- [ ] Détection automatique de nouveaux traders
- [ ] Machine learning pour correction d'adresses
- [ ] Analytics avancées de performance
- [ ] Export des rapports PDF
- [ ] Alertes push/email

---

**IKB-Copybot Orchestration v2.0**
Gestion automatisée et intelligente des traders multi-chaînes
