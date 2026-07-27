# Deployment

## Current Target

- Frontend: GitHub Pages
- Backend: Supabase Edge Function `ikb-api`
- Database project: `IKABAY` (`luqvqwpglceeqtbbtvuo`)
- Live trading: must remain disabled until every control is validated

## GitHub Pages

1. Set `VITE_BASE_PATH` to the repo folder, for example `/anbaybot/`.
2. Set `VITE_APP_BASE_URL` to the published app URL.
3. Provide public frontend variables in GitHub repository variables.
4. Run the workflow on `main`.
5. The build copies `dist/index.html` to `dist/404.html` for SPA refresh support.

## Backend

1. Keep `ALLOW_LIVE_TRADING=false`.
2. Configure the Supabase project secrets.
3. Deploy `ikb-api` only after migrations are coherent.
4. Confirm `/health` returns `mode: real_edge`.

## Manual Checks

- Refresh a deep route directly on GitHub Pages.
- Verify wallet deeplinks on mobile.
- Verify Stripe buttons stay disabled when links are absent.
- Verify the dashboard shows simulation clearly when live trading is off.

