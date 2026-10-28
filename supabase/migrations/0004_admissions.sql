-- UniPay 0004 : admissions, tests, notes, décisions (saisie / validation / publication séparées)

create table admission_campaigns (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id),
  name text not null, opens_on date not null, closes_on date not null,
  test_fee_required boolean not null default false,
  status text not null default 'draft' check (status in ('draft','open','closed','published')),
  created_by uuid references user_profiles(id), created_at timestamptz not null default now(),
  check (closes_on >= opens_on)
);
create table campaign_programs (
  campaign_id uuid references admission_campaigns(id) on delete cascade,
  program_id uuid references programs(id),
  capacity int check (capacity is null or capacity > 0),
  primary key (campaign_id, program_id)
);

create sequence candidate_number_seq;
create table candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references user_profiles(id),
  last_name text not null, middle_name text, first_name text not null,
  birth_date date, phone text, email text,
  converted_student_id uuid references students(id),
  created_at timestamptz not null default now()
);
create table applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references admission_campaigns(id),
  candidate_id uuid not null references candidates(id),
  program_id uuid not null references programs(id),
  candidate_number text not null unique
    default ('C' || to_char(now(),'YY') || lpad(nextval('candidate_number_seq')::text, 5, '0')),
  status text not null default 'submitted'
    check (status in ('draft','submitted','documents_ok','tested','decided','withdrawn')),
  created_at timestamptz not null default now(),
  foreign key (campaign_id, program_id) references campaign_programs(campaign_id, program_id),
  unique (campaign_id, candidate_id, program_id)
);
create table application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  document_type_id uuid not null references document_types(id),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  status text not null default 'submitted' check (status in ('submitted','validated','rejected')),
  created_at timestamptz not null default now()
);

create table exam_sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references admission_campaigns(id),
  room text not null, starts_at timestamptz not null, ends_at timestamptz not null,
  capacity int check (capacity is null or capacity > 0), check (ends_at > starts_at)
);
create table exam_session_candidates (
  session_id uuid references exam_sessions(id) on delete cascade,
  application_id uuid references applications(id),
  primary key (session_id, application_id)
);
create table exam_subjects (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references admission_campaigns(id),
  name text not null, max_score numeric(6,2) not null check (max_score > 0), coefficient numeric(4,2) not null default 1,
  unique (campaign_id, name)
);
create table exam_results (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  subject_id uuid not null references exam_subjects(id),
  score numeric(6,2) not null check (score >= 0),
  status text not null default 'entered' check (status in ('entered','validated','corrected')),
  entered_by uuid not null references user_profiles(id),
  validated_by uuid references user_profiles(id), validated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (application_id, subject_id),
  check (validated_by is null or validated_by <> entered_by)   -- séparation saisie / validation
);
create table exam_result_history (
  id bigint generated always as identity primary key,
  result_id uuid not null, old_score numeric(6,2), new_score numeric(6,2),
  changed_by uuid, changed_at timestamptz not null default now()
);
create function log_exam_result_change() returns trigger language plpgsql as $$
begin
  if old.score is distinct from new.score then
    insert into exam_result_history (result_id, old_score, new_score, changed_by)
    values (old.id, old.score, new.score, auth.uid());
  end if;
  return new;
end $$;
create trigger exam_result_audit after update on exam_results for each row execute function log_exam_result_change();

create table admission_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id),
  decision text not null check (decision in ('admitted','waitlisted','rejected')),
  decided_by uuid not null references user_profiles(id), decided_at timestamptz not null default now(),
  published_by uuid references user_profiles(id), published_at timestamptz,
  check (published_by is null or published_by <> decided_by)
);

