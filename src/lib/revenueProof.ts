import type { PublicStrategy, PublicReadiness } from './publicApi';

export type ProofSnapshot = {
  checkedAt: string;
  ledger: { count: number; recentCount: number; recentNetUsd: number; withReference: number; verification: string };
  business: { count: number };
  walletCount: number;
  readiness: PublicReadiness;
  strategies: PublicStrategy[];
  paper: { mode: string; returnPct: number | null; endedAt: string | null } | null;
};
export type RevenueModule = {
 id: string; name: string; category: string; platform: string; state: string;
 next: string; automation: string; evidence: string; sources: string[];
};
export const RESEARCH_DATE = '2026-09-28';
export const REVENUE_MODULES: RevenueModule[] = [
  {
    "id": "lending",
    "name": "Prêt de stablecoins",
    "category": "Capital",
    "platform": "Aave",
    "state": "Rendement variable",
    "next": "Comparer le taux disponible, le réseau et les frais de sortie avant tout dépôt.",
    "automation": "Lire positions et intérêts ; aucun dépôt automatique.",
    "evidence": "Relevé du dépôt, intérêts acquis, retrait et frais. Le capital rendu est exclu.",
    "sources": [
      "https://www.aave.com/help/supplying/supply-tokens"
    ]
  },
  {
    "id": "farming_lp",
    "name": "Farming & liquidité",
    "category": "Capital",
    "platform": "Uniswap / pools DeFi",
    "state": "Capital exposé",
    "next": "Identifier une position détenue et comparer sa valeur à une simple conservation des tokens.",
    "automation": "Observer frais et liquidité ; aucune signature automatique.",
    "evidence": "Frais encaissés moins gas et perte de valeur ; retrait documenté.",
    "sources": [
      "https://support.uniswap.org/hc/en-us/articles/37113550065549-What-are-the-risks-when-providing-liquidity"
    ]
  },
  {
    "id": "earn_staking",
    "name": "Earn & staking",
    "category": "Capital",
    "platform": "Compte CEX / on-chain",
    "state": "Éligibilité à confirmer",
    "next": "Rétablir la lecture du compte et relever les produits réellement accessibles.",
    "automation": "Suivre récompenses et échéances après connexion en lecture.",
    "evidence": "Historique des récompenses créditées, frais et disponibilité du retrait.",
    "sources": [
      "https://www.aave.com/help/supplying"
    ]
  },
  {
    "id": "arbitrage",
    "name": "Arbitrage",
    "category": "Marchés",
    "platform": "MEXC / Binance",
    "state": "Net non démontré",
    "next": "Vérifier les deux carnets, la profondeur, les frais et les transferts avant une simulation.",
    "automation": "Comparaison de prix uniquement.",
    "evidence": "Deux exécutions rapprochées, tous frais, inventaire et retrait ; un spread brut ne suffit pas.",
    "sources": [
      "https://www.mexc.com/api-docs/spot-v3/market-data-endpoints/symbol-price-ticker"
    ]
  },
  {
    "id": "funding_capture",
    "name": "Funding capture",
    "category": "Marchés",
    "platform": "Futures",
    "state": "Risque de liquidation",
    "next": "Documenter la couverture, la marge et les frais ; le funding peut changer de signe.",
    "automation": "Observation et simulation.",
    "evidence": "Funding reçu moins frais, coût de couverture et pertes des deux positions.",
    "sources": []
  },
  {
    "id": "futures_directional",
    "name": "Futures directionnels",
    "category": "Marchés",
    "platform": "MEXC / Binance",
    "state": "Simulation uniquement",
    "next": "Valider les connexions et mesurer plusieurs essais avec pertes incluses.",
    "automation": "Aucun ordre réel automatique.",
    "evidence": "Historique complet des clôtures, frais et liquidations, puis retrait.",
    "sources": []
  },
  {
    "id": "spot_momentum",
    "name": "Spot momentum",
    "category": "Marchés",
    "platform": "MEXC / Binance",
    "state": "Simulation uniquement",
    "next": "Comparer le résultat net au simple achat-conservation sur la même période.",
    "automation": "Scans et simulations.",
    "evidence": "Achats/ventes rapprochés et frais ; hausse du portefeuille seule insuffisante.",
    "sources": []
  },
  {
    "id": "grid_dca",
    "name": "Grid & DCA",
    "category": "Marchés",
    "platform": "CEX",
    "state": "Simulation uniquement",
    "next": "Séparer capital versé, stock restant et profit réalisé.",
    "automation": "Scans et simulations.",
    "evidence": "Ordres exécutés, coût de revient, frais et inventaire restant.",
    "sources": []
  },
  {
    "id": "copy_trading",
    "name": "Copy-trading",
    "category": "Marchés",
    "platform": "CEX / on-chain",
    "state": "Compte non validé",
    "next": "Vérifier un historique complet et les coûts de réplication.",
    "automation": "Observation uniquement.",
    "evidence": "Résultat de ton propre compte, incluant positions perdantes et frais.",
    "sources": []
  },
  {
    "id": "prediction_markets",
    "name": "Prédictions",
    "category": "Marchés",
    "platform": "Polymarket",
    "state": "France : nouvelles positions restreintes",
    "next": "Vérifier résidence et règles applicables ; l’emplacement du VPS ne prouve pas ton éligibilité.",
    "automation": "Lecture publique ; aucune mise ni contournement.",
    "evidence": "Marché résolu, coût d’achat, frais et versement effectif. Aucun gain acquis ici.",
    "sources": [
      "https://docs.polymarket.com/api-reference/geoblock"
    ]
  },
  {
    "id": "prolific",
    "name": "Études rémunérées",
    "category": "Sans capital",
    "platform": "Prolific",
    "state": "Action humaine",
    "next": "Vérifier admission, pays et compte PayPal, puis répondre personnellement à une étude disponible.",
    "automation": "Suivi des justificatifs ; aucune réponse ni réservation par bot.",
    "evidence": "Étude approuvée + versement PayPal. Seuil publié £6/$6 ; attente possible.",
    "sources": [
      "https://participant-help.prolific.com/en/articles/445063-when-can-i-cash-out",
      "https://www.prolific.com/resources/how-prolific-detects-bots-and-ai-in-online-research"
    ]
  },
  {
    "id": "usertesting",
    "name": "Tests utilisateurs",
    "category": "Sans capital",
    "platform": "UserTesting",
    "state": "Action humaine",
    "next": "Vérifier admission et tests correspondant réellement à ton profil.",
    "automation": "Suivi uniquement ; tes retours et ta voix sont nécessaires.",
    "evidence": "Test validé + paiement reçu. Délai annoncé généralement 14 jours.",
    "sources": [
      "https://www.usertesting.com/get-paid-to-test"
    ]
  },
  {
    "id": "brave",
    "name": "Publicités récompensées",
    "category": "Récompenses",
    "platform": "Brave Rewards",
    "state": "BAT, pas euros encaissés",
    "next": "Vérifier disponibilité locale et compte de versement dans ton navigateur personnel.",
    "automation": "Usage réel uniquement ; pas de vues ni clics artificiels.",
    "evidence": "BAT effectivement crédités ; conversion et frais séparés de la valeur estimée.",
    "sources": [
      "https://brave.com/brave-rewards/",
      "https://brave.com/privacy/browser/"
    ]
  },
  {
    "id": "grass",
    "name": "Bande passante",
    "category": "Récompenses",
    "platform": "Grass",
    "state": "VPS inadapté",
    "next": "Vérifier le client officiel et une connexion résidentielle autorisée. Aucun client installé ici.",
    "automation": "Client officiel sur connexion éligible ; pas de proxy ni multi-comptes.",
    "evidence": "Points ≠ tokens reçus ≠ argent retiré ; déduire les coûts réseau.",
    "sources": [
      "https://www.grass.io/learn/grass-stuck-on-connecting-here-s-the-fix/"
    ]
  },
  {
    "id": "quests",
    "name": "Quêtes & airdrops",
    "category": "Récompenses",
    "platform": "Galxe",
    "state": "Récompense incertaine",
    "next": "Vérifier chaque campagne, éligibilité, allocation et frais de claim ; aucun achat prescrit.",
    "automation": "Veille seulement tant que les règles de la campagne ne sont pas validées.",
    "evidence": "Allocation attribuée et reçue ; points, XP et loteries exclus du revenu encaissé.",
    "sources": [
      "https://help.galxe.com/en/articles/10373007-introducing-galxe-rewards-hub",
      "https://help.galxe.com/en/articles/12829115-understanding-claim-fees"
    ]
  },
  {
    "id": "microsoft_rewards",
    "name": "Recherches récompensées",
    "category": "Récompenses",
    "platform": "Microsoft Rewards",
    "state": "Bons / points",
    "next": "Vérifier pays, catalogue et utilité des récompenses pour tes dépenses habituelles.",
    "automation": "Recherches personnelles manuelles ; bots et macros exclus.",
    "evidence": "Bon réellement obtenu, suivi à part ; les points n’ont pas de valeur en espèces.",
    "sources": [
      "https://www.microsoft.com/en-us/servicesagreement"
    ]
  },
  {
    "id": "publisher_ads",
    "name": "Publicité sur le site",
    "category": "Audience",
    "platform": "AdSense",
    "state": "Audience à construire",
    "next": "Vérifier admissibilité du site, contenu utile et trafic réel avant intégration.",
    "automation": "Mesurer le trafic autorisé ; ne jamais générer de faux clics ou impressions.",
    "evidence": "Relevé des recettes validées et paiement reçu ; aucun trafic ni revenu audité ici.",
    "sources": [
      "https://support.google.com/adsense/answer/16737?hl=en"
    ]
  },
  {
    "id": "referral",
    "name": "Affiliation",
    "category": "Audience",
    "platform": "Programme à sélectionner",
    "state": "Programme non connecté",
    "next": "Choisir un programme adapté à une audience réelle, puis vérifier ses conditions.",
    "automation": "Suivi des conversions autorisé par le programme ; aucun spam.",
    "evidence": "Commission validée, délai de rétractation terminé et paiement reçu.",
    "sources": []
  },
  {
    "id": "saas",
    "name": "Abonnements du site",
    "category": "Audience",
    "platform": "Anbaybot",
    "state": "Après preuve personnelle",
    "next": "Priorité aux résultats de tes propres comptes avant de vendre des abonnements.",
    "automation": "Commercialisation en attente.",
    "evidence": "Service livré, paiement reçu et coûts déduits ; aucun abonnement activé.",
    "sources": []
  }
];

export function yieldScenario(capital: number, annualPercent: number, days: number, costs: number) {
  if (![capital, annualPercent, days, costs].every(Number.isFinite) || capital < 0 || annualPercent <= -100 || days < 0 || costs < 0) return null;
  const gross = capital * (Math.pow(1 + annualPercent / 100, days / 365) - 1);
  return Number.isFinite(gross) ? { gross, net: gross - costs } : null;
}
export function evidenceLabel(snapshot: ProofSnapshot | null) {
  if (!snapshot) return 'Compte non lu';
  return snapshot.ledger.count === 0 ? 'Aucune écriture LIVE' : 'Écritures à rapprocher';
}
