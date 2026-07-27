# Stripe Setup

## Current State

- The app reads payment links from:
  - `VITE_STRIPE_PRO_PAYMENT_LINK`
  - `VITE_STRIPE_ENTERPRISE_PAYMENT_LINK`
- If those variables are empty, the UI disables the paid offers and shows that the offer is temporarily unavailable.

## Manual Decisions Required

Before creating Stripe products or prices, confirm:

- product name
- billing currency
- billing cadence
- trial period
- refund policy
- target Stripe account

## Webhooks

Webhook support is not yet wired in the frontend code.
If you add it, the expected events are:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

## Safe Behavior

- Never redirect to a fake Stripe URL.
- Never expose secret keys in the browser.
- Leave paid actions disabled until a real payment link is configured and tested.

