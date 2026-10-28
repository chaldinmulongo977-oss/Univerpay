-- UniPay 0005 : barèmes, factures, paiements (SasPay), reçus, rapprochement, comptabilité, remboursements
-- Principes : paiements distincts des factures et des tentatives ; montants + devise explicites ;
-- écritures comptables et événements jamais supprimés ; fonctions sensibles réservées à service_role.

create table fee_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, label text not null, is_active boolean not null default true
);

create table fee_schedules (
  id uuid primary key default gen_random_uuid(),
  fee_type_id uuid not null references fee_types(id),
  academic_year_id uuid not null references academic_years(id),
  program_id uuid references programs(id),
  promotion_id uuid references promotions(id),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount numeric(14,2) not null check (amount > 0),
  version int not null default 1,
  valid_from date not null default current_date, valid_to date,
  is_active boolean not null default true,
  created_by uuid references user_profiles(id), created_at timestamptz not null default now()
);
create unique index fee_schedule_unique on fee_schedules
  (fee_type_id, academic_year_id, coalesce(program_id,'00000000-0000-0000-0000-000000000000'),
   coalesce(promotion_id,'00000000-0000-0000-0000-000000000000'), currency, version);

create sequence invoice_seq;
create table invoices (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique
    default ('INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('invoice_seq')::text, 6, '0')),
  student_id uuid references students(id),
  candidate_id uuid references candidates(id),
  enrollment_id uuid references student_enrollments(id),
  academic_year_id uuid not null references academic_years(id),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft'
    check (status in ('draft','issued','partially_paid','paid','cancelled')),
  allows_partial boolean not null default true,
  due_date date, issued_at timestamptz, cancelled_reason text,
  created_by uuid references user_profiles(id), created_at timestamptz not null default now(),
  check (num_nonnulls(student_id, candidate_id) = 1)
);
create index invoices_student_idx on invoices (student_id, status);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id),
  fee_type_id uuid not null references fee_types(id),
  fee_schedule_id uuid references fee_schedules(id),
  description text not null,
  quantity int not null default 1 check (quantity > 0),
  unit_amount numeric(14,2) not null check (unit_amount >= 0),     -- instantané : jamais recalculé
  line_total numeric(14,2) generated always as (quantity * unit_amount) stored
);
create function guard_invoice_items() returns trigger language plpgsql as $$
declare v_status text;
begin
  select status into v_status from invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if v_status <> 'draft' then raise exception 'facture émise : lignes non modifiables'; end if;
  return coalesce(new, old);
end $$;
create trigger invoice_items_guard before insert or update or delete on invoice_items
  for each row execute function guard_invoice_items();

create table invoice_adjustments (           -- remises, corrections (tracées, approuvées)
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id),
  kind text not null check (kind in ('discount','correction')),
  amount numeric(14,2) not null check (amount > 0),
  reason text not null, approved_by uuid not null references user_profiles(id),
  created_at timestamptz not null default now()
);

-- ===== Paiements =====
create table payment_attempts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id),
  reference text not null unique,                     -- référence unique générée par le serveur
  amount numeric(14,2) not null check (amount > 0),   -- fixé côté serveur à partir de la facture
  currency char(3) not null,
  provider text not null default 'saspay',
  provider_checkout_id text, checkout_url text,
  status text not null default 'created'
    check (status in ('created','pending','success','failed','expired','cancelled')),
  initiated_by uuid references user_profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index attempts_invoice_idx on payment_attempts (invoice_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references payment_attempts(id),
  provider text not null, provider_transaction_id text not null,
  status text not null default 'confirmed' check (status in ('confirmed','refunded','partially_refunded')),
  currency char(3) not null,
  amount numeric(14,2) not null check (amount > 0),            -- montant demandé
  charged numeric(14,2) not null, fee numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null,                           -- ce que l'université reçoit
  method text, network text,
  confirmed_at timestamptz not null default now(),
  unique (provider, provider_transaction_id)
);

create table payment_events (                          -- journal brut des webhooks
  id bigint generated always as identity primary key,
  provider text not null, event_type text not null, provider_transaction_id text not null,
  signature_valid boolean not null, payload jsonb not null,
  received_at timestamptz not null default now(), processed_at timestamptz,
  unique (provider, event_type, provider_transaction_id)   -- idempotence : une relivraison est ignorée
);

create table payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id),
  invoice_id uuid not null references invoices(id),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id)
);

create sequence receipt_seq;
create table receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references payments(id),    -- un seul reçu par paiement
  number text not null unique
    default ('REC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('receipt_seq')::text, 6, '0')),
  pdf_path text, issued_at timestamptz not null default now()
);

