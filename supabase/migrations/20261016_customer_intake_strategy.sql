-- Additive MatchPath intake + strategy tables. Review in staging before applying.
alter table public.customer_profiles
 add column if not exists service_tier text not null default 'diy' check (service_tier in ('diy','full_service')),
 add column if not exists salary_currency text not null default 'CAD',
 add column if not exists employment_types text not null default '',
 add column if not exists transferable_roles text not null default '',
 add column if not exists industries text not null default '',
 add column if not exists relocation_preferences text not null default '',
 add column if not exists pension_preferences text not null default '',
 add column if not exists ai_consent_at timestamptz,
 add column if not exists ai_consent_version text;

create table if not exists public.search_strategies (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.accounts(id) on delete cascade,
 version integer not null check(version > 0),
 strategy jsonb not null,
 status text not null default 'draft' check(status in ('draft','approved','superseded')),
 created_at timestamptz not null default now(),
 approved_at timestamptz,
 approved_by uuid references public.accounts(id),
 unique(customer_id,version),
 check (status <> 'approved' or (approved_at is not null and approved_by=customer_id))
);
create unique index if not exists one_approved_strategy_per_customer
 on public.search_strategies(customer_id) where status='approved';
alter table public.search_strategies enable row level security;
create policy "strategy read authorized" on public.search_strategies for select to authenticated
 using(public.can_access_customer(customer_id));
create policy "strategy customer insert draft" on public.search_strategies for insert to authenticated
 with check(customer_id=auth.uid() and status='draft' and approved_at is null and approved_by is null);
create policy "strategy customer update" on public.search_strategies for update to authenticated
 using(customer_id=auth.uid() and status in ('draft','approved'))
 with check(customer_id=auth.uid() and (status='draft' or (status='approved' and approved_by=auth.uid() and approved_at is not null) or status='superseded'));

create table if not exists public.search_executions (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.accounts(id) on delete cascade,
 strategy_id uuid not null references public.search_strategies(id),
 executed_at timestamptz not null default now(),
 operator_id uuid references public.accounts(id),
 status text not null default 'pending' check(status in ('pending','running','completed','failed')),
 screened_count integer not null default 0 check(screened_count>=0),
 qualified_count integer not null default 0 check(qualified_count>=0),
 imported_count integer not null default 0 check(imported_count>=0),
 failure_reason text
);
alter table public.search_executions enable row level security;
create policy "execution read authorized" on public.search_executions for select to authenticated
 using(public.can_access_customer(customer_id));
create policy "execution staff insert" on public.search_executions for insert to authenticated
 with check(public.can_work_customer(customer_id) and operator_id=auth.uid()
 and exists(select 1 from public.search_strategies s where s.id=strategy_id and s.customer_id=search_executions.customer_id and s.status='approved'));
create policy "execution staff update" on public.search_executions for update to authenticated
 using(public.can_work_customer(customer_id))
 with check(public.can_work_customer(customer_id));
