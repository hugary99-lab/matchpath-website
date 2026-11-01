-- MatchPath release evidence: read-only aggregates; no personal records returned.
-- Run with an authorized SQL reviewer. Counts are NOT end-to-end acceptance.
select 'customer_profiles' as metric,count(*) as records from public.customer_profiles
union all select 'jobs',count(*) from public.jobs
union all select 'applications',count(*) from public.applications;
-- Snapshot 2026-11-01: 2 profiles, 7 jobs, 4 applications.
-- Release decision: BLOCKED until synthetic customer consent/revocation,
-- cross-customer RLS, PDF upload/download and human-only submission are observed.
