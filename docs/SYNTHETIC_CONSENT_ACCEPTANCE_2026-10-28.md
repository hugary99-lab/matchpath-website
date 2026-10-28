# MatchPath synthetic consent and authorization release gate — 2026-10-28

Status: **NOT EXECUTED / NOT ACCEPTED**. No private customer content may be used for this test. The October 27 deployed AI Edge Function guards are source/deployment evidence only, not authenticated behavioral acceptance.

## Read-only production baseline (October 28)
Supabase project `ufvokkyoyodmevzxnlwc` is ACTIVE_HEALTHY. Counts: 0 document authorizations, 3 search runs, 7 jobs, 4 applications, 1 reference resume, 1 search strategy, 2 general resumes, 0 submitted documents. No proof of customer consent can be inferred from historical AI outputs.

## Synthetic acceptance protocol
Use **two new synthetic customers A/B**, one assigned staff user and one unrelated staff user; synthetic PDFs only. Never grant standing consent to a real account for a test.

| ID | Setup/action | Required observation | Evidence to capture |
|---|---|---|---|
| MP-01 | A saves all onboarding fields; reloads | Mandatory vs flexible preferences preserved; no AI call | redacted screenshots + request trace |
| MP-02 | A uploads two synthetic PDFs and downloads each | Both private files available to A; metadata correctly scoped | storage object IDs and HTTP status only |
| MP-03 | B attempts to read A profile/resume/document | 403/404 or empty row; no signed URL | status and policy check |
| MP-04 | Unassigned staff attempts A resume access | denied | status |
| MP-05 | Assigned staff reads A resume, then assignment revoked | allowed before; denied after revocation | status |
| MP-06 | A with no authorization calls analyze-profile AI action | denied **before** external AI request | status + no provider call |
| MP-07 | A with no authorization calls generate-general-resumes | denied **before** external AI request | status + no provider call |
| MP-08 | A with no authorization calls run-job-search AI action | denied **before** external AI request | status + no provider call |
| MP-09 | A grants explicit AI-processing consent | timestamped, actor-bound record; clearly scoped processing | authorization audit event |
| MP-10 | With consent, run one bounded synthetic analysis | only synthetic data; expected provider call and output provenance | trace and result ID |
| MP-11 | A revokes consent, retries all three AI functions | all denied; no further provider calls | audit + provider request count |
| MP-12 | After revocation, local strategy preview only | allowed, **no AI provider request** | request trace |
| MP-13 | Customer approves a tailored synthetic application | approval does not mark submitted | application event |
| MP-14 | Staff prepares human-only submission; no employer submission performed | submitted count unchanged; document version immutable if later submitted | audit |
| MP-15 | A attempts to read B records; staff assigned to A attempts B | denied | status |

**Release criterion:** All 15 scenarios pass with repeatable evidence; no unauthorized AI requests, cross-tenant reads, or automatic employer submissions. Tests must be executed with authorized test sessions; this document does not assert they passed.

**Commercial hold:** No paid customer acquisition or real resume processing until Ontario recruiter licensing/fee restrictions and privacy review are resolved. Official guidance: https://www.ontario.ca/document/your-guide-employment-standards-act-0/licensing-temporary-help-agencies-and-recruiters .
