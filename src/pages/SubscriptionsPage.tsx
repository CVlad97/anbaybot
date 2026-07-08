import { useState } from 'react';
import {
  CreditCard, CheckCircle2, Zap, Shield, Lock, Sparkles,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import type { SubscriptionPlan } from '../lib/types';

const PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    priceEur: 0,
    priceUsd: 0,
    interval: 'monthly',
    features: [
      'Dashboard de base',
      'Signaux live (limité à 5/jour)',
      '1 portefeuille connecté',
      'Historique 7 jours',
      'Mode paper trading',
    ],
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceEur: 49,
    priceUsd: 49,
    interval: 'monthly',
    features: [
      'Dashboard complet + P&L avancé',
      'Signaux live illimités',
      '10 portefeuilles connectés',
      'Historique illimité',
      'Trading automatique (validation requise)',
      'Monitoring 24/7',
      'Support prioritaire email',
      'Export CSV des données',
    ],
    highlighted: true,
    stripeLink: 'https://buy.stripe.com/test_pro_123',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceEur: 149,
    priceUsd: 149,
    interval: 'monthly',
    features: [
      'Tout ce qui est dans Pro',
      'Portefeuilles illimités',
      'API access + webhooks',
      'Stratégies custom',
      'Multi-comptes Binance',
      'SLA 99.9% uptime',
      'Support dédié 24/7',
      'Déploiement privé GitHub Pages',
      'Formation équipe (2h)',
    ],
    highlighted: false,
    stripeLink: 'https://buy.stripe.com/test_enterprise_456',
  },
];

function formatPrice(usd: number, eur: number) {
  if (usd === 0) return 'Gratuit';
  return (
    <span>
      <span className="text-3xl font-bold text-white">${usd}</span>
      <span className="text-surface-400 ml-1">/mois</span>
      <br />
      <span className="text-xs text-surface-500">Soit {eur}€ TTC</span>
    </span>
  );
}

export default function SubscriptionsPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubscribe = (plan: SubscriptionPlan) => {
    if (plan.id === 'free') {
      setSelectedPlan('free');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      return;
    }

    if (plan.stripeLink) {
      // Simulated: would normally redirect to Stripe
      setSelectedPlan(plan.id);
      setShowSuccess(true);
      alert(`🔗 Redirection vers Stripe: ${plan.stripeLink}\n\nMode démo: abonnement ${plan.name} activé !`);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={CreditCard}
        title="Souscriptions"
        subtitle="Choisissez le plan adapté à votre activité de trading"
      />

      {showSuccess && selectedPlan && (
        <div className="mb-6 rounded-2xl border border-brand-500/30 bg-brand-500/10 px-5 py-4 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-brand-400 shrink-0" />
          <div>
            <p className="text-sm text-brand-200 font-semibold">
              Abonnement {PLANS.find(p => p.id === selectedPlan)?.name} activé avec succès !
            </p>
            <p className="text-xs text-surface-400">Bienvenue sur le plan {PLANS.find(p => p.id === selectedPlan)?.name}.</p>
          </div>
        </div>
      )}

      {/* Plan comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={`card p-6 flex flex-col transition-all duration-300 ${
              plan.highlighted
                ? 'border-brand-500/50 ring-1 ring-brand-500/30 scale-[1.02] md:scale-105'
                : 'hover:border-surface-700'
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">
                Recommandé
              </div>
            )}

            <div className="text-center mb-6">
              <div className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center ${
                plan.id === 'free' ? 'bg-surface-800' : plan.highlighted ? 'bg-brand-600/20' : 'bg-warn-600/10'
              }`}>
                {plan.id === 'free' ? (
                  <Lock size={20} className="text-surface-400" />
                ) : plan.highlighted ? (
                  <Zap size={20} className="text-brand-400" />
                ) : (
                  <Sparkles size={20} className="text-warn-400" />
                )}
              </div>
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <div className="mt-2">{formatPrice(plan.priceUsd, plan.priceEur)}</div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-surface-300">
                  <CheckCircle2 size={14} className="text-brand-400 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe(plan)}
              disabled={selectedPlan === plan.id && showSuccess}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                plan.id === 'free'
                  ? 'bg-surface-800 text-surface-300 hover:bg-surface-700 border border-surface-700'
                  : plan.highlighted
                    ? 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-600/20'
                    : 'bg-surface-800 text-white hover:bg-surface-700 border border-surface-700'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {selectedPlan === plan.id && showSuccess ? '✅ Activé' : plan.id === 'free' ? 'Commencer gratuitement' : `Souscrire au ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      {/* Feature comparison table */}
      <div className="card p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Shield size={16} className="text-brand-400" />
          Comparatif détaillé des fonctionnalités
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800 text-surface-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Fonctionnalité</th>
                <th className="text-center px-4 py-3 font-medium">Free</th>
                <th className="text-center px-4 py-3 font-medium">Pro</th>
                <th className="text-center px-4 py-3 font-medium">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Dashboard trading', '✅', '✅', '✅'],
                ['P&L Paper Trading', '✅ Basique', '✅ Avancé', '✅ Avancé'],
                ['Signaux live / jour', '5', 'Illimité', 'Illimité'],
                ['Portefeuilles', '1', '10', 'Illimité'],
                ['Historique', '7 jours', 'Illimité', 'Illimité'],
                ['Monitoring 24/7', '❌', '✅', '✅'],
                ['Export CSV', '❌', '✅', '✅'],
                ['API Access', '❌', '❌', '✅'],
                ['Support', 'Community', 'Email prioritaire', '24/7 dédié'],
                ['SLA Uptime', 'Aucun', '99.5%', '99.9%'],
                ['Déploiement privé', '❌', '❌', '✅'],
              ].map(([feature, free, pro, enterprise]) => (
                <tr key={feature} className="border-b border-surface-800/50 hover:bg-surface-900/40">
                  <td className="px-4 py-3 text-surface-200 font-medium">{feature}</td>
                  <td className="px-4 py-3 text-center text-surface-400 text-xs">{free}</td>
                  <td className="px-4 py-3 text-center text-brand-400 text-xs">{pro}</td>
                  <td className="px-4 py-3 text-center text-warn-400 text-xs">{enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stripe info */}
      <div className="mt-6 card p-4 border-l-4 border-l-brand-500/30">
        <div className="flex items-center gap-3">
          <CreditCard size={16} className="text-brand-400 shrink-0" />
          <p className="text-xs text-surface-400">
            Paiements sécurisés via <strong className="text-surface-200">Stripe</strong>. 
            Abonnement mensuel, annulable à tout moment. 
            Tous les prix sont TTC. Pas de frais cachés.
          </p>
        </div>
      </div>
    </div>
  );
}
