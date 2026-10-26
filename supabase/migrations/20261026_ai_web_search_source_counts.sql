alter table public.search_runs
  add column if not exists web_search_call_count integer not null default 0,
  add column if not exists web_sources_retrieved_count integer not null default 0;

alter table public.search_runs drop constraint if exists search_runs_web_search_counts_check;
alter table public.search_runs
  add constraint search_runs_web_search_counts_check check (
    web_search_call_count >= 0 and web_sources_retrieved_count >= 0
  );

-- import_ai_search_results_v3 is updated in production to persist these two
-- OpenAI-derived runtime metrics alongside the existing AI search funnel.
