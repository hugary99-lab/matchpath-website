# MatchPath authenticated synthetic acceptance protocol — 2026-11-11

Status: **NOT EXECUTED**. This is a test protocol, not a production acceptance certificate. Never use real customer records or submit applications to employers.

## Preconditions
- Isolated fictional identities: Customer A (DIY), Customer B (Full Service), assigned Staff B, unassigned Staff C, Admin D.
- Fictional resumes and postings only; no external application or AI vendor upload without explicit approval.
- Capture browser timestamp, deployment commit SHA, test identity, request/response status, sanitized screenshot, and database event ID for each step.
- Run in an approved test environment or isolated synthetic tenant; do not mutate live customer records.

## Executable acceptance sequence
| ID | Actor | Action | Required observable result |
| --- | --- | --- | --- |
| MP-E2E-01 | A | Sign up, upload two fictional resumes, set mandatory location and salary and flexible skills | Both resumes and distinct preference types persist after re-login |
| MP-E2E-02 | A | Review fictional posting with missing mandatory salary evidence | Posting is flagged unverified, not silently approved as eligible |
| MP-E2E-03 | A | Approve one qualified fictional job; reject another | Approval statuses persist; rejected item excluded from submission queue |
| MP-E2E-04 | A | Decline AI processing and request generated resume | No generation or document upload occurs; denial is visible |
| MP-E2E-05 | B | Grant scoped AI processing but not managed submission | Document creation permitted only within consent scope; staff cannot record submission |
| MP-E2E-06 | B | Explicitly grant managed-submission permission | Assigned Staff B can record a **synthetic internal status**, never an actual employer submission |
| MP-E2E-07 | Staff C | Read B profile, files, and applications via UI and direct API | All requests denied; no private payload leaked |
| MP-E2E-08 | A | Read B records using forged customer_id through API | All requests denied; no private payload leaked |
| MP-E2E-09 | B | Revoke authorization; Staff B retries document preparation and submission record | Both blocked immediately; historical authorization/event retained for audit |
| MP-E2E-10 | Admin D | Review role and assignment audit trail | Actor, customer, timestamp, action and outcome traceable |
| MP-E2E-11 | Staff B | Export approved document, then change source resume | Previously approved/exported document remains immutable and versioned |
| MP-E2E-12 | Admin D | Reconcile application log | No 'submitted' status without human actor, evidence and explicit customer permission |

## Release rule
Pass requires 12/12 observed results with redacted evidence and no cross-tenant exposure. A source-level unit test, RLS metadata check, commit, or deployment is not a substitute. Any denial bypass, unauthorized generation, or cross-customer read is a hard stop.

## Commercial gate (separate)
Before accepting money or handling real customer data, obtain qualified Ontario recruitment/fee-model advice, privacy notice and consent review, retention/deletion rules, and operational staffing/cost validation. Keep the founder's personal job applications outside this commercial tenant.
