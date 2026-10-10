# MatchPath — Staff Operating Manual (MVP v1.1)

## Roles

- **Customer:** uploads baseline resume, maintains approved search profile, reviews job matches, approves/rejects each job, downloads exact submitted documents.
- **Staff:** selects one assigned customer, runs ChatGPT search in the corresponding chat, verifies sources, imports results, prepares PDFs for customer-approved jobs, manually submits to employers, and records confirmation.
- **Admin:** all staff capabilities plus account/role management and staff-to-customer assignments. In the founding pilot, one staff member may be assigned **all** customers.

## Step A — Daily search batch (per customer)

1. Sign in and choose the **correct customer** from the dropdown. Copy their UUID from the Import screen.
2. Open that customer's dedicated authorized ChatGPT thread with verified resume and profile. Confirm preferences and excluded employers.
3. Search genuinely accessible job postings. Never invent positions, salaries, URLs, or credentials.
4. Export a **UTF-8 CSV** with EXACTLY these 17 columns, in this order:

```csv
schema_version,customer_id,search_run_id,searched_at,job_title,company,location,work_arrangement,salary_min,salary_max,currency,job_url,source,fit_score,qualification_status,fit_reason,concerns
```

5. Set `schema_version=1.0`; set every `customer_id` to the selected UUID, and `search_run_id` to a unique run ID, e.g. `CUST001-20261010-AM`. Search timestamp includes timezone. Use only HTTPS specific-job URLs. Fit score is 0-100 or empty when unverified; `qualification_status` must be Qualified, Not Qualified, or Needs Verification.
6. Visit the links and verify that job requirements and pay were not invented; check excluded employers and prior application records.
7. Upload CSV to staff portal, review counts and example rows, click **Import validated batch**. If imported previously, it must not create duplicates. Fix any errors before trying again.
8. New qualified matches above customer threshold appear in the customer's To Review queue; rejected/not-qualified records stay recorded without being presented as new recommendations.

## Step B — Customer approval

1. Wait for each customer's positive approval. No implied permission.
2. On approval the backend creates a unique `applications.id` **UUID** and human-readable `application_code` (e.g. APP-...).
3. Never assign or guess application identifiers inside ChatGPT.
4. Check whether the job is still open and whether the customer has already applied outside MatchPath.

## Step C — AI document production and upload

1. In the customer-specific ChatGPT thread, provide only that customer's verified source resume, the approved job posting, application UUID and application display code.
2. Request an evidence-based resume and a cover letter per approved job. Do not fabricate claims.
3. Preview for chronology, role/company name, contact details, qualifications, and formatting. Escalate personal screening questions to customer.
4. Export PDF resume and PDF cover letter, each under 6 MB. For a ZIP batch, place files under folders named by **application_code**, e.g.:

```
MatchPath_20261010.zip
  manifest.csv
  APP-AABBCCDDEE11/resume.pdf
  APP-AABBCCDDEE11/cover_letter.pdf
```

5. Manifest columns (exact five): `schema_version,customer_id,application_id,resume_file,cover_letter_file`. The `application_id` contains actual application UUID; file paths use the display code folders. Do not make them the same identifier.
6. Upload via Staff → Document uploads, preview, then commit. Alternatively upload one PDF against the selected application and its correct document type.
7. Check that both documents show up in the application's detail and versions increment without overwriting previous submissions.

## Step D — Submit and record

1. Open the **Approved applications** queue.
2. Select the employer posting and download the displayed job-specific PDFs.
3. Submit manually in the employer's legitimate application system. Do not bypass security or CAPTCHA improperly.
4. Only click **Mark ready** once both PDFs are uploaded; use **In progress** while applying.
5. Click **Mark submitted** only once genuinely submitted, entering the employer confirmation/reference and optional notes. It locks exact submitted document versions.
6. If closed, duplicate, incomplete, or blocked, use **Blocked** and seek customer clarification; never falsely mark submitted.
7. The customer dashboard updates to show submitted status, date, reference, and exact document versions.

## One-person pilot schedule

- Morning: run all assigned customers' search chats and batch-import CSVs.
- During day: monitor customer approvals, produce tailored documents in that customer's chat, batch ZIP upload.
- Later: work through approved applications queue, complete manual employer submissions and record proof.
- Daily close: audit exceptions/blocked jobs, check outstanding approvals, time spent per stage, and document mismatches.

## Quality and privacy controls

- Every document belongs to exactly one customer and application.
- No customer file in GitHub, public URLs, personal WeChat threads, or shared unlicensed ChatGPT credentials.
- Staff accounts get assignments; only assigned customers are visible under database authorization. Admin can reassign without restructuring storage.
- Do not assume the 60/month maximum can be achieved or that postings remain active. The cap is not a guaranteed volume.
- Suspend paid launch until Ontario recruiter licensing and fee charging restrictions are assessed.
