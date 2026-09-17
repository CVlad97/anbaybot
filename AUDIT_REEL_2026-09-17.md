# ANBAYBOT — Audit réel du 17 septembre 2026

## État vérifié du dépôt

### Publication

- Le dépôt est `CVlad97/anbaybot`.
- Le front est publié par GitHub Pages à chaque push sur `main`.
- La modification ajoutant le simulateur d’objectif a passé la CI et le workflow GitHub Pages.

### Trading réel actuellement codé

Le backend `supabase/functions/ikb-api/index.ts` contient une intégration **MEXC Spot** :

- lecture des prix MEXC ;
- lecture du compte MEXC lorsque les secrets serveur sont configurés ;
- validation serveur des symboles autorisés et de la taille d’ordre ;
- endpoint `trading/order` ;
- mode `TEST` utilisant `/api/v3/order/test` ;
- mode `LIVE` utilisant `/api/v3/order` ;
- mode LIVE bloqué tant que `ALLOW_LIVE_TRADING=true` n’est pas activé côté serveur et tant que la phrase de confirmation exacte n’est pas fournie.

### Limites critiques actuelles

1. **SELL par montant USD est explicitement bloqué** tant que la gestion de quantité exacte n’est pas implémentée.
2. Le snapshot P&L renvoie actuellement `pnlUsd: 0` et `pnlPct: 0`.
3. `portfolio/summary` renvoie `null`.
4. `portfolio/history` renvoie une liste vide.
5. `earn/flexible/list` renvoie que MEXC flexible earn n’est pas implémenté.
6. Aucun code Polymarket n’est présent dans le dépôt au moment de cet audit.
7. Le moteur de recommandation MEXC choisit aujourd’hui essentiellement le meilleur momentum 24h parmi les prix disponibles, avec un seuil configurable ; ce n’est pas encore une preuve d’avantage statistique.

## Backend Supabase visible dans la connexion actuelle

La connexion Supabase accessible depuis ChatGPT expose :

- `Delikreol` — actif ;
- `IKABAY` — inactif.

Aucun projet Supabase explicitement nommé `ANBAYBOT` n’est exposé par cette connexion. Le dépôt contient une Edge Function nommée `ikb-api`, ce qui peut indiquer un backend partagé ou historique, mais l’association exacte du déploiement ANBAYBOT doit être vérifiée avant toute modification de production.

## Remote Desktop Commander

Au moment de cet audit, Remote Desktop Commander retourne : **aucun appareil disponible**. Le VPS ne peut donc pas être inspecté ni modifié depuis cette session jusqu’à reconnexion de l’appareil.

## Ce qui a été ajouté le 17 septembre 2026

- `src/components/GoalSimulator.tsx` : simulateur mathématique d’objectif de profit.
- intégration du simulateur dans `src/pages/EarningsPage.tsx`.
- `GUIDE_PERSONNEL_FR.md` : guide d’utilisation personnel en français.

Le simulateur distingue explicitement projection mathématique et gain réellement constaté.

## Objectif +1 000 € en sept jours : contrainte mathématique

Rendement quotidien composé requis :

`((capital + 1000) / capital)^(1/7) - 1`

Exemples :

- capital 100 € → ~40,85 % net/jour ;
- capital 1 000 € → ~10,41 % net/jour ;
- capital 5 000 € → ~2,64 % net/jour ;
- capital 10 000 € → ~1,37 % net/jour ;
- capital 100 000 € → ~0,142 % net/jour.

Ce sont des contraintes mathématiques, pas des rendements prévus ou garantis.

## Conditions minimales avant de considérer un gain comme réel

Un “gain réel confirmé” doit disposer de :

- ordre exécuté ;
- identifiant de transaction/ordre ;
- date/heure ;
- actif ;
- quantité ;
- prix moyen d’entrée ;
- prix moyen de sortie ;
- frais ;
- P&L net réalisé.

Tant que ces données ne sont pas stockées et rapprochées, l’interface doit afficher **simulation / non vérifié**.

## Actions manuelles indispensables

1. Reconnecter `srv1729857` à Remote Desktop Commander et vérifier qu’il apparaît `online`.
2. Identifier précisément l’URL backend ANBAYBOT et le projet Supabase réellement utilisé par cette URL.
3. Vérifier les variables serveur **sans afficher les valeurs secrètes** : présence MEXC, `ALLOW_LIVE_TRADING`, plafond d’ordre, symboles autorisés.
4. Pour une clé d’exchange utilisée par le bot : autoriser uniquement les permissions nécessaires ; ne pas activer le retrait lorsque la plateforme permet de séparer ces permissions.
5. Garder `ALLOW_LIVE_TRADING=false` pendant les tests.
6. Exécuter typecheck, lint, tests et build sur le VPS.
7. Tester `/api/v3/order/test` avec un micro-montant logique sans exécution financière.
8. Implémenter et tester le ledger paper-trading et le calcul de P&L réel avant toute augmentation de risque.
9. Connecter chaque portefeuille depuis son application/extension officielle ; **ne jamais transmettre de seed phrase ou clé privée au bot**.
10. Pour Polymarket ou autres marchés prédictifs : commencer en lecture seule + simulation après vérification actuelle de l’API, des conditions d’utilisation et de la disponibilité juridique pour l’utilisateur.

## Priorité technique suivante

Ordre recommandé :

1. rétablir l’accès VPS ;
2. identifier le backend Supabase réel ;
3. implémenter le ledger paper-trading avec entrée/sortie/frais/P&L ;
4. corriger SELL ;
5. tester 100+ décisions en simulation ;
6. ajouter les sources de marchés prédictifs en lecture seule ;
7. seulement ensuite envisager un micro-test réel avec validation humaine.
