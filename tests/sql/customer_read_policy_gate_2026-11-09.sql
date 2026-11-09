-- Read-only policy drift gate; run in Supabase SQL editor. No private rows returned.
-- This checks policy metadata, NOT authenticated cross-user behavior.
WITH expected(tablename) AS (VALUES ('applications'), ('jobs'), ('search_runs'), ('document_authorizations')),
policies AS (
 SELECT tablename,cmd,roles::text AS roles,coalesce(qual,'') AS qual
 FROM pg_policies WHERE schemaname='public'
), checks AS (
 SELECT e.tablename,
   c.relrowsecurity AS rls_enabled,
   EXISTS (SELECT 1 FROM policies p WHERE p.tablename=e.tablename AND p.cmd='SELECT'
     AND p.roles='{authenticated}' AND position('can_access_customer(customer_id)' in p.qual)>0) AS owner_scoped_read_policy
 FROM expected e JOIN pg_class c ON c.relname=e.tablename
 JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
)
SELECT tablename,rls_enabled,owner_scoped_read_policy,
 CASE WHEN rls_enabled AND owner_scoped_read_policy THEN 'PASS_METADATA' ELSE 'FAIL_REVIEW' END AS result
FROM checks ORDER BY tablename;
-- Release still requires authenticated test identities A/B and forbidden-access checks.
