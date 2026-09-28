# ANBAYBOT — Reprise du 28 septembre 2026

## Priorité utilisateur
Prouver les résultats de ses propres comptes avant de commercialiser le site.
URL canonique : https://cvlad97.github.io/anbaybot/
Dépôt : CVlad97/anbaybot. VPS : /opt/vlad/projects/ANBAYBOT.
Travail isolé : /opt/vlad/worktrees/anbaybot-20260928.
Projet Supabase : ANBAYBOT (lmfwtiytqwedrazxjnwu).

## Livré
- Accueil « Preuves de revenus » : 19 pistes, filtres, recherche, sources officielles,
  preuve exigée et automatisation permise. Ce catalogue ne représente pas 19 comptes connectés.
- 12 stratégies existantes + Prolific, UserTesting, Brave, Grass, Galxe, Microsoft Rewards et publicité éditeur.
- Calcul APY/durée/coûts explicitement hypothétique, jamais une prévision ou un gain personnel.
- Offres à 49 EUR et commercialisation mises en attente.
- 9 routes financières anbaybot-public et exchange/health ikb-api exigent un jeton propriétaire actif.
  Le header santé et les données de marché restent publics. Les jetons existants continuent à fonctionner.
- Plus de repli silencieux en démo pour les lectures ou écritures sur un backend réel défaillant.
- Les cinq tables financières inspectées ont RLS active et aucune politique publique.
- Scanner : secret serveur dédié dans Vault, validateur RPC autorisé seulement à service_role.
  Ce secret ne donne aucun accès admin ni ordre LIVE. Cron existant conservé à :17.
  Appels externes bornés 3,5 s, trois groupes de marché parallèles.
- Fonction anbaybot-public v16, ikb-api v16, revenue-scanner v11.
- Surveillance VPS sans LLM. Les contrôles privés sans token sont marqués NOT_CHECKED, jamais OK par défaut.

## Vérification
24 tests ciblés : prix/erreurs/timeout, absence de faux succès, confidentialité,
authentification du scanner, couverture du catalogue et calcul net.
Typecheck, lint, build validés sur VPS. Smoke production :
accessibilité + refus anonyme des dix routes privées, pas une certification de rentabilité.
La lecture du cockpit avec le jeton réel du propriétaire reste à vérifier depuis sa session.
Dernier scan ponctuel avant réparation observé à 15:12 UTC ; cron de 15:17 encore 401.
Après réparation : requête 530 -> HTTP 200, liveExecution=false, 12 stratégies examinées,
0 nouvelle observation car heure déjà enregistrée. Le journal append-only est préservé.
Le nouvel horaire écrira au cycle suivant (:17), à vérifier alors.
Les doublons horaires sont ignorés au lieu de déclencher un UPDATE interdit.
Fenêtre de fraîcheur 90 minutes pour un cron horaire.
Publication initiale 1367019 : CI, Pages et smoke confidentialité réussis.
Navigateur : 19 fiches, filtre Sans capital = 2, recherche Polymarket = 1,
calcul APY modifiable et pages privées verrouillées hors connexion.

## Blocages financiers
Aucune preuve indépendante d'encaissement rapprochée. Ne pas présenter un capital,
une écriture, une référence, un APY ou un résultat PAPER comme un profit encaissé.
Connexions privées d'exchange à corriger depuis les réglages serveur sécurisés.
Valorisation on-chain parfois partielle (RPC/limites). Pas d'ordre, pari, dépôt,
retrait ou installation de client de bande passante effectué par cette reprise.
Polymarket : restrictions personnelles à vérifier, nouvelles positions restreintes en France.
Grass : connexion résidentielle requise, VPS inadapté. Études/tests : participation humaine.
Points Microsoft : bons distincts des espèces. Aucun bot de faux clics, recherches ou sondages.
VPS presque plein au précédent audit ; aucun fichier utilisateur supprimé.

## Suite exacte
1. Ouvrir Accès propriétaire sur le site avec le jeton existant, sans le transmettre dans le chat.
2. Vérifier le cockpit privé et rétablir Binance/MEXC en lecture seulement.
3. Identifier les positions/revenus déjà détenus, obtenir les exports de comptes et versements.
4. Implémenter un rapprochement par référence, date, devise et frais ; capital transféré exclu.
5. Valider chaque module séparément, sur une période définie, pertes et coûts inclus.
6. Ne commercialiser qu'après cette preuve et une revue distincte du service client.

## Prompt court de reprise
Lis AUTONOMY_STATUS.md et git status sur le VPS. Reprends le dernier main sans réauditer
tout le projet. Priorité : lecture des comptes personnels puis rapprochement d'un versement réel.
Une anomalie, une correction, tests ciblés, preuve vérifiable. Scripts déterministes sans LLM
payant ni dépôt de fonds. Ne crée pas de faux revenu, ne contourne pas un blocage géographique,
ne lance pas d'ordre. Mets à jour ce fichier avec tests, commit, limites et prochaine action.
