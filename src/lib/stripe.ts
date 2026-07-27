type StripePlanId = 'pro' | 'enterprise';

const STRIPE_PAYMENT_LINKS: Record<StripePlanId, string> = {
  pro: import.meta.env.VITE_STRIPE_PRO_PAYMENT_LINK || '',
  enterprise: import.meta.env.VITE_STRIPE_ENTERPRISE_PAYMENT_LINK || '',
};

export function getStripePaymentLink(planId: StripePlanId) {
  const link = STRIPE_PAYMENT_LINKS[planId].trim();
  return link.length > 0 ? link : null;
}

export function hasStripePaymentLinks() {
  return Boolean(getStripePaymentLink('pro') || getStripePaymentLink('enterprise'));
}

