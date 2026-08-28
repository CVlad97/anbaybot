# Security

## Non-Negotiables

- Keep `ALLOW_LIVE_TRADING=false` until explicit human approval.
- Never expose secrets in the frontend.
- Never execute a real MEXC order from the frontend.
- Never copy production data without understanding the impact.

## Secret Handling

1. If a secret leaks, revoke it first.
2. Rotate the secret in the provider console.
3. Remove the value from Git history if needed.
4. Confirm the current repo does not contain the secret.

## Safe Mode

- Demo mode is allowed on GitHub Pages.
- Simulation must be clearly labelled.
- Real execution requires server-side confirmation.
- Buttons for unavailable paid offers must stay disabled.

## Current Security Notes

- The Supabase advisor output shows unrelated legacy issues in the project database.
- `ikb-api` must be deployed with `verify_jwt` disabled only because it uses custom admin-token auth.
- Public routes must stay read-only and free of secrets.
