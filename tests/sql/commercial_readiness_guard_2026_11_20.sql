-- MatchPath commercial launch guard: read-only, synthetic QA only.
-- A row is not proof of employer submission or valid consent.
WITH counts AS (
 SELECT (SELECT count(*) FROM public.search_runs) AS search_runs,
        (SELECT count(*) FROM public.jobs) AS job_records,
        (SELECT count(*) FROM public.applications) AS application_records,
        (SELECT count(*) FROM public.document_authorizations) AS document_authorizations
), controls AS (
 SELECT count(*) FILTER (WHERE relname IN ('customer_profiles','jobs','applications','document_authorizations') AND relrowsecurity) AS rls_enabled_tables
 FROM pg_class WHERE relnamespace = 'public'::regnamespace
)
SELECT current_date AS checked_on, counts.*, controls.rls_enabled_tables,
 CASE WHEN document_authorizations = 0 THEN 'BLOCK: no document authorizations recorded'
 ELSE 'REVIEW: records exist; inspect consent and revocation evidence' END AS document_release_gate,
 'NOT ACCEPTED: authenticated multi-account browser evidence still required' AS customer_journey_gate
FROM counts CROSS JOIN controls;
