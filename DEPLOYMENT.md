# Déploiement sécurisé d’Anbaybot

Ce dépôt est une application **Vite + React + TypeScript**. Il ne s’agit pas d’un projet Next.js ou Prisma. Le frontend produit des fichiers statiques dans `dist/`; la logique sensible doit rester dans la fonction Supabase `ikb-api`.

## 1. Pré-requis

- Node.js `^20.19.0` ou `>=22.12.0`
- npm et le fichier `package-lock.json`
- un projet Supabase réservé à Anbaybot
- une clé Binance sans permission de retrait, uniquement si le cockpit réel est activé

## 2. Vérification locale

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

Le résultat publiable est le dossier `dist/`.

## 3. Variables frontend

Seules les variables préfixées par `VITE_` sont incluses dans le navigateur.

```env
VITE_BASE_PATH="/"
VITE_APP_BASE_URL="https://votre-domaine.example"
VITE_BACKEND_API_URL="https://<project-ref>.supabase.co/functions/v1/ikb-api"
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="<publishable-key>"
VITE_ANBAYBOT_DEMO_ENABLED="false"
VITE_ANBAYBOT_SAFE_MODE="true"
VITE_ANBAYBOT_LIVE_TRADING_ENABLED="false"
```

Ne jamais placer dans une variable `VITE_` : `SUPABASE_SERVICE_ROLE_KEY`, `BINANCE_API_SECRET`, `ANBAYBOT_ADMIN_TOKEN` ou une clé privée de portefeuille.

## 4. Supabase

### Base de données

Dans le projet Supabase **Anbaybot uniquement**, exécuter :

`supabase/ANBAYBOT_COMPLETE_SETUP.sql`

Le script :

- crée le schéma attendu par le frontend et `ikb-api`;
- active RLS;
- supprime les anciennes politiques publiques;
- retire tout accès direct à `anon` et `authenticated`;
- réserve les opérations à `service_role` côté serveur;
- initialise le kill switch à `true`.

Le script refuse de continuer lorsqu’il détecte une table `transactions`, `actions` ou `settings` appartenant à une autre application.

### Fonction Edge

Déployer `supabase/functions/ikb-api/index.ts`, puis définir les secrets serveur :

```env
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<secret-server-only>"
ANBAYBOT_ADMIN_TOKEN="<long-random-secret>"
ANBAYBOT_ALLOWED_ORIGINS="https://votre-domaine.example,https://cvlad97.github.io"
ALLOW_LIVE_TRADING="false"
BINANCE_API_KEY=""
BINANCE_API_SECRET=""
```

Conserver `ALLOW_LIVE_TRADING=false` tant que les ordres de test, les limites de risque et la confirmation humaine n’ont pas été vérifiés. Les retraits ne doivent pas être autorisés sur la clé Binance.

## 5. Hostinger

Anbaybot doit être publié comme **site statique Vite** :

1. Construire avec `npm ci && npm run build`.
2. Publier le contenu de `dist/` dans le répertoire web du domaine.
3. Utiliser `VITE_BASE_PATH=/` pour un domaine à la racine.
4. Conserver le fichier `public/.htaccess`; Vite le copie dans `dist/` et il renvoie les routes React vers `index.html`.
5. Ajouter le domaine Hostinger dans `ANBAYBOT_ALLOWED_ORIGINS` côté fonction Supabase.

Le projet GitHub actuel est en TypeScript. Il ne faut pas le recréer dans Hostinger Horizons comme une nouvelle application JavaScript, au risque de produire deux versions divergentes.

## 6. Vercel

`vercel.json` configure :

- le framework Vite;
- `npm ci`;
- la sortie `dist`;
- la réécriture des routes React vers `index.html`.

Après chaque déploiement, tester une route directe autre que `/` pour confirmer l’absence de page 404.

## 7. GitHub Pages

Le workflow `.github/workflows/pages-deploy.yml` publie une version de démonstration sécurisée. Il force :

- `VITE_ANBAYBOT_DEMO_ENABLED=true`;
- `VITE_ANBAYBOT_SAFE_MODE=true`;
- `VITE_ANBAYBOT_LIVE_TRADING_ENABLED=false`.

Aucun secret Binance ou `service_role` ne doit être stocké dans GitHub Pages.

## 8. Contrôles après déploiement

1. Ouvrir la page d’accueil puis une route interne directement.
2. Vérifier la santé de la fonction :

```bash
curl "https://<project-ref>.supabase.co/functions/v1/ikb-api?path=health"
```

3. Confirmer que `liveTradingEnabled` est `false`.
4. Confirmer que le kill switch est actif au premier démarrage.
5. Vérifier que les tables ne sont pas lisibles directement avec la clé publique.
