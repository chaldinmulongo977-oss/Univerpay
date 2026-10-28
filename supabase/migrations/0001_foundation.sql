-- UniPay 0001 : fondation (organisation, rôles, permissions, invitations, audit, RLS)
create extension if not exists pgcrypto;

create table universities (
  id uuid primary key default gen_random_uuid(),
  name text not null, address text, contact_email text, timezone text not null default 'Africa/Kinshasa',
  currencies text[] not null default '{USD,CDF}', created_at timestamptz not null default now()
);

create table academic_years (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id),
  label text not null, starts_on date not null, ends_on date not null,
  status text not null default 'draft' check (status in ('draft','active','closed')),
  unique (university_id, label), check (ends_on > starts_on)
);
create unique index one_active_year on academic_years (university_id) where status = 'active';

create table faculties (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id),
  code text not null, name text not null, description text,
  is_active boolean not null default true, deleted_at timestamptz,
  unique (university_id, code), unique (university_id, name)
);

create table programs (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references faculties(id),
  code text not null, name text not null,
  is_active boolean not null default true, deleted_at timestamptz,
  unique (faculty_id, code)
);

create table promotions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  academic_year_id uuid not null references academic_years(id),
  name text not null, capacity int check (capacity is null or capacity > 0),
  unique (program_id, academic_year_id, name)
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, label text not null,
  is_faculty_scoped boolean not null default false
);
create table permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, description text
);
create table role_permissions (
  role_id uuid references roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  last_name text, middle_name text, first_name text, phone text,
  status text not null default 'pending_profile'
    check (status in ('pending_profile','active','suspended')),
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now()
);

create table user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id),
  role_id uuid not null references roles(id),
  faculty_id uuid references faculties(id),          -- null = périmètre global
  granted_by uuid references user_profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz, revoked_by uuid references user_profiles(id)
);
create unique index one_active_assignment
  on user_role_assignments (user_id, role_id, coalesce(faculty_id,'00000000-0000-0000-0000-000000000000'))
  where revoked_at is null;

create table invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null, role_id uuid not null references roles(id),
  faculty_id uuid references faculties(id),
  token_hash text not null unique,                    -- sha256 du jeton ; jamais le jeton en clair
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  invited_by uuid not null references user_profiles(id),
  accepted_by uuid references user_profiles(id), created_at timestamptz not null default now()
);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid, action text not null, entity text not null, entity_id text,
  details jsonb not null default '{}', created_at timestamptz not null default now()
);
create function audit_block_mutation() returns trigger language plpgsql as
$$ begin raise exception 'audit_logs est en ajout seul'; end $$;
create trigger audit_no_update before update or delete on audit_logs
  for each row execute function audit_block_mutation();

-- Contrôle d'accès : source unique de vérité côté base
create function has_permission(p_code text, p_faculty uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from user_role_assignments a
    join user_profiles up on up.id = a.user_id and up.status <> 'suspended'
    join role_permissions rp on rp.role_id = a.role_id
    join permissions p on p.id = rp.permission_id and p.code = p_code
    where a.user_id = auth.uid() and a.revoked_at is null
      and (a.faculty_id is null or a.faculty_id = p_faculty)
  )
$$;

-- Nouvel utilisateur (e-mail ou Google) : profil + rôle student UNIQUEMENT.
-- Les métadonnées envoyées par le navigateur ne sont jamais utilisées pour le rôle.
create function handle_new_user() returns trigger language plpgsql security definer
set search_path = public as $$
begin
  -- Seuls les noms viennent des métadonnées ; le rôle n'en vient JAMAIS.
  insert into user_profiles (id, last_name, middle_name, first_name, phone, status)
    values (new.id, new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'middle_name',
            new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'phone',
            case when coalesce(new.raw_user_meta_data->>'last_name','') <> ''
                  and coalesce(new.raw_user_meta_data->>'first_name','') <> ''
                 then 'active' else 'pending_profile' end)
    on conflict (id) do nothing;
  insert into user_role_assignments (user_id, role_id)
    select new.id, r.id from roles r where r.code = 'student' on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Protection du dernier super_admin actif
