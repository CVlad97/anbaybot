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
- Validation navigateur mobile Playwright : OK après correction runtime
- Test trading public : scan signaux demo OK, aucun ordre réel envoyé
- Test Binance public : prix spot accessibles en lecture seule
- Test Binance Earn/Farming : refus sans clé API serveur, donc non testable proprement depuis GitHub Pages
- Mode reel prepare : Edge Function avec token admin, CORS limite, Binance signe cote serveur, test order Binance reel
- Variable GitHub `VITE_BACKEND_API_URL` configuree vers `https://luqvqwpglceeqtbbtvuo.supabase.co/functions/v1/ikb-api`

## Blocage réel identifié

Le front GitHub Pages était publié, mais il n'avait pas de backend opérationnel :

- aucune variable GitHub `VITE_SUPABASE_URL` configurée ;
- aucune variable GitHub `VITE_SUPABASE_ANON_KEY` configurée ;
- aucune fonction Supabase `ikb-api` trouvée sur les projets testés ;
- les accès directs aux tables Supabase depuis le front rendaient le comportement fragile ;
- les routes internes directes GitHub Pages pouvaient retourner 404 sans hash routing.
- le module de stratégies avait une boucle d'import runtime : les stratégies importaient `./index` pendant que `index.ts` les importait, ce qui cassait le rendu avec `Cannot access 'registry' before initialization`.
- la fonction Supabase `ikb-api` n'est pas encore deployee sur `luqvqwpglceeqtbbtvuo` au moment du test public : Supabase retourne `404 NOT_FOUND Requested function was not found`.

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
- Séparation du registre de stratégies dans `strategies/core.ts` pour supprimer la boucle d'import et éviter la page blanche.
- Refonte de `ikb-api` en backend reel :
  - routes privees protegees par `ANBAYBOT_ADMIN_TOKEN` ;
  - CORS limite aux origines configurees ;
  - compte Binance lu par requetes signees serveur ;
  - `/api/v3/order/test` Binance implemente pour les ordres test ;
  - ordres live refuses sauf `ALLOW_LIVE_TRADING=true` + phrase de confirmation exacte ;
  - Simple Earn liste en lecture signee, aucune souscription automatique.
- Suppression du mode demo par defaut dans GitHub Pages.
- Ajout d'une migration de durcissement retirant les politiques anon ouvertes.

## Gaps opérationnels restants

### Backend Supabase

- Déployer la fonction Edge `ikb-api`.
- Configurer les secrets Edge Function :
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANBAYBOT_ADMIN_TOKEN`
  - `BINANCE_API_KEY`
  - `BINANCE_API_SECRET`
  - `ALLOW_LIVE_TRADING=false`
  - `ALLOW_EARN_ACTIONS=false`
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
- Implémenter les appels Binance Simple Earn/Farming uniquement côté serveur avec clé API protégée.
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