-- ===== Banque et rapprochement =====
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id),
  bank_name text not null, account_holder text not null, account_number text not null,
  currency char(3) not null, is_active boolean not null default true
);
create table bank_settlements (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references bank_accounts(id),
  provider text not null default 'saspay', reference text not null,
  currency char(3) not null,
  gross_amount numeric(14,2) not null, fees numeric(14,2) not null default 0, net_amount numeric(14,2) not null,
  expected_on date, received_on date,
  status text not null default 'expected' check (status in ('expected','received','reconciled','discrepancy')),
  created_by uuid references user_profiles(id), created_at timestamptz not null default now(),
  unique (provider, reference)
);
create table settlement_allocations (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references bank_settlements(id),
  payment_id uuid not null unique references payments(id),    -- un paiement n'est réglé qu'une fois
  amount numeric(14,2) not null check (amount > 0)
);

create table accounting_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  account_code text not null, description text,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  currency char(3) not null,
  payment_id uuid references payments(id), invoice_id uuid references invoices(id),
  reverses_entry_id uuid references accounting_entries(id),
  created_by uuid, created_at timestamptz not null default now(),
  check ((debit > 0) <> (credit > 0))
);
create function block_mutation() returns trigger language plpgsql as $$
begin raise exception 'table en ajout seul : utilisez une écriture d''extourne'; end $$;
create trigger entries_append_only before update or delete on accounting_entries
  for each row execute function block_mutation();

create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id),
  amount numeric(14,2) not null check (amount > 0), reason text not null,
  status text not null default 'requested' check (status in ('requested','approved','executed','rejected')),
  requested_by uuid not null references user_profiles(id),
  approved_by uuid references user_profiles(id), provider_reference text,
  created_at timestamptz not null default now(),
  check (approved_by is null or approved_by <> requested_by)
);

-- ===== Vues et fonctions =====
create view invoice_balances with (security_invoker = on) as
select i.id as invoice_id, i.reference, i.currency, i.status,
  coalesce(it.total,0) - coalesce(adj.total,0) as amount_due,
  coalesce(al.total,0) as amount_paid,
  coalesce(it.total,0) - coalesce(adj.total,0) - coalesce(al.total,0) as balance
from invoices i
left join (select invoice_id, sum(line_total) total from invoice_items group by 1) it on it.invoice_id = i.id
left join (select invoice_id, sum(amount) total from invoice_adjustments group by 1) adj on adj.invoice_id = i.id
left join (select a.invoice_id, sum(a.amount) total from payment_allocations a
           join payments p on p.id = a.payment_id where p.status <> 'refunded' group by 1) al on al.invoice_id = i.id;

