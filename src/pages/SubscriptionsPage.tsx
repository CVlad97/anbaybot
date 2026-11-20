import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

const plans = [
  { name: 'Gratuit', price: '0 €', period: '', description: 'Découverte du cockpit public et du module de day trading en simulation.', status: 'Démonstration accessible' },
  { name: 'Pro', price: '49 €', period: '/mois', description: 'Abonnement envisagé pour le suivi de portefeuilles et les rapports. Fonctionnalités et conditions à confirmer avant souscription.', status: 'Tarif indicatif · ouverture à confirmer' },
  { name: 'Entreprise', price: '149 €', period: '/mois', description: 'Base tarifaire envisagée pour un besoin professionnel. Périmètre, installation et accompagnement à préciser sur devis.', status: 'Tarif indicatif · devis à établir' },
];

export default function SubscriptionsPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader icon={CreditCard} title="Tarifs & commercialisation" subtitle="Grille indicative du projet Anbaybot." />
      <p className="text-surface-400">Les offres payantes sont en préparation. Leur ouverture dépend de la validation du service, des conditions de vente et du cadre applicable. Le traitement fiscal et le prix final seront précisés avant engagement.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => (
          <section className="card p-6" key={plan.name}>
            <h2 className="text-xl font-semibold text-white">{plan.name}</h2>
            <p className="text-3xl font-bold text-white mt-4">{plan.price}<span className="text-base font-normal text-surface-400">{plan.period}</span></p>
            <p className="text-sm text-surface-400 mt-4">{plan.description}</p>
            <p className="text-sm text-brand-300 mt-4">{plan.status}</p>
          </section>
        ))}
      </div>
      <section className="card p-6">
        <h2 className="text-xl font-semibold text-white">Installation et prise en main</h2>
        <p className="text-surface-400 mt-3">Proposition pilote distincte de l’abonnement : 49 € pour une séance de 45 minutes consacrée à l’installation d’un tableau de suivi et à sa prise en main. Périmètre et tarif final à confirmer sur devis.</p>
      </section>
      <Link to="/day-trading" className="btn-primary inline-block">Tester le day trading en simulation</Link>
    </div>
  );
}
