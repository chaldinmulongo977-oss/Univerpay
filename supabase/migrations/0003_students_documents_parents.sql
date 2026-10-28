-- UniPay 0003 : étudiants, inscriptions, documents, parents, représentants, permissions métier

-- ===== Permissions et rattachement aux rôles =====
insert into permissions (code, description) values
 ('students.read','Consulter les dossiers étudiants'),('students.write','Modifier les dossiers étudiants'),
 ('documents.read','Consulter les documents'),('documents.validate','Valider ou rejeter les documents'),
 ('admissions.manage','Gérer campagnes et candidatures'),('admissions.grade_enter','Saisir les notes'),
 ('admissions.grade_validate','Valider les notes et décider'),('admissions.publish','Publier les résultats'),
 ('billing.read','Consulter factures'),('billing.manage','Créer barèmes et factures'),
 ('payments.read','Consulter paiements'),('accounting.read','Consulter la comptabilité'),
 ('accounting.write','Passer des écritures'),('reconciliation.manage','Rapprochement bancaire'),
 ('budget.read','Consulter le budget'),('budget.manage','Gérer le budget'),
 ('reports.read','KPI et rapports'),('announcements.manage','Publier des annonces'),
 ('parents.validate','Valider les rattachements parents'),('correspondence.manage','Courrier et secrétariat central')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from (values
 ('super_admin','students.read'),('super_admin','students.write'),('super_admin','documents.read'),('super_admin','documents.validate'),
 ('super_admin','admissions.manage'),('super_admin','billing.read'),('super_admin','billing.manage'),('super_admin','payments.read'),
 ('super_admin','reports.read'),('super_admin','announcements.manage'),('super_admin','parents.validate'),('super_admin','correspondence.manage'),
 ('rector','students.read'),('rector','reports.read'),('rector','billing.read'),('rector','payments.read'),
 ('secretary_general_academic','students.read'),('secretary_general_academic','students.write'),('secretary_general_academic','admissions.manage'),
 ('secretary_general_academic','admissions.grade_validate'),('secretary_general_academic','admissions.publish'),
 ('secretary_general_academic','reports.read'),('secretary_general_academic','parents.validate'),
 ('administrative_secretary','students.read'),('administrative_secretary','documents.read'),('administrative_secretary','correspondence.manage'),
 ('central_secretariat','correspondence.manage'),
 ('paritaire_agent','students.read'),('paritaire_agent','documents.read'),('paritaire_agent','documents.validate'),
 ('dean','students.read'),('dean','documents.read'),('dean','reports.read'),
 ('vice_dean','students.read'),('vice_dean','documents.read'),('vice_dean','reports.read'),
 ('faculty_secretary','students.read'),('faculty_secretary','students.write'),('faculty_secretary','documents.read'),('faculty_secretary','documents.validate'),
 ('accountant','billing.read'),('accountant','billing.manage'),('accountant','payments.read'),('accountant','accounting.read'),
 ('accountant','accounting.write'),('accountant','reconciliation.manage'),('accountant','reports.read'),
 ('budget_administrator','budget.read'),('budget_administrator','budget.manage'),('budget_administrator','reports.read'),
 ('admissions_agent','admissions.manage'),('admissions_agent','admissions.grade_enter'),('admissions_agent','documents.read'),
 ('student_council_president','announcements.manage'),('student_council_deputy','announcements.manage'),('student_council_secretary','announcements.manage'),
 ('faculty_delegate','announcements.manage'),('faculty_delegate_deputy','announcements.manage'),('faculty_delegation_secretary','announcements.manage')
) as m(role_code, perm_code)
join roles r on r.code = m.role_code join permissions p on p.code = m.perm_code
on conflict do nothing;

-- ===== Étudiants =====
create table students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references user_profiles(id),         -- lien vérifié, jamais auto-attribué
  matricule text unique,
  last_name text not null, middle_name text, first_name text not null,
  birth_date date, sex text check (sex in ('F','M')), phone text, email text,
  first_academic_year_id uuid references academic_years(id), -- sert aux KPI nouveaux / anciens
  status text not null default 'active' check (status in ('active','suspended','graduated','withdrawn')),
  created_at timestamptz not null default now(), deleted_at timestamptz
);
create index students_name_idx on students (lower(last_name), lower(first_name));

create table student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  promotion_id uuid not null references promotions(id),
  academic_year_id uuid not null references academic_years(id),
  status text not null default 'pending' check (status in ('pending','valid','suspended','withdrawn')),
  validated_by uuid references user_profiles(id), validated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, academic_year_id)
);
create index enroll_promo_idx on student_enrollments (promotion_id, status);

-- Parents
create table parent_profiles (
  user_id uuid primary key references user_profiles(id),
  phone text, created_at timestamptz not null default now()
);
create table student_parent_links (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references parent_profiles(user_id),
  student_id uuid not null references students(id),
  relationship text,
  status text not null default 'requested'
    check (status in ('requested','student_consented','approved','rejected','revoked')),
  allowed_scopes text[] not null default '{}',   -- ex. {invoices,payments,receipts,academic}
  student_consent_at timestamptz, approved_by uuid references user_profiles(id), approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (parent_user_id, student_id)
);

