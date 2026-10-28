# PWA — stratégie de cache
- Manifeste : `public/manifest.webmanifest` ; icônes 192, 512 et maskable dans `public/icons`.
- Service worker : `public/sw.js`, enregistré en production par `PwaProvider`.
- Mis en cache : `/_next/static/*`, `/icons/*`, `/offline.html`, `/logo.svg`.
- Jamais mis en cache : pages authentifiées, `/api/*`, Supabase, SasPay, documents, reçus.
- Navigation hors ligne : `offline.html`. Aucun paiement hors ligne (bouton désactivé + bandeau).
- Mise à jour : bandeau « nouvelle version » ; `SKIP_WAITING` puis rechargement.
