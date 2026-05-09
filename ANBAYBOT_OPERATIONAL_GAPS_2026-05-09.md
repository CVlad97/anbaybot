# ANBAYBOT — Audit opérationnel GitHub Pages / Supabase / trading

Date : 2026-05-09

## Statut vérifié

- Repo : `CVlad97/anbaybot`
- Front public : `https://cvlad97.github.io/anbaybot/`
- Déploiement GitHub Pages : workflow OK
- Build local : OK
- Typecheck local : OK
- Lint local : OK
- Mode public actuel : `demo local contrôlé`

## Blocage réel identifié

Le front GitHub Pages était publié, mais il n'avait pas de backend opérationnel :

- aucune variable GitHub `VITE_SUPABASE_URL` configurée ;
- aucune variable GitHub `VITE_SUPABASE_ANON_KEY` configurée ;
- aucune fonction Supabase `ikb-api` trouvée sur les projets testés ;
- les accès directs aux tables Supabase depuis le front rendaient le comportement fragile ;
- les routes internes directes GitHub Pages pouvaient retourner 404 sans hash routing.

## Correctifs appliqués

- Passage du routage à `HashRouter` pour GitHub Pages.
- Suppression du workflow Pages doublon.
- Ajout de `404.html` et `.nojekyll`.
- Ajout d'un fallback Supabase local en `localStorage`.
- Ajout d'un mode API demo pour :
  - settings ;
  - audit logs ;
  - actions ;
  - signals ;
  - auto-trade config ;
  - AI config ;
  - trading cockpit ;
  - validation ;
  - ordres test bloqués en live.
- Ajout d'un bandeau public indiquant clairement le mode demo.

## Gaps opérationnels restants

### Backend Supabase

- Déployer la fonction Edge `ikb-api`.
- Appliquer les migrations Supabase `managed_wallets`, `followed_wallets`, `signals`, `actions`, `transactions`, `settings`, `audit_logs`, `wallet_balances`, `portfolio_snapshots`, `auto_trade_config`, `ai_config`.
- Configurer `SUPABASE_SERVICE_ROLE_KEY` uniquement côté Edge Function.
- Mettre des politiques RLS strictes si un accès direct front est conservé.

### GitHub Pages

- Configurer `VITE_SUPABASE_URL`.
- Configurer `VITE_SUPABASE_ANON_KEY` seulement si les accès client Supabase sont nécessaires.
- Garder le mode demo si le backend n'est pas prêt.

### Trading réel

- Garder le mode `paper` tant que l'ordre test Binance n'est pas implémenté.
- Implémenter `/api/v3/order/test` côté serveur avant tout ordre réel.
- Interdire les clés Binance avec permission retrait.
- Ajouter whitelist IP Binance si possible.
- Journaliser chaque validation, refus, ordre test et erreur.

### Sécurité

- Ne pas supprimer :
  - kill switch ;
  - limites de taille d'ordre ;
  - limites de pertes ;
  - confirmation humaine ;
  - blocage retraits ;
  - blocage futures/margin autonome.
- Ces garde-fous ne sont pas des freins commerciaux : ils évitent les pertes, blocages compte, erreurs irréversibles et problèmes réglementaires.

## Leviers pour améliorer la performance commerciale sans promettre de gain

- Stabiliser le cockpit en lecture réelle : soldes, PnL, signaux, audit.
- Prioriser le paper trading avec historique vérifiable.
- Afficher les opportunités classées par liquidité, volume, volatilité et risque.
- Ajouter un scoring lisible : pourquoi une opportunité est retenue ou rejetée.
- Mesurer les résultats en backtest/paper avant tout réel.
- Créer un tableau de suivi hebdomadaire : capital simulé, drawdown, win rate, erreurs évitées, opportunités refusées.

## Décision production

Le site public doit rester en `demo contrôlé` tant que le backend Supabase `ikb-api` n'est pas déployé.

Le passage en mode réel nécessite une validation humaine explicite après :

1. fonction Edge déployée ;
2. migrations appliquées ;
3. variables GitHub configurées ;
4. secrets Binance côté serveur ;
5. ordre test Binance OK ;
6. kill switch testé ;
7. logs audit vérifiés.
