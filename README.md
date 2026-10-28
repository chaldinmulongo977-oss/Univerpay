# UniPay — Université Révérend Kim

Application web progressive (Next.js App Router, TypeScript strict, Tailwind, Supabase, SasPay).

## Démarrage
1. `npm install`
2. Créer un projet Supabase, puis copier `.env.example` vers `.env.local` et renseigner les valeurs.
3. Appliquer les migrations : `supabase db push` (dossier `supabase/migrations`, ordre 0001 à 0006).
4. Supabase > Authentication : activer Email, activer Google (client ID/secret), ajouter les URL de redirection
   `http://localhost:3000/auth/callback` et l'URL de production `/auth/callback`.
5. SasPay : générer une clé `sk_test_…`, créer le webhook `https://<domaine>/api/webhooks/saspay`, copier son `signing_secret`, puis `npm run check:saspay`.
6. Créer le premier super administrateur (voir `docs/PHASE1_ANALYSE.md`).
7. `npm run dev`

## Scripts
`npm run dev | build | typecheck | test | test:e2e`

## Déploiement Vercel
Importer le dépôt GitHub, renseigner les variables d'environnement de `.env.example`
(les secrets uniquement en « Server »), puis déployer. Ajouter l'URL Vercel dans Supabase (redirections) et le webhook
SasPay `https://<domaine>/api/webhooks/saspay` dans le tableau de bord SasPay.

## État d'avancement (honnête)
Voir `docs/ETAT.md`. Rien n'a été compilé ni exécuté lors de la génération : lancer `npm run typecheck` et `npm test` en premier.

## Documentation
`docs/DATABASE.md`, `docs/SASPAY_INTEGRATION.md`, `docs/PWA.md`, `docs/PHASE1_ANALYSE.md`.
