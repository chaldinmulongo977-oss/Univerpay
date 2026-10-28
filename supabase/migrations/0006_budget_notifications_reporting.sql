-- UniPay 0006 : budget, notifications, annonces, réclamations, courrier, unités, KPI

create table organizational_units (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id),
  parent_id uuid references organizational_units(id),
  name text not null, kind text not null, unique (university_id, name)
);

-- Budget (séparé de la comptabilité : aucune politique sur payments / accounting_entries)
create table budget_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, starts_on date not null, ends_on date not null,
  status text not null default 'open' check (status in ('open','closed')), check (ends_on > starts_on)
);
create table budget_lines (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references budget_periods(id),
  code text not null, label text not null, currency char(3) not null,
  planned_amount numeric(14,2) not null check (planned_amount >= 0),
  unique (period_id, code, currency)
);
create table budget_movements (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references budget_lines(id),
  kind text not null check (kind in ('allocation','commitment','expense','reversal')),
  amount numeric(14,2) not null check (amount > 0), description text,
  created_by uuid not null references user_profiles(id), approved_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  check (approved_by is null or approved_by <> created_by)
);
create trigger budget_movements_append_only before update or delete on budget_movements
  for each row execute function block_mutation();
create view budget_execution with (security_invoker = on) as
select l.id as line_id, l.period_id, l.code, l.label, l.currency, l.planned_amount,
  coalesce(sum(m.amount) filter (where m.kind = 'allocation'),0) as allocated,
  coalesce(sum(m.amount) filter (where m.kind = 'commitment'),0) as committed,
  coalesce(sum(m.amount) filter (where m.kind = 'expense'),0) - coalesce(sum(m.amount) filter (where m.kind = 'reversal'),0) as spent
from budget_lines l left join budget_movements m on m.line_id = l.id group by l.id;

-- Notifications, annonces, réclamations, demandes de représentants, courrier
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id),
  title text not null, body text, link text, read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notif_user_idx on notifications (user_id, read_at);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid references faculties(id),          -- null = toute l'université
  title text not null, body text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  author_id uuid not null references user_profiles(id),
  published_at timestamptz, created_at timestamptz not null default now()
);
create table claims (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  subject text not null, body text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','rejected')),
  handled_by uuid references user_profiles(id), response text,
  created_at timestamptz not null default now()
);
create table representative_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references user_profiles(id),
  faculty_id uuid references faculties(id),
  subject text not null, body text not null,
  status text not null default 'submitted' check (status in ('submitted','in_progress','answered','closed')),
  response text, created_at timestamptz not null default now()
);
create sequence correspondence_seq;
create table correspondences (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique
    default ('COR-' || to_char(now(),'YYYY') || '-' || lpad(nextval('correspondence_seq')::text, 5, '0')),
  direction text not null check (direction in ('incoming','outgoing')),
  subject text not null, counterpart text, received_on date not null default current_date,
  assigned_unit_id uuid references organizational_units(id), due_on date,
  status text not null default 'registered' check (status in ('registered','forwarded','processing','done','archived')),
  handled_by uuid references user_profiles(id), created_at timestamptz not null default now()
);

-- RLS
alter table organizational_units enable row level security;
alter table budget_periods enable row level security;
alter table budget_lines enable row level security;
alter table budget_movements enable row level security;
alter table notifications enable row level security;
alter table announcements enable row level security;
alter table claims enable row level security;
alter table representative_requests enable row level security;
alter table correspondences enable row level security;

create policy read on organizational_units for select to authenticated using (true);
create policy manage on organizational_units for all to authenticated using (has_permission('org.manage')) with check (has_permission('org.manage'));

create policy read on budget_periods for select to authenticated using (has_permission('budget.read'));
create policy manage on budget_periods for all to authenticated using (has_permission('budget.manage')) with check (has_permission('budget.manage'));
create policy read on budget_lines for select to authenticated using (has_permission('budget.read'));
create policy manage on budget_lines for all to authenticated using (has_permission('budget.manage')) with check (has_permission('budget.manage'));
create policy read on budget_movements for select to authenticated using (has_permission('budget.read'));
create policy insert on budget_movements for insert to authenticated with check (has_permission('budget.manage') and created_by = auth.uid());

create policy own on notifications for select to authenticated using (user_id = auth.uid());
create policy own_read_flag on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;

create policy read on announcements for select to authenticated
  using (status = 'published' or has_permission('announcements.manage', faculty_id));