-- Conversion candidat admis -> étudiant (appelée par le serveur après validation administrative)
create function convert_candidate_to_student(p_application uuid, p_promotion uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_cand candidates; v_year uuid; v_student uuid;
begin
  if not has_permission('students.write') then raise exception 'non autorisé'; end if;
  if not exists (select 1 from admission_decisions d where d.application_id = p_application
                 and d.decision = 'admitted' and d.published_at is not null)
  then raise exception 'décision publiée « admis » requise'; end if;
  select c.* into v_cand from candidates c join applications a on a.candidate_id = c.id where a.id = p_application;
  if v_cand.converted_student_id is not null then return v_cand.converted_student_id; end if;
  select academic_year_id into v_year from promotions where id = p_promotion;
  insert into students (user_id, last_name, middle_name, first_name, birth_date, phone, email, first_academic_year_id)
    values (v_cand.user_id, v_cand.last_name, v_cand.middle_name, v_cand.first_name, v_cand.birth_date,
            v_cand.phone, v_cand.email, v_year) returning id into v_student;
  insert into student_enrollments (student_id, promotion_id, academic_year_id, status)
    values (v_student, p_promotion, v_year, 'pending');
  update candidates set converted_student_id = v_student where id = v_cand.id;
  insert into audit_logs (actor_id, action, entity, entity_id) values (auth.uid(),'candidate.convert','applications',p_application::text);
  return v_student;
end $$;

-- RLS
alter table admission_campaigns enable row level security;
alter table campaign_programs enable row level security;
alter table candidates enable row level security;
alter table applications enable row level security;
alter table application_documents enable row level security;
alter table exam_sessions enable row level security;
alter table exam_session_candidates enable row level security;
alter table exam_subjects enable row level security;
alter table exam_results enable row level security;
alter table exam_result_history enable row level security;
alter table admission_decisions enable row level security;

create policy read on admission_campaigns for select to authenticated using (status in ('open','closed','published') or has_permission('admissions.manage'));
create policy manage on admission_campaigns for all to authenticated using (has_permission('admissions.manage')) with check (has_permission('admissions.manage'));
create policy read on campaign_programs for select to authenticated using (true);
create policy manage on campaign_programs for all to authenticated using (has_permission('admissions.manage')) with check (has_permission('admissions.manage'));

create policy own_or_staff on candidates for select to authenticated using (user_id = auth.uid() or has_permission('admissions.manage'));
create policy own_insert on candidates for insert to authenticated with check (user_id = auth.uid());
create policy own_or_staff on applications for select to authenticated
  using (has_permission('admissions.manage') or exists (select 1 from candidates c where c.id = candidate_id and c.user_id = auth.uid()));
create policy own_insert on applications for insert to authenticated
  with check (status in ('draft','submitted') and exists (select 1 from candidates c where c.id = candidate_id and c.user_id = auth.uid()));
create policy own_or_staff on application_documents for select to authenticated
  using (has_permission('admissions.manage') or exists (select 1 from applications a join candidates c on c.id = a.candidate_id
         where a.id = application_id and c.user_id = auth.uid()));

create policy staff on exam_sessions for all to authenticated using (has_permission('admissions.manage')) with check (has_permission('admissions.manage'));
create policy staff on exam_session_candidates for all to authenticated using (has_permission('admissions.manage')) with check (has_permission('admissions.manage'));
create policy read on exam_subjects for select to authenticated using (has_permission('admissions.manage') or has_permission('admissions.grade_enter'));
create policy manage on exam_subjects for all to authenticated using (has_permission('admissions.manage')) with check (has_permission('admissions.manage'));

create policy read on exam_results for select to authenticated
  using (has_permission('admissions.grade_enter') or has_permission('admissions.grade_validate'));
create policy enter on exam_results for insert to authenticated
  with check (has_permission('admissions.grade_enter') and entered_by = auth.uid() and status = 'entered');
create policy validate on exam_results for update to authenticated
  using (has_permission('admissions.grade_validate')) with check (has_permission('admissions.grade_validate'));
create policy read on exam_result_history for select to authenticated using (has_permission('admissions.grade_validate'));

-- Les candidats ne voient leur décision qu'après publication.
create policy read_published on admission_decisions for select to authenticated
  using (has_permission('admissions.grade_validate')
     or (published_at is not null and exists (select 1 from applications a join candidates c on c.id = a.candidate_id
         where a.id = application_id and c.user_id = auth.uid())));
create policy decide on admission_decisions for insert to authenticated
  with check (has_permission('admissions.grade_validate') and decided_by = auth.uid() and published_at is null);
create policy publish on admission_decisions for update to authenticated
  using (has_permission('admissions.publish')) with check (has_permission('admissions.publish'));
