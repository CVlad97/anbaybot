import { useState } from 'react';
import { Briefcase, Copy, CreditCard, Lock } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

const PROPOSAL = "Je propose une séance de 45 minutes pour installer un tableau de suivi de vos actifs à partir de données publiques ou d'un export que vous fournissez, puis vous remettre un récapitulatif des sources et limites. Prix pilote proposé : 49 €, à confirmer sur devis avec la fiscalité applicable. Aucun accès à vos clés privées, aucune opération sur vos fonds, aucun rendement promis. Le rendez-vous et le livrable sont convenus avant facturation.";

export default function SubscriptionsPage() {
  const [notice, setNotice] = useState('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(PROPOSAL); setNotice('Proposition copiée. Aucun message envoyé et aucun paiement créé.'); }
    catch { setNotice('Sélectionnez et copiez le texte ci-dessous.'); }
  };
  return <div className="animate-fade-in">
    <PageHeader icon={CreditCard} title="Première recette & offres" subtitle="Une proposition, une prestation livrée, un paiement constaté : trois étapes distinctes." />
    <section className="card p-5 mb-6">
      <div className="flex items-center gap-3"><Briefcase size={22} className="text-brand-400" /><h2 className="font-semibold text-white">Pilote de service · proposition à valider</h2></div>
      <p className="text-3xl font-bold text-white mt-4">49 € <span className="text-sm font-normal text-surface-400">prix de travail, pas un encaissement</span></p>
      <p className="text-sm text-surface-300 mt-3">Installation d’un tableau de suivi et prise en main pendant 45 minutes, avec un récapitulatif des sources et limites. Le client conserve ses accès et la maîtrise de ses fonds.</p>
      <ol className="list-decimal list-inside text-sm text-surface-400 space-y-2 mt-4">
        <li>Confirmer le périmètre, le prix final et le rendez-vous sur un devis.</li>
        <li>Livrer le tableau de suivi et la prise en main convenus.</li>
        <li>Vérifier le paiement sur le compte d’encaissement avant de l’inscrire au registre.</li>
      </ol>
      <label htmlFor="pilot-proposal" className="block text-sm text-surface-300 mt-5 mb-2">Proposition à personnaliser</label>
      <textarea id="pilot-proposal" className="input w-full min-h-44" rows={7} readOnly value={PROPOSAL} />
      <button className="btn-secondary flex items-center gap-2 mt-3" onClick={copy}><Copy size={16} />Copier la proposition</button>
      {notice && <p role="status" className="text-xs text-brand-300 mt-3">{notice}</p>}
      <p className="text-xs text-surface-500 mt-4">Une vente à 49 € représente 49 € de chiffre d’affaires brut. Les frais, charges et le temps de travail restent à déduire. Aucun client ni revenu n’est garanti.</p>
    </section>
    <section className="card p-5 mb-6">
      <h2 className="font-semibold text-white flex items-center gap-2"><Lock size={18} />Abonnements en préparation</h2>
      <p className="text-sm text-surface-400 mt-3">Les souscriptions payantes restent fermées : séparation des comptes clients, confidentialité des données, paiement et activation des droits doivent encore être validés ensemble.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <div className="rounded-xl border border-surface-800 p-4"><h3 className="text-white font-semibold">Pro · 49 €/mois envisagés</h3><p className="text-xs text-surface-400 mt-2">Suivi et rapports. Périmètre et conditions à confirmer.</p><button className="btn-secondary mt-4 w-full" disabled>Pas encore commercialisé</button></div>
        <div className="rounded-xl border border-surface-800 p-4"><h3 className="text-white font-semibold">Entreprise · sur devis</h3><p className="text-xs text-surface-400 mt-2">Installation et accompagnement selon un besoin validé. Aucun engagement de disponibilité publié.</p><button className="btn-secondary mt-4 w-full" disabled>Pas encore commercialisé</button></div>
      </div>
    </section>
    <p className="text-xs text-surface-500">Le cockpit actuel sert à l’observation et aux essais. Il ne constitue pas un service de gestion de fonds pour des clients.</p>
  </div>;
}
