# État d'avancement UniPay (livraison initiale)

## Écrit, non compilé ni testé
- Base : migrations 0001 à 0006 (organisation, rôles/permissions, étudiants, parents, documents, admissions, facturation, paiements, comptabilité, budget, KPI, RLS).
- Application : splash, onboarding, connexion, inscription, Google OAuth, mot de passe oublié/réinitialisation, vérification e-mail, invitations (création, révocation, acceptation avec contrôle d'e-mail), profil à compléter, compte désactivé, 403/404/erreur.
- Coque applicative responsive (menu latéral desktop, tiroir mobile), navigation selon permissions, contrôle serveur sur chaque page.
- Tableau de bord KPI (effectifs nouveaux/anciens, par filière, facturation par devise), graphique Recharts.
- Étudiant : factures, soldes, paiement via SasPay (montant fixé côté serveur), reçus imprimables.
- Finances : paiements confirmés, écart confirmé / réglé / non rapproché.
- Administration : facultés et filières (ajout manuel), utilisateurs et invitations.
- PWA : manifeste, icônes, service worker, page hors ligne, bandeaux installation/mise à jour/connexion perdue.
- Tests : unitaires (signature webhook, validation, redirection sûre, jetons) et e2e de base.

## Non réalisé
- Écrans : parents, doyen détaillé, paritaire (dossiers/documents), admissions (saisie des notes, délibération), secrétariats, budget, comité étudiant, délégations, réclamations, notifications, paramètres, journal d'audit. Les tables et la RLS existent ; il manque les pages.
- Attribution/révocation de rôles depuis l'interface (invitations uniquement).
- Envoi d'e-mails (le lien d'invitation est affiché à l'administrateur).
- Reçus PDF (reçu imprimable HTML à la place), rappels d'échéance, export, rapprochement bancaire (écran), remboursements.
- Tests RLS (pgTAP), tests de composants.

## À valider avec SasPay
Voir `docs/SASPAY_INTEGRATION.md` (section « Tests non exécutés ») : metadata dans verify/webhook, champs de verify, devises CDF/USD, carte bancaire, remboursements, choix de `fee_charge_mode`.
