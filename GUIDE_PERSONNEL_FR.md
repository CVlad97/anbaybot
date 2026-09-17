# ANBAYBOT — Guide personnel en français

## 1. Ce qui est réel et ce qui ne l’est pas

ANBAYBOT sépare volontairement trois états :

1. **Observation** : lecture des marchés et calculs, sans ordre.
2. **Paper trading / simulation** : ordres fictifs, statistiques et tests, sans argent réel.
3. **Réel avec validation humaine** : une action peut être préparée mais elle ne doit être soumise qu’après contrôle du risque et confirmation explicite dans le portefeuille ou l’interface prévue.

Un résultat de démonstration, un backtest ou une simulation n’est **jamais** une preuve de gain réel. Une preuve de gain réel doit être rattachable à une transaction effectivement exécutée, à ses frais, à son prix d’entrée/sortie et au P&L net réalisé.

## 2. Portefeuilles personnels

Le principe de sécurité du projet est : **ne jamais copier une seed phrase, une clé privée ou un mot de passe de portefeuille dans GitHub, Supabase, un log, un ticket ou un message**.

Les portefeuilles compatibles avec l’interface doivent être connectés depuis la page **Portefeuilles** par leur mécanisme officiel de connexion/signature. Le serveur peut connaître une adresse publique ; il ne doit pas posséder la clé privée.

### À faire manuellement

- Ouvrir ANBAYBOT depuis le navigateur du portefeuille ou l’extension officielle.
- Cliquer sur **Connecter**.
- Vérifier l’adresse publique affichée.
- Refuser toute transaction dont le montant, le réseau, le jeton ou le destinataire n’est pas compris.
- Ne jamais transmettre la phrase de récupération à ANBAYBOT.

## 3. Passage progressif vers le réel

Le protocole conseillé pour valider le logiciel est technique et mesurable :

- **Étape A — simulation** : au moins 100 décisions enregistrées avec frais/slippage simulés.
- **Étape B — stabilité** : vérifier taux de réussite, P&L net, drawdown maximal, profit factor et erreurs d’exécution.
- **Étape C — micro-montant réel** : seulement après validation des métriques, avec une taille d’ordre plafonnée à un montant que l’on accepte de perdre entièrement.
- **Étape D — augmentation éventuelle** : aucune augmentation automatique après une perte ; les limites de risque et le kill switch restent actifs.

## 4. Objectif +1 € et +1 000 €

Il n’existe pas de durée universelle pour gagner 1 €. Elle dépend du capital, du rendement net réellement obtenu, de la fréquence des opérations, des frais et des pertes.

Le simulateur de la page **Revenus & P&L** utilise :

`rendement quotidien requis = ((capital + objectif) / capital)^(1 / jours) - 1`

Exemples purement mathématiques pour viser **+1 000 € en 7 jours**, hors frais et sans supposer que ces rendements sont réalisables :

- Capital 100 € : environ **40,85 % net/jour** requis.
- Capital 1 000 € : environ **10,41 % net/jour** requis.
- Capital 5 000 € : environ **2,64 % net/jour** requis.
- Capital 10 000 € : environ **1,37 % net/jour** requis.
- Capital 100 000 € : environ **0,142 % net/jour** requis.

Ces chiffres ne sont pas des prévisions. Ils montrent seulement la contrainte mathématique de l’objectif.

## 5. Marchés prédictifs et contrats à terme

ANBAYBOT ne doit pas exécuter automatiquement une position sur un marché prédictif ou un contrat à terme tant que les points suivants ne sont pas validés :

- disponibilité juridique et contractuelle pour l’utilisateur et sa juridiction ;
- API officielle et conditions d’utilisation à jour ;
- mode test ou simulation ;
- calcul des frais, spread, liquidation et slippage ;
- limites de taille et perte journalière ;
- validation manuelle de l’ordre réel.

Pour Polymarket ou toute autre plateforme de prédiction, l’intégration doit commencer par une **source de données en lecture seule** et une **simulation de prise de position**. Le passage au réel vient seulement après vérification technique et réglementaire à jour.

## 6. Paramètres de sécurité déjà prévus dans le projet

Le dépôt contient notamment :

- `ALLOW_LIVE_TRADING=false` par défaut ;
- `MAX_TRADE_USDT` pour limiter la taille d’ordre ;
- une phrase de confirmation explicite ;
- un kill switch ;
- des limites de risque et un pipeline de validation.

Ces garde-fous doivent rester actifs durant les tests.

## 7. Ce qu’il faut faire manuellement avant un vrai ordre

1. Reconnecter le VPS dans Remote Desktop Commander.
2. Vérifier les variables d’environnement côté serveur sans afficher les secrets.
3. Vérifier que les clés API d’exchange sont limitées au trading nécessaire et sans droit de retrait lorsqu’une plateforme le permet.
4. Vérifier que `ALLOW_LIVE_TRADING` reste `false` pendant les tests.
5. Exécuter la suite de tests, le typecheck, le lint et le build.
6. Lancer le paper trading et enregistrer les résultats nets.
7. N’activer un micro-test réel qu’après lecture et validation de chaque ordre.

## 8. Critère de « preuve de gain »

Le bot ne doit afficher **gain réel confirmé** que si les éléments suivants sont disponibles :

- ordre effectivement exécuté ;
- horodatage ;
- quantité ;
- prix moyen d’entrée ;
- prix moyen de sortie ;
- frais ;
- P&L net réalisé ;
- identifiant d’ordre ou transaction vérifiable.

Sans ces éléments, le résultat doit rester étiqueté **simulation**, **paper trading** ou **non vérifié**.