-- Documents
create table document_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, label text not null, is_required boolean not null default false,
  is_active boolean not null default true
);
create table student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  document_type_id uuid not null references document_types(id),
  storage_path text not null unique,                -- bucket privé, accès par URL signée serveur
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  status text not null default 'submitted' check (status in ('submitted','validated','rejected')),
  rejection_reason text, uploaded_by uuid references user_profiles(id),
  reviewed_by uuid references user_profiles(id), reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table document_events (
  id bigint generated always as identity primary key,
  document_id uuid not null references student_documents(id),
  actor_id uuid, event text not null, details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Affectations de personnel et représentants
create table staff_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id),
  faculty_id uuid references faculties(id),
  position text not null, starts_on date not null default current_date, ends_on date
);
create table student_representatives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id),
  faculty_id uuid references faculties(id),          -- null = comité général
  position text not null check (position in ('president','deputy','secretary','delegate','delegate_deputy','delegation_secretary')),
  academic_year_id uuid not null references academic_years(id)
);

-- ===== Fonctions d'accès =====
create function student_faculty_ids(p_student uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct g.faculty_id from student_enrollments e
  join promotions p on p.id = e.promotion_id join programs g on g.id = p.program_id
  where e.student_id = p_student
$$;

create function can_read_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from students s where s.id = p_student and s.user_id = auth.uid())
  or exists (select 1 from student_faculty_ids(p_student) f(id) where has_permission('students.read', f.id))
  or (not exists (select 1 from student_enrollments e where e.student_id = p_student)
      and has_permission('students.read'))
$$;

create function can_read_documents(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from students s where s.id = p_student and s.user_id = auth.uid())
  or exists (select 1 from student_faculty_ids(p_student) f(id) where has_permission('documents.read', f.id))
$$;

create function parent_can(p_student uuid, p_scope text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from student_parent_links l
    where l.student_id = p_student and l.parent_user_id = auth.uid()
      and l.status = 'approved' and p_scope = any (l.allowed_scopes))
$$;

-- ===== RLS =====
alter table students enable row level security;
alter table student_enrollments enable row level security;
alter table parent_profiles enable row level security;
alter table student_parent_links enable row level security;
alter table document_types enable row level security;
alter table student_documents enable row level security;
alter table document_events enable row level security;
alter table staff_assignments enable row level security;
alter table student_representatives enable row level security;

create policy read on students for select to authenticated
  using (deleted_at is null and (can_read_student(id) or parent_can(id,'academic')));
create policy write on students for all to authenticated
  using (has_permission('students.write')) with check (has_permission('students.write'));

create policy read on student_enrollments for select to authenticated
  using (can_read_student(student_id) or parent_can(student_id,'academic'));
create policy write on student_enrollments for all to authenticated
  using (has_permission('students.write')) with check (has_permission('students.write'));

create policy own on parent_profiles for select to authenticated using (user_id = auth.uid() or has_permission('parents.validate'));
create policy own_ins on parent_profiles for insert to authenticated with check (user_id = auth.uid());

create policy read on student_parent_links for select to authenticated
  using (parent_user_id = auth.uid() or has_permission('parents.validate')
         or exists (select 1 from students s where s.id = student_id and s.user_id = auth.uid()));
create policy request on student_parent_links for insert to authenticated
  with check (parent_user_id = auth.uid() and status = 'requested' and allowed_scopes = '{}');
-- Consentement de l'étudiant, approbation et révocation : fonctions serveur (service_role).

create policy read on document_types for select to authenticated using (true);
create policy admin on document_types for all to authenticated
  using (has_permission('org.manage')) with check (has_permission('org.manage'));

create policy read on student_documents for select to authenticated using (can_read_documents(student_id));
create policy upload on student_documents for insert to authenticated
  with check (status = 'submitted' and (
    exists (select 1 from students s where s.id = student_id and s.user_id = auth.uid())
    or has_permission('documents.validate')));
create policy review on student_documents for update to authenticated
  using (has_permission('documents.validate')) with check (has_permission('documents.validate'));
create policy read on document_events for select to authenticated
  using (exists (select 1 from student_documents d where d.id = document_id and can_read_documents(d.student_id)));

create policy read on staff_assignments for select to authenticated using (user_id = auth.uid() or has_permission('users.read'));
create policy read on student_representatives for select to authenticated using (user_id = auth.uid() or has_permission('users.read'));

-- Bucket privé : aucune politique publique ; accès uniquement par URL signée émise par le serveur.
insert into storage.buckets (id, name, public) values ('student-documents','student-documents', false)
on conflict (id) do nothing;

insert into document_types (code, label, is_required) values
 ('id_card','Pièce d''identité',true),('photo','Photo d''identité',true),
 ('diploma','Diplôme d''État / attestation',true),('birth_certificate','Acte de naissance',false)
on conflict do nothing;
