# ANBAYBOT — AUTOPILOT SAFE

Objectif: continuer l'inventaire multi-wallets, la preuve de performance et la préparation des revenus sans déplacer de fonds sans validation humaine.

## Règles absolues
- Ne jamais demander, lire, stocker ou afficher seed phrase, private key, mot de passe, OTP ou code 2FA.
- Ne jamais signer ni diffuser de transaction blockchain.
- Ne jamais effectuer de retrait, bridge, swap, stake, supply, borrow, futures ou transfert réel sans validation explicite du propriétaire.
- Ne jamais désactiver le kill switch LIVE automatiquement.
- Les secrets API restent dans Supabase/les providers; ne jamais les copier dans Git/GitHub/logs.
- Toutes les mesures PAPER doivent être séparées des gains LIVE.

## Priorité 1 — état de service
1. Vérifier https://cvlad97.github.io/anbaybot/
2. Vérifier anbaybot-public health/portfolio/challenge.
3. Vérifier ikb-api exchange/health.
4. Lancer npm run smoke:prelaunch si disponible.
5. Journaliser les résultats horodatés.

## Priorité 2 — exchanges
- Tant que BINANCE ou MEXC = NOT_CONFIGURED/ERROR: aucun ordre.
- Si READ_ONLY: vérifier soldes et permissions uniquement.
- Si TEST_READY: conserver le kill switch LIVE actif; ne pas passer en réel automatiquement.
## Priorité 3 — wallets confirmés / à surveiller
- Phantom SOLANA: 7m1cvZEyTifAoaPKfqxULm32eTxQaCBZn2MajZBdJeH3
- Solflare SOLANA: 2WPnFeLnjH9NbXSPnoXKJsuypPEaNPn2b3go1UQgefVi
- Trust Wallet TRON principal: utiliser le registre Supabase external_accounts_registry.
- Trust Wallet Base/Ethereum: utiliser les adresses déjà enregistrées dans le registre.
- Solana historique Grass: F4cevCJyb1bftVG1C53pdpMQ95khtzdP9S6hviqjYwy9 = audit/watch-only.

## Adresses candidates à auditer, jamais présumer qu'elles sont contrôlées
- EVM: 0x7f4658b1d3B5530670b83C340fec604c0611559c
- SOL: HXSvpH7aS8zhCvmf3k884wHyFAcMxw1jCdzUGqHbBjCa
- POLYGON: 0x2e19D0c16447d1811896b5B8604919AB97a4893e
- SOL: HXWSzfEQpoNxzfbWLVmttJhfDaJWmabZm7MG99adkucy
- ETH: 0xDa95675c41348c31D7A9D303bd359dc1af37D184
- ETH: 0xA666DB376124d372682cAF56A400b21AC1214508
- EVM: 0xbd5b476a811f58f8cea8518E7B8427daB704f1c0
- BTC: bc1qcevznvjm2kkmrj8vnsz5lz9hx4apq5z5laddv7

## Adresse tierce interdite
- TKd4KjoLfsRsmk8BfXGq2eP4aG2KGHXeQW = adresse envoyée par traderswealths.com; ne pas la considérer comme wallet utilisateur et ne jamais y envoyer de fonds.
## Priorité 4 — revenu
- JustLend MCP officiel est installé sous /opt/vlad/tools/mcp-server-justlend.
- Utiliser les outils READ ONLY pour lire APY, balances et rewards.
- Comparer rendement net après frais/energy; ne préparer qu'un brouillon d'opération, jamais signer.
- Continuer le challenge 48 h PAPER avec frais/slippage réels simulés.
- Calculer par wallet: valeur, revenu potentiel/jour, frais estimés, risque, seuil économique minimal.
- Ignorer les tokens sans liquidité vérifiable.

## Priorité 5 — consolidation
- Destination préférée: Revolut en EUR/SEPA après conversion/off-ramp sur exchange vérifié.
- Route USDT -> Revolut désactivée: l'USDT a été retiré de l'offre Revolut du compte utilisateur.
- Ne jamais activer une route de consolidation sans vérifier le bénéficiaire, le réseau et un test faible montant.

## Sortie attendue à chaque cycle
- health_site, health_backend, exchange_status, challenge_pnl, wallet_changes, yield_opportunities, blockers.
- Écrire un JSON horodaté dans logs/autopilot/.
- Si anomalie critique: ne rien exécuter et marquer STOP/NO-GO.
