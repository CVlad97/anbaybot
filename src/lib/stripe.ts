type StripePlanId = 'pro' | 'enterprise';

const STRIPE_PAYMENT_LINKS: Record<StripePlanId, string> = {
  pro: import.meta.env.VITE_STRIPE_PRO_PAYMENT_LINK || 'https://buy.stripe.com/dRm14o8zSd4faDG3bXbwk00',
  enterprise: import.meta.env.VITE_STRIPE_ENTERPRISE_PAYMENT_LINK || 'https://buy.stripe.com/aFa3cweYg9S327ah2Nbwk01',
};

export function getStripePaymentLink(planId: StripePlanId) {
  const link = STRIPE_PAYMENT_LINKS[planId].trim();
  return link.length > 0 ? link : null;
}

export function hasStripePaymentLinks() {
  return Boolean(getStripePaymentLink('pro') || getStripePaymentLink('enterprise'));
}


export function isCommercialLaunchEnabled() {
  return String(import.meta.env.VITE_COMMERCIAL_LAUNCH || 'false').toLowerCase() === 'true';
}
