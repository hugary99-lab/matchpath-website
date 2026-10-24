# MatchPath C001 — Repeatable search-to-import contract (updated 2026-10-24)

**Status:** Manual pilot contract for ChatGPT search export -> MatchPath import. Customer identity, run identity, deduplication and application history are owned by MatchPath, not by the AI-generated CSV.

## ChatGPT search instruction
You are the MatchPath search operator for Noni Noni. Use the approved Noni search profile and verified resume evidence. Search Toronto/GTA first, Ontario second; prioritize permanent finance/accounting/FP&A/budgeting/financial analyst/business officer roles, especially public employers and verified defined-benefit pensions. Exclude temporary/contract roles. Do not invent openings, salaries, fit evidence, requisition IDs, dates, pension details, credentials or experience.

Search current employer career sites and official applicant-tracking systems. Verify current job-specific URLs and whether each position is still accepting applications. Apply mandatory filters before scoring. Use `Needs Verification` when a material mandatory requirement cannot be verified.

ChatGPT is **not** the system of record for duplicates or previous applications. MatchPath performs those checks at import time against the selected customer's database records.

For each run, output:
1. A brief search funnel: discovered, rejected mandatory, needs verification, qualified, recommended.
2. A machine-readable UTF-8 CSV with EXACTLY the 15-column header below, in order. CSV quoting must be RFC 4180 compliant.
3. Verification notes with source links and unresolved issues.

## MatchPath Standard v1.0 CSV

```csv
searched_at,job_title,company,requisition_id,location,work_arrangement,salary_min,salary_max,currency,job_url,source,fit_score,qualification_status,fit_reason,concerns
```

Rules:
- `searched_at` must be an offset-aware ISO 8601 timestamp.\n- `requisition_id` should contain the employer/ATS requisition ID only when it is explicitly verified from the posting; otherwise leave it blank. MatchPath may conservatively extract one from clear URL patterns.
- `job_url` should be the direct official employer/ATS job-specific URL whenever available.
- `fit_score` is an integer 0-100 or blank when unsupported.
- `qualification_status` is only `Qualified`, `Not Qualified`, or `Needs Verification`.
- Do not include personal contact details or resume text in the CSV.
- If no jobs qualify for import, output the header only.

## Identity ownership

The CSV intentionally does **not** contain:
- `schema_version`
- `customer_id`
- `search_run_id`

At upload time MatchPath backend:
1. applies the current MatchPath import schema version (`1.0`);
2. receives the customer selected in the authenticated staff/admin workspace and validates that the actor may work on that customer;
3. generates a unique external search-run ID inside Supabase;
4. stores the internal customer ID and internal search-run UUID on imported jobs;
5. records the generated metadata in the run/audit response.

The browser does not generate or inject schema/run metadata into CSV rows.

This prevents ChatGPT from assigning a result to the wrong customer or reusing a stale run ID.

## MatchPath import mapping

- internal customer_id <- selected MatchPath customer workspace
- internal search_run_id <- MatchPath-created search run
- discovered/searched time <- `searched_at`
- job_title <- `job_title`
- company <- `company`
- location <- `location`
- work_arrangement <- `work_arrangement`
- salary_min/max/currency <- corresponding CSV values
- job_url <- `job_url`
- source <- `source`
- fit_score <- `fit_score`
- qualification_status <- `qualification_status`
- fit_reason <- `fit_reason`
- concerns <- `concerns`

## Authoritative deduplication and status rules

MatchPath, not ChatGPT, is authoritative.

1. Normalize job URLs and remove tracking parameters.
2. Build a canonical job key.
3. Extract an employer requisition/job ID when reliably available.
4. Check the selected customer's existing jobs/applications.
5. Prefer exact employer + requisition ID when available, then canonical URL/key.
6. Treat employer + normalized title + location only as a review fallback, not an automatic duplicate rule.
7. Preserve existing workflow/application state. Never reset an existing Approved, Preparing, Ready to Apply, Applied/Submitted, Skipped/Hold or Blocked job to New.
8. New verified Qualified jobs may enter the review queue.
9. Needs Verification jobs must remain held for review.
10. Never mark a job Applied/Submitted without genuine submission confirmation.
11. Record duplicate and previously-applied outcomes in the run/audit history.

## Manual pilot operating steps

1. Run the approved Noni search in ChatGPT.
2. Download the 15-column MatchPath CSV.
3. In MatchPath staff/admin workspace, select Noni.
4. Upload the CSV.
5. MatchPath validates the 15 job-result columns and previews the batch.
6. Commit the import.
7. Supabase assigns schema/customer/run metadata, deduplicates against Noni's existing jobs and applications, and preserves existing states.
8. Review the run counts and any held results.

## Required acceptance tests

A. The CSV has exactly 15 columns and no customer/run identity fields.
B. The selected MatchPath workspace determines the customer.
C. MatchPath generates a unique run ID.
D. Two imports of the same posting create only one job.
E. Existing Approved/Preparing/Ready/Submitted states survive re-import.
F. Previously applied exact requisitions are not surfaced as new.
G. Missing mandatory detail is held for verification.
H. Cross-customer reads/writes are denied.
I. Invalid/unverified URLs never become trusted new jobs.
J. Audit history records the actor and time.

## Notes
The production backend now owns `schema_version=1.0` and generates the search-run ID. The authenticated MatchPath workspace supplies only the selected customer parameter; the CSV contains none of these system fields.