create function protect_last_super_admin() returns trigger language plpgsql as $$
begin
  if old.revoked_at is null and new.revoked_at is not null
     and old.role_id = (select id from roles where code = 'super_admin')
     and not exists (select 1 from user_role_assignments a
                     where a.role_id = old.role_id and a.revoked_at is null and a.id <> old.id)
  then raise exception 'Impossible de révoquer le dernier super_admin actif'; end if;
  return new;
end $$;
create trigger last_super_admin before update on user_role_assignments
  for each row execute function protect_last_super_admin();

-- RLS
alter table universities enable row level security;
alter table academic_years enable row level security;
alter table faculties enable row level security;
alter table programs enable row level security;
alter table promotions enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table user_profiles enable row level security;
alter table user_role_assignments enable row level security;
alter table invitations enable row level security;
alter table audit_logs enable row level security;

create policy ref_read on universities for select to authenticated using (true);
create policy ref_read on academic_years for select to authenticated using (true);
create policy ref_read on faculties for select to authenticated using (deleted_at is null);
create policy ref_read on programs for select to authenticated using (deleted_at is null);
create policy ref_read on promotions for select to authenticated using (true);
create policy org_write on faculties for all to authenticated
  using (has_permission('org.manage')) with check (has_permission('org.manage'));
create policy org_write on programs for all to authenticated
  using (has_permission('org.manage')) with check (has_permission('org.manage'));
create policy org_write on academic_years for all to authenticated
  using (has_permission('org.manage')) with check (has_permission('org.manage'));
create policy org_write on promotions for all to authenticated
  using (has_permission('org.manage')) with check (has_permission('org.manage'));

create policy roles_read on roles for select to authenticated using (true);
create policy perms_read on permissions for select to authenticated using (has_permission('users.manage'));
create policy rp_read on role_permissions for select to authenticated using (has_permission('users.manage'));

create policy own_or_admin_read on user_profiles for select to authenticated
  using (id = auth.uid() or has_permission('users.read'));
create policy own_update on user_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on user_profiles from authenticated;
grant update (last_name, middle_name, first_name, phone, onboarding_done) on user_profiles to authenticated;

-- Aucune politique d'écriture sur assignments / invitations / audit : service_role (serveur) uniquement.
create policy own_or_admin_read on user_role_assignments for select to authenticated
  using (user_id = auth.uid() or has_permission('users.read'));
create policy admin_read on invitations for select to authenticated using (has_permission('users.manage'));
create policy audit_read on audit_logs for select to authenticated using (has_permission('audit.read'));

-- Données de référence : rôles et permissions de départ
insert into roles (code, label, is_faculty_scoped) values
 ('super_admin','Super administrateur',false),('rector','Recteur',false),
 ('secretary_general_academic','Secrétaire général académique',false),
 ('administrative_secretary','Secrétariat administratif',false),
 ('central_secretariat','Secrétariat central',false),('paritaire_agent','Agent paritaire',false),
 ('dean','Doyen',true),('vice_dean','Doyen adjoint',true),('faculty_secretary','Secrétaire de faculté',true),
 ('accountant','Comptable',false),('budget_administrator','Administrateur du budget',false),
 ('admissions_agent','Agent des admissions',false),
 ('student_council_president','Président des étudiants',false),
 ('student_council_deputy','Adjoint du président',false),('student_council_secretary','Secrétaire du comité',false),
 ('faculty_delegate','Délégué facultaire',true),('faculty_delegate_deputy','Délégué adjoint',true),
 ('faculty_delegation_secretary','Secrétaire de délégation',true),
 ('parent','Parent / tuteur',false),('student','Étudiant',false);

insert into permissions (code, description) values
 ('org.manage','Gérer facultés, filières, années'),('users.read','Lire les utilisateurs'),
 ('users.manage','Gérer rôles et invitations'),('audit.read','Lire le journal d''audit');

insert into role_permissions
 select r.id, p.id from roles r, permissions p where r.code = 'super_admin';
