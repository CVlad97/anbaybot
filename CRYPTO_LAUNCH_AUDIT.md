# CRYPTO LAUNCH AUDIT — ANBAYBOT

## Statut actuel

- Repo : anbaybot
- Chemin local : /root/vladclaw/anbaybot
- Branche : feat/live-controlled-crypto-cockpit
- Branche distante : feat/live-controlled-crypto-cockpit
- Base : main / 3600f92942bde9f996f46ccfc9b1b817d79ac4bb
- Binance public check : ajouté via `scripts/binance-public-check.mjs`
- Vérification locale : build, lint et typecheck à confirmer sur la branche rebasée.
- Vérification indépendante précédente : non concluante côté agent à cause d'une limite 429, pas une erreur de build.

## Secrets

Ne jamais afficher les valeurs. Lister seulement les noms et l'état présent/absent dans l'environnement d'exécution.

### Secrets à vérifier par nom uniquement

- BINANCE_API_KEY : à vérifier côté serveur
- BINANCE_API_SECRET : à vérifier côté serveur
- BINANCE_BASE_URL : à vérifier côté serveur
- MEXC_API_KEY : à vérifier côté serveur
- MEXC_API_SECRET : à vérifier côté serveur
- HELIUS_API_KEY : à vérifier côté serveur
- COINGECKO_API_KEY : à vérifier côté serveur
- VITE_SUPABASE_URL : à vérifier
- VITE_SUPABASE_ANON_KEY : à vérifier
- SUPABASE_SERVICE_ROLE_KEY : à vérifier côté serveur
- TRADING_MODE : à vérifier
- ACCOUNT_CONTROL_MODE : à vérifier
- ALLOW_LIVE_TRADING : à vérifier
- ALLOW_AUTONOMOUS_LIVE_TRADING : à vérifier
- ALLOW_SPOT_TRADING : à vérifier
- ALLOW_FUTURES_TRADING : à vérifier
- ALLOW_MARGIN_TRADING : à vérifier
- ALLOW_EARN_ACTIONS : à vérifier
- ALLOW_WITHDRAWALS : à vérifier
- REQUIRE_HUMAN_CONFIRMATION : à vérifier
- REQUIRE_2FA_MANUAL_CONFIRMATION : à vérifier
- MAX_TRADE_USDT : à vérifier
- MAX_DAILY_LOSS_USDT : à vérifier
- STOP_LOSS_PERCENT : à vérifier
- TAKE_PROFIT_PERCENT : à vérifier
- MIN_CONFIDENCE_SCORE : à vérifier
- MAX_LEVERAGE : à vérifier
- KILL_SWITCH : à vérifier

## Binance

### Public data

Le script `scripts/binance-public-check.mjs` vérifie publiquement :

- BTCUSDT 24h ticker
- ETHUSDT 24h ticker
- SOLUSDT 24h ticker
- BNBUSDT 24h ticker
- BTCUSDT exchangeInfo
- orderTypes
- filterTypes

Aucun secret n'est lu et aucun ordre n'est passé.

### Account / soldes réels

- Statut : non implémenté dans le check public.
- À faire : route serveur signée, sans exposition frontend.
- Règle : ne lire les soldes que côté serveur et uniquement si secrets présents.

### Order test

- Statut : à implémenter.
- Règle : `/api/v3/order/test` obligatoire avant tout ordre réel.

### Live order

- Statut : bloqué par défaut.
- Règle : pas de live sans variables explicites, test order réussi, limites de risque et confirmation humaine.

## Sécurité

- Mode paper par défaut : requis
- Live bloqué par défaut : requis
- Validation humaine : obligatoire
- 2FA manuelle pour actions irréversibles : obligatoire
- Kill switch : obligatoire
- Stop-loss : obligatoire
- Take-profit : obligatoire
- Pas de retrait automatique : obligatoire
- Pas de clé de retrait API : obligatoire
- Pas de futures/leverage autonome : obligatoire
- Pas de margin autonome : obligatoire
- Pas de martingale : obligatoire
- Pas de all-in : obligatoire

## Modes autorisés

1. `read_only` — balances, PnL, opportunités.
2. `paper` — simulation uniquement.
3. `spot_assisted` — ordre spot testé puis confirmé humainement.
4. `earn_assisted` — recommandations earn/farming avec confirmation humaine.
5. `futures_simulation` — simulation futures, pas d'exécution autonome.
6. `withdrawal_assisted` — assistance/checklist retrait, pas d'exécution autonome.

## Décision

Statut actuel : `PAPER ONLY / READ ONLY` tant que la lecture solde et l'ordre test Binance ne sont pas implémentés.

## Prochaine étape

Implémenter le cockpit `/trading` :

- prix Binance publics ;
- secrets détectés par nom uniquement ;
- lecture soldes côté serveur si secrets présents ;
- calcul capital tradable ;
- recommandations BUY / SELL / WAIT ;
- ordre test Binance ;
- validation humaine ;
- PnL ;
- kill switch ;
- journal d'audit.