create policy write on announcements for insert to authenticated
  with check (has_permission('announcements.manage', faculty_id) and author_id = auth.uid());
create policy edit on announcements for update to authenticated
  using (has_permission('announcements.manage', faculty_id)) with check (has_permission('announcements.manage', faculty_id));

create policy read on claims for select to authenticated using (
  exists (select 1 from students s where s.id = student_id and s.user_id = auth.uid()) or has_permission('students.read'));
create policy create_own on claims for insert to authenticated with check (
  exists (select 1 from students s where s.id = student_id and s.user_id = auth.uid()) and status = 'open');
create policy handle on claims for update to authenticated using (has_permission('students.write')) with check (has_permission('students.write'));

create policy read on representative_requests for select to authenticated
  using (author_id = auth.uid() or has_permission('students.read', faculty_id));
create policy create_own on representative_requests for insert to authenticated with check (author_id = auth.uid());
create policy handle on representative_requests for update to authenticated using (has_permission('students.write', faculty_id)) with check (has_permission('students.write', faculty_id));

create policy staff on correspondences for all to authenticated
  using (has_permission('correspondence.manage')) with check (has_permission('correspondence.manage'));

-- ===== KPI (requêtes réelles, agrégées ; autorisées selon la faculté) =====
create function kpi_enrollment(p_year uuid, p_faculty uuid default null)
returns table (total bigint, new_students bigint, returning_students bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_permission('reports.read', p_faculty) then raise exception 'non autorisé'; end if;
  return query
  with first_year as (
    select e.student_id, (array_agg(e.academic_year_id order by ay.starts_on))[1] as fy
    from student_enrollments e join academic_years ay on ay.id = e.academic_year_id
    where e.status = 'valid' group by e.student_id),
  cur as (
    select distinct e.student_id from student_enrollments e
    join promotions p on p.id = e.promotion_id join programs g on g.id = p.program_id
    where e.status = 'valid' and e.academic_year_id = p_year and (p_faculty is null or g.faculty_id = p_faculty))
  select count(*), count(*) filter (where f.fy = p_year), count(*) filter (where f.fy <> p_year)
  from cur join first_year f using (student_id);
end $$;

create function kpi_students_by_program(p_year uuid, p_faculty uuid default null)
returns table (faculty_code text, program_code text, program_name text, students bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_permission('reports.read', p_faculty) then raise exception 'non autorisé'; end if;
  return query
  select f.code, g.code, g.name, count(distinct e.student_id)
  from student_enrollments e join promotions p on p.id = e.promotion_id
  join programs g on g.id = p.program_id join faculties f on f.id = g.faculty_id
  where e.status = 'valid' and e.academic_year_id = p_year and (p_faculty is null or f.id = p_faculty)
  group by f.code, g.code, g.name order by f.code, g.code;
end $$;

-- Facturé / encaissé / reste dû, séparés par devise (jamais additionnées entre devises)
create function kpi_billing(p_year uuid, p_faculty uuid default null)
returns table (currency char(3), billed numeric, collected numeric, balance numeric, collection_rate numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_permission('reports.read', p_faculty) then raise exception 'non autorisé'; end if;
  return query
  select i.currency, sum(b.amount_due), sum(b.amount_paid), sum(b.balance),
         case when sum(b.amount_due) > 0 then round(sum(b.amount_paid) / sum(b.amount_due), 4) end
  from invoices i join invoice_balances b on b.invoice_id = i.id
  left join student_enrollments e on e.id = i.enrollment_id
  left join promotions p on p.id = e.promotion_id left join programs g on g.id = p.program_id
  where i.academic_year_id = p_year and i.status in ('issued','partially_paid','paid')
    and (p_faculty is null or g.faculty_id = p_faculty)
  group by i.currency;
end $$;

-- Trois montants distincts : confirmés, réglés en banque, écart
create function kpi_settlement_gap(p_currency char(3))
returns table (confirmed_net numeric, settled_net numeric, unreconciled numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_permission('accounting.read') then raise exception 'non autorisé'; end if;
  return query
  select coalesce(sum(p.net_amount),0),
         coalesce(sum(p.net_amount) filter (where sa.id is not null),0),
         coalesce(sum(p.net_amount) filter (where sa.id is null),0)
  from payments p left join settlement_allocations sa on sa.payment_id = p.id
  where p.currency = p_currency and p.status = 'confirmed';
end $$;
