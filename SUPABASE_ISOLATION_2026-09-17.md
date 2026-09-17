# ANBAYBOT — Supabase isolé (17/09/2026)

## Projet dédié
- Nom : `ANBAYBOT`
- Project ref : `lmfwtiytqwedrazxjnwu`
- Région : `us-east-1`
- URL publique : `https://lmfwtiytqwedrazxjnwu.supabase.co`
- Aucun mélange avec les projets DELIKREOL ou IKABAY.

## Mode sécurité par défaut
- `settings.kill_switch = true`
- IA désactivée par défaut.
- Aucune stratégie auto-trade activée.
- RLS activé sur toutes les tables opérationnelles.
- Aucun droit direct `anon` / `authenticated` sur les tables privées.
- Les opérations sensibles doivent passer par le backend/service role.
- La signature côté frontend reste désactivée dans GitHub Pages.

## Trois registres financiers
### 1. `trade_ledger`
Journal immuable des événements d'ordre/exécution.
Chaque ligne distingue `LIVE`, `PAPER` ou `TEST` et le type d'instrument (`SPOT`, `FUTURES`, `PERPETUAL`, `PREDICTION`, `DEX`, etc.).

### 2. `pnl_ledger`
Journal immuable des P&L, frais, funding et règlements.
Le P&L LIVE est donc séparé du PAPER/TEST et peut être rapproché avec une entrée du registre d'exécution.

### 3. `audit_ledger`
Journal immuable des événements sensibles.
Chaque entrée reçoit un hash SHA-256 de 64 caractères chaîné au hash précédent. Les insertions sont sérialisées par verrou transactionnel pour éviter une bifurcation du chaînage en concurrence.

## Tests réalisés
- Insertion `trade_ledger` en environnement `TEST` : OK.
- Tentative d'UPDATE du même événement : refusée par le trigger append-only : OK.
- Insertion `pnl_ledger` en environnement `TEST`, P&L net 0 : OK.
- Première entrée `audit_ledger` : hash SHA-256 généré : OK.
- Deuxième entrée d'audit après durcissement : `previous_hash` = hash précédent et nouveau hash de 64 caractères : OK.
- RLS vérifié sur les trois registres et sur les tables cœur : OK.
- `anon` ne peut ni lire ni insérer dans les registres : OK.
- Aucun événement LIVE et P&L LIVE = 0 au moment du contrôle.

## Audit Supabase
L'advisor sécurité ne conserve qu'une information `RLS enabled no policy`, volontaire : les rôles clients n'ont aucun GRANT et aucune policy publique. Les avertissements de `search_path` des fonctions ont été corrigés.

L'advisor performance a signalé la FK `pnl_ledger.trade_ledger_id` sans index ; l'index dédié a été ajouté. Les autres index sont marqués non utilisés car le projet vient d'être créé.

## GitHub Pages
Le workflow est désormais explicitement lié à ce projet Supabase dédié via URL + clé publishable. Aucune clé service-role ou clé privée n'est exposée dans le frontend. `VITE_ENABLE_TX_SIGNING=false` reste forcé pendant la phase d'intégration.

## Reste à connecter
Le backend `ikb-api` doit être déployé/configuré sur ce nouveau projet avec ses secrets propres (admin token et credentials d'exchange), sans réutiliser les secrets DELIKREOL/IKABAY. Le VPS `srv1729857` était hors ligne dans Remote Desktop Commander lors de cette migration ; la configuration serveur sera reprise dès que son agent Remote Desktop Commander sera de nouveau `online`.
