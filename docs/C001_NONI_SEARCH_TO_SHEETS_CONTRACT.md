# MatchPath C001 — Repeatable search-to-Sheets contract (2026-10-15)

**Status:** Search instructions and import mapping, not a live automatic connection to a different ChatGPT conversation. Existing chat: **Noni Noni Job Search**. Target: https://docs.google.com/spreadsheets/d/1wOhnn2b-mnLQ7Ga9gs7qKXCeorg4PghkrSY0TOKqk3I/edit

## Copy into the existing search chat (once)
You are the MatchPath search operator for customer C001-NONI. At each request to **Run MatchPath search**, use the approved profile and prior-application list already in this conversation. Search Toronto/GTA first, Ontario second; prioritize permanent finance/accounting/FP&A/budgeting/financial analyst/business officer roles, especially public employers and verified defined-benefit pensions. Exclude contracts/temporary roles and previously applied *exact requisitions*. Do not assume a salary minimum or a work-mode restriction that the customer has not confirmed. Verify current job-specific employer/ATS URLs and evidence of posting status. Do not invent openings, salaries, fit evidence, requisition IDs, dates or experience.

For each run, output:
1. A brief funnel summary: discovered, duplicates, rejected mandatory, needs verification, qualified, recommended.
2. A machine-readable UTF-8 CSV block with EXACTLY the 17-column header from `job_search_template.csv` below, in that order. CSV quoting must be RFC 4180 compliant. Use a unique `search_run_id` and offset-aware ISO timestamp. `customer_id` is the **pilot alias C001-NONI**, not a Supabase UUID. Set `qualification_status` only to Qualified, Not Qualified, or Needs Verification. `fit_score` is an integer 0–100 or blank when unsupported. Do not mark Qualified if mandatory information is missing.
3. A verification note per recommendation, with source link and unresolved issues. Do not place sensitive resume details into the CSV.

Header:
```csv
schema_version,customer_id,search_run_id,searched_at,job_title,company,location,work_arrangement,salary_min,salary_max,currency,job_url,source,fit_score,qualification_status,fit_reason,concerns
```
Every row must have `schema_version=1.0`. Only genuinely verified postings should enter the customer recommendation queue. If none qualify, output the header with no rows and report zero recommendations.

## Google Sheet mapping (17-column CSV -> 23-column Jobs tab)
- job_key: canonical job URL (or employer + requisition ID if verified). **Never a row number**.
- search_run_id <- search_run_id
- discovered_at <- searched_at
- employer <- company
- job_title <- job_title
- requisition_id <- verified posting ID, otherwise blank
- location <- location
- work_arrangement <- work_arrangement
- salary_min/max/currency <- corresponding CSV values
- job_url <- job_url
- source <- source
- posting_verified_at <- actual staff verification timestamp, not automatically the search time
- mandatory_status <- qualification_status mapped Qualified→Pass, Not Qualified→Fail, Needs Verification→Hold; this is provisional pending deterministic recheck
- fit_score <- fit_score
- fit_evidence <- fit_reason
- concerns <- concerns
- status: NEW qualified verified jobs -> New; unverified -> Hold; rejected -> omit from customer queue or retain as Blocked according to staff policy.
- approved_at, applied_at, application_confirmation, last_updated_at: backend-owned; never supplied by AI.

**Update behavior:** Deduplicate by canonical URL / verified requisition. Existing status and application fields are immutable to the importer. Never downgrade Approved, Preparing, Ready to Apply, Applied, Skipped or Blocked. Preserve status history. Flag materially changed posting for staff review.

## Pilot operating steps
1. Staff triggers **Run MatchPath search** in Noni's existing chat.
2. Staff checks URLs, exclusions, exact requisitions and hard filters. Record verification timestamp.
3. Export CSV and validate header, customer alias, URL, duplicate key, allowed qualifications, score range and date.
4. Map and upsert into the Google Sheet through an authorized backend or reviewed staff import; no public browser credentials.
5. Update Runs counts; append StatusHistory for status transitions. Customer app reads through authenticated backend. **No direct live Sheets/app sync has yet been deployed.**

## Required acceptance tests
A: two imports of the same posting create one job; B: Approved survives re-import; C: Applied survives re-import; D: previously applied exact requisition is suppressed; E: missing mandatory detail -> Hold; F: customer A cannot read/write customer B; G: unverified URL never becomes New; H: no invented UUID; I: changed posting flags staff review; J: audit log records actor/time.

## Notes
The pilot alias is not a valid Supabase UUID. Convert to an actual customer UUID only after a dedicated backend and authenticated account are configured. Do not put real resume contents in this public repository. ChatGPT chat instructions cannot be edited remotely by a GitHub commit; paste the instruction section into the existing chat to activate it.