create function can_see_invoice(p_invoice uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_permission('billing.read') or exists (
    select 1 from invoices i
    left join students s on s.id = i.student_id
    left join candidates c on c.id = i.candidate_id
    where i.id = p_invoice and (s.user_id = auth.uid() or c.user_id = auth.uid()
          or (i.student_id is not null and parent_can(i.student_id, 'invoices'))))
$$;

create function issue_invoice(p_invoice uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('billing.manage') then raise exception 'non autorisé'; end if;
  if not exists (select 1 from invoice_items where invoice_id = p_invoice) then raise exception 'facture vide'; end if;
  update invoices set status = 'issued', issued_at = now() where id = p_invoice and status = 'draft';
  insert into audit_logs (actor_id, action, entity, entity_id) values (auth.uid(),'invoice.issue','invoices',p_invoice::text);
end $$;

-- Confirmation d'un paiement : appelée UNIQUEMENT par le serveur après verify SasPay = SUCCESS.
create function confirm_payment(
  p_attempt uuid, p_txn text, p_amount numeric, p_charged numeric,
  p_net numeric, p_currency char(3), p_method text, p_network text
) returns uuid language plpgsql security definer set search_path = public as $$
declare a payment_attempts; v_payment uuid; v_balance numeric;
begin
  select * into a from payment_attempts where id = p_attempt for update;
  if not found then raise exception 'tentative inconnue'; end if;
  select id into v_payment from payments where provider = a.provider and provider_transaction_id = p_txn;
  if found then return v_payment; end if;                                 -- idempotence
  if p_currency <> a.currency or p_amount <> a.amount then raise exception 'montant ou devise différents de la tentative'; end if;
  select balance into v_balance from invoice_balances where invoice_id = a.invoice_id
    and status in ('issued','partially_paid');
  if v_balance is null then raise exception 'facture non payable'; end if;
  if v_balance < p_amount then raise exception 'paiement supérieur au solde'; end if;

  insert into payments (attempt_id, provider, provider_transaction_id, currency, amount, charged, fee, net_amount, method, network)
    values (a.id, a.provider, p_txn, p_currency, p_amount, p_charged, p_charged - p_net, p_net, p_method, p_network) returning id into v_payment;
  insert into payment_allocations (payment_id, invoice_id, amount) values (v_payment, a.invoice_id, p_amount);
  insert into receipts (payment_id) values (v_payment);
  insert into accounting_entries (account_code, description, debit, currency, payment_id, invoice_id)
    values ('PROVIDER_RECEIVABLE','Paiement confirmé en attente de règlement', p_net, p_currency, v_payment, a.invoice_id);
  insert into accounting_entries (account_code, description, credit, currency, payment_id, invoice_id)
    values ('TUITION_REVENUE','Frais académiques encaissés', p_net, p_currency, v_payment, a.invoice_id);
  update payment_attempts set status = 'success', updated_at = now() where id = a.id;
  update invoices set status = case when v_balance - p_amount <= 0 then 'paid' else 'partially_paid' end where id = a.invoice_id;
  insert into audit_logs (actor_id, action, entity, entity_id) values (null,'payment.confirm','payments',v_payment::text);
  return v_payment;
end $$;
revoke execute on function confirm_payment from public, anon, authenticated;
grant execute on function confirm_payment to service_role;

-- ===== RLS =====
alter table fee_types enable row level security;
alter table fee_schedules enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table invoice_adjustments enable row level security;
alter table payment_attempts enable row level security;
alter table payments enable row level security;
alter table payment_events enable row level security;
alter table payment_allocations enable row level security;
alter table receipts enable row level security;
alter table bank_accounts enable row level security;
alter table bank_settlements enable row level security;
alter table settlement_allocations enable row level security;
alter table accounting_entries enable row level security;
alter table refunds enable row level security;

create policy read on fee_types for select to authenticated using (true);
create policy manage on fee_types for all to authenticated using (has_permission('billing.manage')) with check (has_permission('billing.manage'));
create policy read on fee_schedules for select to authenticated using (true);
create policy manage on fee_schedules for all to authenticated using (has_permission('billing.manage')) with check (has_permission('billing.manage'));

create policy read on invoices for select to authenticated using (can_see_invoice(id));
create policy manage on invoices for insert to authenticated with check (has_permission('billing.manage'));
create policy update_draft on invoices for update to authenticated using (has_permission('billing.manage') and status = 'draft') with check (has_permission('billing.manage'));
create policy read on invoice_items for select to authenticated using (can_see_invoice(invoice_id));
create policy manage on invoice_items for all to authenticated using (has_permission('billing.manage')) with check (has_permission('billing.manage'));
create policy read on invoice_adjustments for select to authenticated using (can_see_invoice(invoice_id));
create policy manage on invoice_adjustments for insert to authenticated with check (has_permission('billing.manage') and approved_by = auth.uid());

create policy read on payment_attempts for select to authenticated using (can_see_invoice(invoice_id));
create policy read on payments for select to authenticated using (
  has_permission('payments.read') or exists (select 1 from payment_allocations al where al.payment_id = payments.id and can_see_invoice(al.invoice_id)));
create policy read on payment_allocations for select to authenticated using (can_see_invoice(invoice_id));
create policy read on receipts for select to authenticated using (
  has_permission('payments.read') or exists (select 1 from payment_allocations al where al.payment_id = receipts.payment_id and can_see_invoice(al.invoice_id)));
create policy read on payment_events for select to authenticated using (has_permission('accounting.read'));
-- Écritures dans payment_attempts / payments / payment_events / receipts : service_role uniquement.

create policy read on bank_accounts for select to authenticated using (has_permission('accounting.write'));
create policy read on bank_settlements for select to authenticated using (has_permission('accounting.read'));
create policy manage on bank_settlements for all to authenticated using (has_permission('reconciliation.manage')) with check (has_permission('reconciliation.manage'));
create policy read on settlement_allocations for select to authenticated using (has_permission('accounting.read'));
create policy manage on settlement_allocations for all to authenticated using (has_permission('reconciliation.manage')) with check (has_permission('reconciliation.manage'));
create policy read on accounting_entries for select to authenticated using (has_permission('accounting.read'));
create policy insert on accounting_entries for insert to authenticated with check (has_permission('accounting.write') and created_by = auth.uid());
create policy read on refunds for select to authenticated using (has_permission('accounting.read'));
create policy request on refunds for insert to authenticated with check (has_permission('accounting.write') and requested_by = auth.uid() and status = 'requested');

insert into fee_types (code, label) values
 ('tuition','Frais académiques'),('registration','Frais d''inscription'),('admission_test','Frais de test d''admission')
on conflict do nothing;
