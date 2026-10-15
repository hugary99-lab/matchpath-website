# MatchPath pilot 001 — Noni (setup specification)

Status: SPECIFICATION ONLY. No live customer account, Google Sheet, ChatGPT Project, or Supabase record created. Obtain Noni's explicit consent before importing her resume or other personal data.

## Search configuration
Customer alias: C001-NONI (pilot identifier, not database UUID).
Geography: Toronto/GTA first, broader Ontario second.
Role families: finance, accounting, FP&A, budgeting, financial analyst, business officer, administrative/corporate positions aligned to experience.
Employment: permanent required by default; no temporary/contract unless customer changes preference.
Employer preference: public sector and related agencies; prioritize verified defined-benefit pensions; public-sector positions may be considered when pension is unconfirmed.
Skills: budget/forecast, variance analysis, SAP, Excel, reporting; verify all against approved resume.
Compensation: not specified; do not infer mandatory salary floor.
Previously applied: import customer-approved exclusion list; deduplicate by employer + requisition ID, not title alone.

## Workflow
1. Staff opens customer-specific authorized ChatGPT Project and triggers a manual search.
2. Confirm customer search preferences and previous application exclusions; verify each employer-specific job URL and posting freshness.
3. Apply mandatory filters BEFORE AI fit scoring. Missing critical facts -> Needs Verification.
4. Output schema v1.0, exactly matching existing 17-column `job_search_template.csv` (no guessed UUID).
5. Staff reviews CSV and imports through authorized backend. For the Google Sheets pilot, use one spreadsheet per customer as a staging/operations view; do not expose its edit credentials to the browser or customers.
6. App reads/writes status via authenticated backend with staff/customer authorization and audit history. No direct browser-to-Sheets secrets.
7. Customer approves/rejects; staff generates evidence-based documents for approved jobs and manually applies. Mark Applied only after confirmation.
8. Measure elapsed minutes, valid unique postings, recommendation acceptance, duplicate rate, AI usage, and application turnaround.

## Proposed sheet columns
job_key,run_id,discovered_at,employer,job_title,requisition_id,location,work_arrangement,salary_min,salary_max,currency,job_url,source,posting_verified_at,mandatory_status,fit_score,fit_evidence,concerns,status,approved_at,applied_at,application_confirmation,last_updated_at

Allowed sheet statuses: New, Reviewed, Approved, Skipped, Preparing, Ready to Apply, Applied, Hold, Blocked. Reject invalid transitions; record actor and timestamp in a separate status history.

## Acceptance criteria
- No customer data or resume processed without consent.
- 5 distinct verified job links with source evidence, excluding prior applications.
- Mandatory preferences tested, with at least one rejected and one held case.
- Sheet import/update and app read/write verified under two test identities with cross-customer access denied.
- One approved synthetic application progresses to Ready to Apply; no actual submission without authorization.
- Staff time and any billable AI usage recorded.
