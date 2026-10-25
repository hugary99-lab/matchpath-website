create table if not exists public.candidate_evidence_versions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.accounts(id) on delete cascade,
  version integer not null check (version > 0),
  evidence_json jsonb not null,
  source_resume_ids uuid[] not null default '{}',
  source_resume_count integer not null default 0 check (source_resume_count between 0 and 5),
  model text,
  response_id text,
  analyzed_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(customer_id, version)
);

create index if not exists candidate_evidence_versions_customer_created_idx
  on public.candidate_evidence_versions(customer_id, created_at desc);

alter table public.candidate_evidence_versions enable row level security;
revoke all on public.candidate_evidence_versions from anon, authenticated;
grant select on public.candidate_evidence_versions to authenticated;

drop policy if exists "authorized candidate evidence read" on public.candidate_evidence_versions;
create policy "authorized candidate evidence read"
on public.candidate_evidence_versions
for select
to authenticated
using (public.can_access_customer(customer_id));

create table if not exists public.search_strategy_versions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.accounts(id) on delete cascade,
  version integer not null check (version > 0),
  source_evidence_id uuid not null references public.candidate_evidence_versions(id) on delete restrict,
  source_profile_updated_at timestamptz not null,
  strategy_json jsonb not null,
  prompt_text text not null,
  status text not null default 'draft' check (status in ('draft','current','archived')),
  model text,
  response_id text,
  generated_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique(customer_id, version)
);

create index if not exists search_strategy_versions_customer_created_idx
  on public.search_strategy_versions(customer_id, created_at desc);

create unique index if not exists search_strategy_one_current_per_customer
  on public.search_strategy_versions(customer_id)
  where status='current';

alter table public.search_strategy_versions enable row level security;
revoke all on public.search_strategy_versions from anon, authenticated;
grant select on public.search_strategy_versions to authenticated;

drop policy if exists "authorized search strategy read" on public.search_strategy_versions;
create policy "authorized search strategy read"
on public.search_strategy_versions
for select
to authenticated
using (public.can_access_customer(customer_id));
