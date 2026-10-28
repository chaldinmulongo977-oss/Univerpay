# Base de données UniPay — migrations 0001 à 0006

Ordre d'exécution : `supabase db push` (ou éditeur SQL) dans l'ordre numérique. Non exécuté ni testé : à lancer d'abord sur un projet Supabase de test.

| Migration | Contenu |
|---|---|
| 0001 | Université, années, facultés, filières, promotions, rôles, permissions, profils, affectations, invitations, audit, RLS de base |
| 0002 | Système LMD (cycle + niveau), 6 facultés, filières Informatique |
| 0003 | Étudiants, inscriptions, parents (consentement), documents (bucket privé), personnel, représentants, matrice rôles-permissions |
| 0004 | Admissions : campagnes, candidats, candidatures, séances, matières, notes (saisie ≠ validation), décisions (publication ≠ décision), conversion en étudiant |
| 0005 | Barèmes versionnés, factures figées, tentatives, paiements, événements webhook idempotents, reçus uniques, banque, règlements, écritures en ajout seul, remboursements, `confirm_payment()` |
| 0006 | Budget (séparé de la comptabilité), notifications, annonces, réclamations, demandes de représentants, courrier, KPI |

## Garanties portées par la base
- Rôle `student` automatique ; aucune écriture de rôle depuis le navigateur ; dernier super_admin protégé.
- Doyen/adjoint/secrétaire : accès limité à leur faculté (`has_permission(code, faculté)`). Paritaire : toutes facultés, sans accès paiements/comptabilité.
- Parent : accès seulement si lien `approved` et portée (`invoices`, `academic`...) accordée.
- Paiement confirmé uniquement par `confirm_payment()` (service_role) : vérifie montant et devise, solde, idempotence, crée allocation, reçu unique et écritures.
- Webhook rejoué : refusé par l'unicité (fournisseur, événement, transaction).
- Écritures comptables, mouvements budgétaires et audit : modification et suppression bloquées.
- Comptable et administrateur du budget : permissions distinctes, aucune politique croisée.
- KPI : fonctions `kpi_enrollment`, `kpi_students_by_program`, `kpi_billing`, `kpi_settlement_gap` ; nouveaux/anciens calculés depuis l'historique d'inscriptions valides ; devises jamais additionnées entre elles.

## Reste à faire côté base
- Comptes comptables réels (`PROVIDER_RECEIVABLE`, `TUITION_REVENUE` sont des codes provisoires à remplacer par le plan comptable de l'université).
- Fonctions serveur : acceptation d'invitation, consentement et approbation parent, remboursements exécutés, rappels d'échéance (tâche planifiée).
- Tests pgTAP pour les politiques RLS (`supabase/tests/`).
