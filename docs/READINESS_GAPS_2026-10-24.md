# MatchPath onboarding readiness evidence — 2026-10-24

Read-only checks against the dedicated MatchPath Supabase project, plus current `main` source inspection. No customer files, job applications, or payments were processed.

## Verified database snapshot
- Project status: `ACTIVE_HEALTHY`.
- `customer_profiles`: 2; `reference_resumes`: 0; `search_runs`: 0; `jobs`: 0; `applications`: 0; `staff_assignments`: 0.
- `to_regclass('public.search_strategies')` returned **NULL**. A strategy-table migration exists in the repository but **has not been applied** to this database. Do not claim approved AI strategy generation or recurring strategy executions work.
- `reference_resumes` RLS: SELECT is restricted to `customer_id = auth.uid()`; INSERT is owner-only with a matching private storage object. Assigned staff and admins cannot directly read reference-resume metadata through this table, even though full-service staff need authorized access. Any change must be least-privilege and tested for cross-customer isolation.
- `customer_profiles` has owner/admin UPDATE and authorized SELECT policies. The actual signed-in browser behavior remains untested.

## Source and regression evidence
- `beta/app.js` parses in V8 after the 2026-10-23 syntax repair.
- `tests/onboarding-contract.test.mjs` checks source parsing, 16 onboarding fields, immutable PDF storage paths, resume metadata registration, owner-scoped signed downloads and non-submission on save. This is a static contract test; it is **not** proof of successful uploads, storage permissions or production deployment.
- `/beta/` live browser login, mobile startup, save/reopen, 2-file PDF upload, signed download, and two-customer RLS denial: **NOT ACCEPTED**.

## Release gate (synthetic accounts only)
1. Confirm Netlify serves the exact tested commit and the page initializes on desktop and mobile.
2. Sign in with synthetic Customer A, save all 16 fields, reload, and compare every persisted value.
3. Upload two synthetic PDFs; verify two distinct private object paths and two `reference_resumes` rows. Reopen both using signed URLs.
4. Sign in as Customer B; deny read and signed-link generation for Customer A's rows and files.
5. Sign in as assigned staff; test intended access to Customer A only. Resolve the current reference-resume metadata policy gap **before** enabling staff workflows.
6. Revoke assignment and verify immediate loss of access. Verify no application was submitted and no AI data processing occurred.
7. Separately review and safely migrate the approved-strategy data model; do not deploy it solely because the file exists in GitHub.

**Decision:** NOT READY for real customer intake or paid pilot. Legal/privacy and Ontario recruiter-fee review remain additional launch gates.
