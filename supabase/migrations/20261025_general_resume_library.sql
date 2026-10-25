create table if not exists public.general_resume_versions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.accounts(id) on delete cascade,
  category_key text not null,
  category_name text not null,
  version integer not null,
  source_evidence_id uuid not null references public.candidate_evidence_versions(id) on delete restrict,
  source_strategy_id uuid not null references public.search_strategy_versions(id) on delete restrict,
  target_roles text[] not null default '{}',
  focus_summary text not null default '',
  resume_json jsonb not null,
  status text not null default 'current' check (status in ('current','archived')),
  model text,
  response_id text,
  generated_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(customer_id, category_key, version)
);

create unique index if not exists general_resume_one_current_category_idx
  on public.general_resume_versions(customer_id, category_key)
  where status='current';

create index if not exists general_resume_customer_created_idx
  on public.general_resume_versions(customer_id, created_at desc);

alter table public.general_resume_versions enable row level security;

drop policy if exists "authorized general resume read" on public.general_resume_versions;
create policy "authorized general resume read"
on public.general_resume_versions
for select
to authenticated
using (public.can_access_customer(customer_id));

grant select on public.general_resume_versions to authenticated;
revoke insert, update, delete on public.general_resume_versions from anon, authenticated;
