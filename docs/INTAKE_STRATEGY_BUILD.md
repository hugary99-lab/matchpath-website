# MatchPath intake and reusable search strategy — implementation contract (2026-10-16)

Status: **design committed; not deployed or accepted**. Current beta already supports customer profile editing, private baseline PDF upload, job CSV import, and customer approval. This contract extends those capabilities; it does not claim AI execution is live.

## Customer journey
1. Customer signs in and chooses **DIY** or **Full Service** (service tier is not a permission role).
2. Customer uploads baseline resume PDF and supplies primary roles, adjacent/transferable roles, employment type, geography/relocation, work arrangement, salary **currency and minimum**, pension preference, industry preferences, exclusions, and free-text goals.
3. Every criterion is labeled **mandatory** or **preferred**. A missing answer remains unspecified, not an inferred hard filter.
4. Customer explicitly consents to resume processing, third-party AI processing (provider and retention disclosed), and retention/deletion policy. No external AI processing before consent.
5. System drafts a **versioned search strategy**; customer can review, edit, and approve it. No unapproved strategy becomes active.
6. Operator generates a daily prompt from approved strategy version plus run date and previously seen/applied IDs. Search results require verifiable employer/ATS URLs, evidence, checked timestamp, status, fit score, and deduplication.
7. Customer approves opportunities; job-specific documents are prepared only after approval. DIY sees **Download** and **Apply** (external employer URL). Full Service follows staff queue subject to regulatory clearance.

## Data design (additive migration required)
- customer_profiles: existing columns retained; add service_tier enum/check, employment_type, salary_currency, relocation, pension_preference, industry_preferences, transferable_roles, consent version/time. Never store raw resume in public tables.
- customer_search_criteria: customer_id, criterion_key, value_json, priority ('mandatory','preferred'), updated_at; owner-only write, authorized assigned-staff/admin read as required.
- search_strategies: id, customer_id, version, strategy_json, status ('draft','approved','superseded'), created_at, approved_at, approved_by; unique customer/version; only owner can approve.
- search_executions: id, customer_id, strategy_id, executed_at, operator_id, status, source_count, screened_count, rejected_count, qualified_count, imported_count, failure_reason. Distinguish attempted vs completed.
- Private resume storage: enforce owner/customer scoping, signed URLs and MIME/size limits; scan uploads as appropriate.

## Daily prompt contract
Inputs: approved strategy JSON, strategy version, customer pseudonymous ID, run date, previously reviewed canonical keys, approved/applied keys. Avoid sending direct identifiers or baseline resume unless needed and consented.
Outputs: stable CSV schema already in repo; no fabricated URLs, salaries or availability; unverifiable jobs marked Needs Verification; source listings are not evidence of active/open vacancies. Separate discovery from fit assessment. Record counts of screened, filtered, qualified, recommended, approved, applied.

## Security and acceptance gates
- RLS denies customer A reading/writing customer B profile, strategy, files, and executions.
- Staff only sees explicitly assigned customers. Customer cannot elevate service tier to staff/admin role.
- No strategy can be executed until customer approval and required consent.
- Strategy updates create a new version; daily runs pin the exact version.
- Duplicates and previously applied jobs suppressed for the same customer; changes to posting may be reviewed but not silently treated as new.
- Test DIY download and employer-link actions; external navigation is **not** proof of application submission.
- Test malicious filenames, oversized/non-PDF uploads, missing consent, expired links, revoked access, and failure recovery.
- No live customer data or payments until privacy, terms, Ontario licensing/fee restrictions and security tests are cleared.

## Next implementation order
1. Add additive migration and RLS tests.
2. Extend existing beta profile form to intake fields and consent, retaining existing resume storage.
3. Implement deterministic strategy JSON validation and review/approve UI; AI generation remains a separately gated operator action until approved provider integration.
4. Implement operator daily prompt generator and CSV import audit.
5. Implement DIY Download/Apply and service-tier routing; end-to-end synthetic QA before release.
