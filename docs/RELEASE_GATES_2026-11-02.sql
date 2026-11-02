-- Read-only operational gate; counts are NOT proof of customer acceptance.
select 'applications_total' metric,count(*) value from public.applications
union all select 'search_runs',count(*) from public.search_runs
union all select 'document_authorizations',count(*) from public.document_authorizations
union all select 'document_authorization_events',count(*) from public.document_authorization_events
union all select 'application_events',count(*) from public.application_events;
-- Interpret only with authenticated synthetic role tests and human submission evidence.
