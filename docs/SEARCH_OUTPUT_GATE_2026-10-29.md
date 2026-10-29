# MatchPath search-result quality gate — 2026-10-29

**Status:** Source committed; `run-job-search` Supabase Edge Function **v14 ACTIVE**, JWT verification enabled. Deployed `index.ts` and `quality-gate.mjs` read back and match GitHub. Seven isolated Node regression tests passed locally. **No authenticated end-to-end customer search acceptance was performed.**

## Why this change was needed
Previously the search response trusted AI-provided job rows for threshold compliance, duplicate handling and previously seen posting suppression. The model-reported funnel could therefore overstate usable results. This is a post-model data-integrity control, not an employer-posting verification service.

## Implemented
- `supabase/functions/run-job-search/quality-gate.mjs`: deterministic HTTPS URL validation, current customer minimum fit-score enforcement, exact employer+requisition or canonical URL suppression, duplicate removal and output cap **after** filtering.
- `tests/search-quality-gate.test.mjs`: seven cases covering invalid URL, minimum score, requisition suppression, tracking parameters, duplicates, filter-before-limit and preservation of Needs Verification.
- `run-job-search/index.ts`: imports the pure gate and emits `post_filter_drops`, `applied_minimum_fit_score`, and `funnel_provenance`.

## Limitations and release gates
- The model's `reviewed_count`, `rejected_mandatory_count`, `below_threshold_count` and `suppressed_existing_count` remain model-reported estimates, **not independently counted job-page reviews**. Returned qualified and Needs Verification counts are recomputed after filtering.
- A valid HTTPS URL is not proof that the employer posting is open, authentic or joinable. Independent posting verification and evidence capture are still required.
- No synthetic customer consent-grant/revocation or cross-tenant browser acceptance was performed. The standing-consent baseline is **zero**.
- The production function was not invoked with customer data during this change; no employer applications were submitted.
- Keep the October 28 fifteen-scenario acceptance gate mandatory before real customers or paid pilots.

## Database read-only baseline
2026-10-29: 2 profiles; 1 reference resume; 1 Candidate Evidence; 1 current search strategy; 2 general resumes; 3 search runs; 7 jobs; 4 applications; 0 submitted documents; 0 document authorizations; 1 staff assignment. All 17 public tables have RLS enabled; `benchmark_nonces` intentionally has no public policy (verify purpose). Supabase security advisor still flags SECURITY DEFINER functions callable by authenticated users; inspect their internal actor guards before treating those warnings as vulnerabilities.

**Commercial hold:** Ontario recruiter licensing/fee/privacy review remains mandatory before a paid pilot.
