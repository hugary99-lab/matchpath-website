# MatchPath — C001-NONI ChatGPT Job Research Instructions

**Customer:** Noni Noni  
**MatchPath alias:** C001-NONI  
**Purpose:** Run a fresh job search and produce a CSV that can be manually uploaded into the selected Noni workspace in MatchPath.

## 1. Operating principle

ChatGPT is responsible for **job research and qualification**.

MatchPath is responsible for **system metadata, customer identity, run identity, deduplication, existing application history, workflow status, and audit history**.

Do not put MatchPath-owned system fields into the CSV.

## 2. Customer search profile

### Geography
1. Toronto / GTA first.
2. Broader Ontario second.

### Employment type
- Permanent positions only unless the user explicitly requests otherwise.
- Exclude temporary, term, contract, casual, internship, and fixed-end-date roles.

### Target roles
Prioritize:
- Financial Analyst
- Senior Financial Analyst
- FP&A
- Budget Analyst
- Budget Coordinator
- Business Officer
- Accounting
- Financial Reporting
- Related finance / corporate administrative roles materially supported by the approved resume

### Employer priority
Prioritize:
- Government
- Municipalities
- Universities
- Hospitals
- Utilities
- Crown corporations
- Agencies, boards, commissions
- Other public / broader-public-sector organizations

### Pension
- Prefer verified defined-benefit pensions.
- Permanent public-sector jobs remain eligible if pension details are unconfirmed.
- Put unresolved pension information in `concerns`.
- Never invent pension eligibility.

## 3. Verified candidate evidence

Use only Noni's approved resume and verified experience.

Supported evidence includes:
- 15+ years progressive finance/accounting experience
- Budgeting and forecasting
- Variance analysis
- Financial reporting
- Month-end close
- Reconciliations
- Cash-flow forecasting
- Financial modelling
- Management reporting
- SAP
- Excel
- Operating budget support above $100M
- Capital project funding monitoring above $10M annually
- Multi-entity consolidation
- Financial controls and stakeholder collaboration

Do not claim unsupported credentials or tools such as CPA/designation, CPA-in-progress, Power BI, Python, SQL, SAS, Yardi, healthcare funding, federal transfer payments, underwriting, securitization, regulatory modelling, or machine learning unless new verified evidence is supplied.

## 4. Research procedure

For each run:

1. Search current official employer career sites and official ATS systems first.
2. Use secondary sources only to discover a possible posting; prefer the official employer/ATS job-specific URL in the final result.
3. Verify that each candidate posting:
   - is job-specific;
   - is currently accepting applications;
   - satisfies the permanent-employment rule;
   - is within approved geography;
   - has enough information to assess mandatory qualifications.
4. Apply mandatory filters before calculating fit score.
5. Score suitable opportunities from 0-100 using evidence from the approved resume and posting.
6. Normally treat fit score 90+ as Recommended.
7. If a material mandatory requirement is unclear, use `Needs Verification`.
8. Never invent job status, salary, work arrangement, posting dates, closing dates, requisition IDs, pension details, qualifications, or candidate experience.
9. Do not rely on ChatGPT memory as the final authority for duplicates or previous applications. MatchPath performs the authoritative database check after upload.

## 5. Qualification values

`qualification_status` must be exactly one of:

- `Qualified`
- `Needs Verification`
- `Not Qualified`

### Qualified
Known mandatory criteria pass and the posting is current.

### Needs Verification
The role may be suitable, but a material item remains unresolved.

Examples:
- permanent status unclear;
- mandatory designation unclear;
- mandatory experience requirement ambiguous;
- job-specific URL cannot be fully verified.

### Not Qualified
A known mandatory criterion fails.

Examples:
- temporary or contract position;
- required credential is absent;
- mandatory specialized experience is clearly absent;
- role is outside approved geography or scope.

For the normal upload file, include only `Qualified` and `Needs Verification` rows unless the user explicitly requests rejected rows for audit.

## 6. CSV that ChatGPT must populate

Create a UTF-8 RFC 4180-compliant CSV with **exactly these 15 columns in this exact order**:

```csv
searched_at,job_title,company,requisition_id,location,work_arrangement,salary_min,salary_max,currency,job_url,source,fit_score,qualification_status,fit_reason,concerns
```

### Field rules

