import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
export default function SubscriptionsPage() {
 return <div className="animate-fade-in"><PageHeader icon={Lock} title="Commercialisation en attente" subtitle="Priorité aux résultats de tes propres comptes."/>
 <section className="card p-6"><h2 className="text-xl font-semibold text-white">Valider un gain avant de vendre le service</h2>
 <p className="text-surface-400 text-sm mt-3">Les offres à 49 € et les souscriptions ne sont pas proposées à la vente. Le prochain jalon est un résultat personnel documenté, net de frais, avec preuve de versement.</p>
 <Link to="/" className="btn-primary inline-block mt-5">Ouvrir le cockpit de preuves</Link></section></div>;
}
