# ANBAYBOT — État de reprise, 28 septembre 2026

Branche de réparation : fix/verified-dashboard-20260928, base 22eabde.
Projet Supabase confirmé : ANBAYBOT (lmfwtiytqwedrazxjnwu).
Sauvegarde backend avant correction : /opt/vlad/backups/anbaybot-20260928/anbaybot-public-v14.ts.

## Livré et testé
- Prix MEXC : utiliser price sur ticker/price.
- Appels externes bornés à 3,5 s, lectures de wallets parallèles, cache complet 60 s.
- Lecture du tableau de bord indépendante par source ; données inconnues affichées « — ».
- Valorisation partielle signalée, erreurs de wallet visibles.
- Ancien scan marqué « À actualiser », observations anciennes « Historique ».
- Bascule silencieuse en démo interdite lors de l'enregistrement des recettes.
- Proposition de service pilote à 49 € ; abonnements toujours fermés, aucune promesse SLA.
- Contrôles VPS déterministes, sans LLM, journal compact sur changement.
- 13 tests de régression, typecheck, lint et build validés sur le VPS.
- Smoke API production validé. Les statuts financiers restent bloquants.

## Limites établies
- Registres LIVE et business : zéro écriture / zéro gain au contrôle.
- Challenge PAPER terminé : -0,4548738 %, 1 position clôturée ; aucune preuve de profit LIVE.
- Binance : clés absentes. MEXC : lecture privée en échec HTTP 400.
- Scanner horaire : cron actif mais réponse 401 ; absence d'en-tête admin attendu.
- Coffre existant : URL de projet et clé publique uniquement ; aucun jeton admin utilisable trouvé dans le répertoire secret Anbaybot du VPS.
- Données financières agrégées accessibles sans authentification : cockpit public impropre à une commercialisation multiclient en l'état.
- RPC externes parfois lents ou limités (429). Une valorisation partielle ne représente pas le capital total.
- VPS : partition / annoncée 96 % par df au début de l'audit ; aucune suppression effectuée.

## Prochaine action exacte
Rétablir un accès admin dans l'espace sécurisé puis relier le scanner horaire avec un secret serveur à portée limitée.
Ne jamais envoyer ce secret dans le chat. Ne pas supprimer le contrôle d'authentification.
Séparer les données personnelles des pages publiques avant toute commercialisation des abonnements.
Vérifier Binance/MEXC en lecture, puis TEST ; activation LIVE et tout ordre à décision humaine.

## Prompt de reprise court
Reprends ANBAYBOT à partir d'AUTONOMY_STATUS.md et du dernier commit main ; ne repars pas de zéro.
Travaille sur /opt/vlad/projects/ANBAYBOT. Vérifie git status avant toute modification.
Priorité : secret serveur du scanner 401, confidentialité des données publiques, connexion exchange en lecture,
puis parcours d'encaissement d'une prestation réellement livrable. Ne déplace aucun fonds, ne crée pas
de profit fictif et ne déclenche pas d'appel LLM payant. Utilise les scripts du VPS pour les contrôles,
les modèles locaux seulement pour une tâche textuelle précise. Budget d'un cycle : une anomalie,
une correction, tests ciblés, un compte rendu de 10 lignes. Si bloqué après deux tentatives,
conserve les preuves et passe à la tâche utile suivante. Mets à jour ce fichier avec commit,
tests, endpoints, limites et prochaine action. Un paiement n'est un gain qu'après preuve d'encaissement
et déduction des frais ; aucun gain futur garanti.
