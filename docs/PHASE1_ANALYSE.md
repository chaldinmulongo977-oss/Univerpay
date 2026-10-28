# UniPay — Phase 1 (analyse) et départ de la Phase 2

## Principes d'architecture
- Rôle = table `user_role_assignments`, écrite uniquement par le serveur (service_role). Aucun rôle ne vient du navigateur.
- `has_permission(code, faculty)` est la source unique pour RLS ET pour les contrôles serveur Next.js.
- Rôles à périmètre facultaire : dean, vice_dean, faculty_secretary, faculty_delegate*, avec `faculty_id` obligatoire.
- Invitations : jeton aléatoire côté serveur, seul son hash SHA-256 est stocké.
- Audit : ajout seul (trigger bloquant). Dernier super_admin protégé par trigger.

## Provisionnement du premier super_admin (procédure opérateur)
1. Créer le compte via Supabase Auth (tableau de bord ou invitation).
2. Dans l'éditeur SQL, en tant qu'opérateur : insérer une ligne `user_role_assignments` avec le rôle `super_admin`.
3. Aucun mot de passe ni e-mail privilégié dans Git.

## À valider avec l'université (bloquants)
- Noms et codes officiels des 5 facultés, filières, système de promotions.
- Politique téléphone (obligatoire ou non) et consentement parent/étudiant.
- Compte marchand SasPay, identifiants de test, documentation d'authentification et de webhooks.

## Suite
Migration 0002 : étudiants, inscriptions, documents. 0003 : admissions. 0004 : finances. Puis socle Next.js.
