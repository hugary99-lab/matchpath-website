# MatchPath release evidence — 2026-10-26 (read-only)

This note supersedes the 2026-10-24 counts in `docs/READINESS_GAPS_2026-10-24.md`. It is not a production acceptance certificate. No customer content, resumes, identities, job URLs or application materials were opened.

## Verified connected state (October 26)
- Dedicated Supabase project: ACTIVE_HEALTHY.
- Aggregate rows: 2 customer profiles, **1 reference-resume metadata row**, 1 search run, 5 jobs, 4 applications (**0 submitted**), 1 staff assignment.
- Candidate Evidence: **1 version**. Search Strategy versions: **0**. General Resume versions: **0**.
- `candidate_evidence_versions`, `search_strategy_versions` and `general_resume_versions` **exist** and all have RLS enabled. The older table name `search_strategies` does not exist; do not confuse this with missing versioned-strategy support.
- The deployed Edge Functions include `run-job-search` (v9), `analyze-profile` (v4), and `generate-general-resumes` (v1), all active with JWT verification. An active function does not establish a successful full workflow.
- `reference_resumes`, `customer_profiles`, `staff_assignments` also have RLS enabled. These configuration checks do not prove cross-customer denial.

## Static pipeline contract added October 26
`tests/profile-pipeline-contract.test.mjs` adds eight source-level checks for:
1. Preserving explicitly claimed experience as candidate-stated even without detailed role bullets.
2. Recommending concrete resume strengthening instead of deleting such claims.
3. Invalidating evidence when source resume IDs change.
4. Keeping new strategies in draft until explicitly activated.
5. Requiring a current strategy and matching evidence for general resume generation.
6. Recording source evidence/strategy IDs in each generated general resume.
7. Disabling the UI generation button for stale inputs.
8. Presence of the relevant UI actions.

Equivalent assertions were evaluated against the fetched source in the connector's V8 environment. **Node CI execution and real-account browser testing have not been verified.**

## Remaining release gate
- Synthetic customer A: login, save/reopen mandatory versus flexible preferences, upload two dummy PDF/DOCX resumes, download both.
- Synthetic customer B: denied A's metadata and signed file URLs.
- Assigned staff: permitted access only to assigned A; after revocation access denied.
- Profile analysis: explicit AI consent and provenance; review Candidate Evidence, activate Search Strategy, generate a general resume from synthetic content.
- Human-only application: no submission without staff confirmation; verify status change and immutable documents.
- Privacy and Ontario recruiter-licensing/fee classification before any paid pilot.

**Decision:** NOT ACCEPTED for real paid customer use. Aggregate activity demonstrates partial operation, not end-to-end acceptance.
