# Intégration SasPay — alignée sur le SKILL.md SasPay et https://docs.saspay.me

Base : `https://api.saspay.me/api/v1` · Auth : `Authorization: Bearer sk_test_…` (dev) / `sk_live_…` (prod), serveur uniquement.

## Variables d'environnement
`SASPAY_API_KEY`, `SASPAY_WEBHOOK_SECRET` (signing_secret, affiché une seule fois), `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`.
Vérification : `npm run check:saspay` (lit `.env.local`, n'affiche jamais la clé).

## Routes utilisées (et seulement celles-ci)
| Usage | Route | Fichier |
|---|---|---|
| Paiement hébergé (mobile money, carte, autres) | `POST /checkout-sessions/` | `src/server/integrations/saspay/client.ts` |
| Vérification (seul `SUCCESS` confirme) | `GET /payments/{payment_id}/verify/` | idem |
Non utilisées : softpay, retry, payouts, wallet-transfers, payment-links (donc pas d'`Idempotency-Key` à gérer aujourd'hui ; à ajouter avant tout usage de ces routes).

## Règles appliquées
- Montants en chaînes décimales (`"2500.00"`), fixés par le serveur à partir du solde de la facture.
- `/checkout-sessions/` n'accepte pas d'Idempotency-Key : double clic géré en réutilisant la tentative `pending` (30 min).
- Webhook : signature HMAC-SHA256 de `timestamp.corpsBrut`, tolérance 300 s, comparaison en temps constant ; réponse 2xx immédiate puis traitement via `after()` ; unicité (fournisseur, événement, transaction) en base.
- Le webhook ne confirme rien : il déclenche `verify`. Confirmation unique via `confirm_payment()` (service_role), qui contrôle montant, devise, solde, idempotence, crée allocation, reçu unique et écritures.
- Comptabilité : `charged` (débité au payeur) et `net_amount` (reçu par l'université) ; frais = charged − net.
- Événements `settlement.*` ignorés (contenu non garanti). `transaction.cancelled` = état terminal non réussi.
- Erreurs : 401 (clé invalide, pas de nouvel essai), 403, 409, 422, 429 (message utilisateur, aucun nouvel essai en boucle). Rien de technique n'est renvoyé au navigateur.
- Reprise : `/api/cron/payments` (Bearer `CRON_SECRET`) retraite les événements non traités. `vercel.json` la lance 1 fois par jour (limite du plan gratuit) ; passer à `*/10 * * * *` sur un plan payant.

## Décision métier à prendre : `fee_charge_mode`
Non envoyé pour l'instant (valeur par défaut de SasPay). `ADD_ON` : le payeur paie les frais en plus (l'université reçoit le montant de la facture). `DEDUCTED` : frais prélevés sur le montant. La facture est créditée du montant demandé dans les deux cas.

## Tests non exécutés (à faire avec une clé sk_test_)
1. `npm run check:saspay` (RDC listée, devises CDF/USD, réseaux et exigences OTP dans `/pricing/my-rates/`).
2. Un checkout de test complet puis `verify` jusqu'à un statut final.
3. Événement `webhook.test` depuis le tableau de bord (valide la signature).
4. **NON VÉRIFIÉ** : SasPay renvoie-t-il `metadata` (donc `attempt_id`) dans `verify` ou dans le webhook ? Le code en dépend pour relier un paiement à sa tentative ; sinon l'événement reste « unmatched » et non traité. Alternative à tester : `GET /checkout-sessions/{id}/status/`.
5. **NON VÉRIFIÉ** : noms exacts des champs de `verify` utilisés (`status`, `net_amount`, `debited_amount`, `amounts.charged`, `currency`, `network_code`).
6. Carte bancaire et devises : à activer et confirmer dans le tableau de bord marchand.

## Hors périmètre actuel
Retraits (IP à whitelister), transferts de portefeuille, remboursements (aucune route confirmée).
