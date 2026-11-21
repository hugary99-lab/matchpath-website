-- MatchPath submission truth audit (read-only, aggregate-only).
-- Run with a privileged SQL editor; never expose customer records.
-- Approved is NOT submitted. A timestamp alone is NOT employer receipt evidence.
-- Requires human verification of actual employer submission before any external claim.
select status,
       count(*)::integer as application_records,
       count(*) filter (where submitted_at is not null)::integer as with_submission_timestamp,
       count(*) filter (where submitted_at is null)::integer as without_submission_timestamp
from public.applications
 group by status
 order by status;

-- Release interpretation:
-- 1. 'approved' is a customer decision, not an employer application.
-- 2. Only count verified human submissions with an auditable employer receipt.
-- 3. No names, resumes, email addresses, or other customer data are selected.