| Field | ChatGPT responsibility |
|---|---|
| `searched_at` | Offset-aware ISO 8601 timestamp for this research run. |
| `job_title` | Exact verified posting title. |
| `company` | Exact employer name. |
| `requisition_id` | Employer/ATS requisition ID **only when explicitly verified**. Otherwise leave blank. Do not guess. |
| `location` | Verified job location. |
| `work_arrangement` | Use `Remote`, `Hybrid`, `Onsite`, or `Unknown`. |
| `salary_min` | Verified numeric annual minimum only; otherwise blank. |
| `salary_max` | Verified numeric annual maximum only; otherwise blank. |
| `currency` | Verified currency, normally `CAD`; blank when unknown. |
| `job_url` | Direct HTTPS job-specific official employer/ATS link whenever available. |
| `source` | Employer/ATS source used for verification. |
| `fit_score` | Integer 0-100, or blank if a defensible score cannot be produced. |
| `qualification_status` | `Qualified` or `Needs Verification` for normal upload rows. |
| `fit_reason` | Concise evidence-based match explanation. |
| `concerns` | Material gaps, unknowns, pension uncertainty, credential issues, or other risks. |

### Requisition ID rule

Prefer an explicit requisition/job number shown on the employer or ATS posting.

Examples of acceptable values:
- `JR360747`
- `117188`
- `REQ-52160`

If no requisition ID is explicitly verifiable, leave the cell blank. MatchPath may conservatively extract a stable ID from clear ATS URL patterns during import.

## 7. Fields ChatGPT must NOT populate

The following are MatchPath/backend-owned and must not appear as columns in the research CSV:

| Backend-owned field | MatchPath behavior |
|---|---|
| `schema_version` | Supabase assigns current import schema metadata, currently `1.0`. |
| `customer_id` | Comes from the authenticated MatchPath customer workspace selected by staff/admin. |
| external `search_run_id` | Generated inside the MatchPath backend for each committed import. |
| internal search-run UUID | Generated/stored by Supabase. |
| internal job UUID | Generated/stored by Supabase. |
| `canonical_key` | Derived by MatchPath from normalized employer + canonical job URL. |
| normalized `requisition_id` | MatchPath normalizes the supplied ID or conservatively extracts one from a clear ATS URL when blank. |
| `review_status` | Backend workflow field; new imported jobs use backend defaults. |
| `created_at` / audit timestamps | Generated by Supabase. |
| duplicate/new counts | Calculated by MatchPath during import. |
| existing application status | Read from MatchPath database and preserved. |

## 8. MatchPath duplicate and applied-history logic

The uploaded CSV may contain a job ChatGPT has seen before. That is acceptable.

MatchPath is authoritative and checks in this order:

1. **Same customer + normalized employer + verified/derived requisition ID**.
2. **Same customer + canonical job URL/key**.
3. Employer + normalized title + location may be used only as a manual-review fallback, not as an automatic duplicate key.

Important:
- A changed URL does not create a new job when employer + requisition ID match.
- The same requisition number at a different employer does not collide.
- Existing workflow/application state must be preserved.
- Never reset an existing Approved, Preparing, Ready to Apply, Applied/Submitted, Skipped/Hold, or Blocked job to New.
- Never mark a job Applied/Submitted unless a genuine employer submission has been confirmed.

## 9. Required ChatGPT response

Return exactly three useful outputs:

### A. Search funnel
Report:
- jobs discovered;
- rejected by mandatory criteria;
- needs verification;
- qualified;
- recommended (normally fit score >= 90).

Do not claim final duplicate or previously-applied counts unless MatchPath database results are actually available in the current execution. Those are backend import outcomes.

### B. Downloadable MatchPath CSV
Create the 15-column CSV described above and make it available for download.

### C. Verification notes
For every CSV row, provide:
- employer + title;
- direct application link;
- verified requisition ID, if available;
- why it passed or needs verification;
- unresolved issues;
- closing date if verified.

## 10. Short reusable command

When this instruction document is already available in context, the operator may use:

> Run the MatchPath job search for Noni using the approved C001-NONI research instructions. Search current official employer/ATS sources, verify postings, apply mandatory filters, score suitable roles, and create the downloadable MatchPath 15-column CSV. Do not decide final duplicate or previously-applied status from ChatGPT memory; MatchPath will perform those checks during import.
