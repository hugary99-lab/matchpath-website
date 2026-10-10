# MatchPath pilot go/no-go — 2026-10-10

Status: **planning and synthetic QA only; not cleared for paying customers**.

## Verified implementation status
- Public root is an interactive fictional-data demonstration; `/beta/` contains customer/staff/admin portal source.
- GitHub main has the beta portal, 17-column job import, 5-column document manifest, role/RLS SQL, and static tests. A dedicated MatchPath Supabase project is **not** provisioned; `beta/config.js` is blank.
- Do not infer that GitHub Pages is enabled or that the beta is usable on a real account without browser evidence.
- Never use Waytold, Pickleball or Senior Activities' database for MatchPath.
- Pilot flow: resume + mandatory/flexible preferences -> verified job search -> fit score (0–100) -> customer approves -> tailored evidence-based PDFs -> staff manually applies -> immutable submission record.

## Legal/commercial gate (Ontario; needs qualified advice)
Ontario's Employment Standards Act guide defines a recruiter to include a person who **for a fee finds or attempts to find Ontario employment** for prospective employees. It explicitly includes **monthly subscription** arrangements. Recruiter licensing requirements have been in effect since July 1, 2024. As of Jan 1, 2026, the general application fee is CAD 1,500 and the licence term is generally two years; security may be required depending on activities. Do not presume that labelling a product “job-search assistant,” “coaching,” or “AI subscription” exempts a human-submitted application service. Distinct prohibitions on charging foreign-national job seekers may apply. **Obtain Ontario employment-law advice on classification, candidate fees, licensing, and cross-border scope before accepting payments or operating the service.** This note is not legal advice.

Official sources:
- https://www.ontario.ca/document/your-guide-employment-standards-act-0/licensing-temporary-help-agencies-and-recruiters
- https://www.ontario.ca/laws/regulation/r23099
- https://www.ontario.ca/page/licensing-temporary-help-agencies-and-recruiters
- https://jobs.ontario.ca/document/employment-standard-act-policy-and-interpretation-manual/section-7-prohibition-against-charging-fees

## $100/month unit economics — hypothesis to measure, NOT actual operating cost
Assume 4 staff hours/customer/month fixed for profile maintenance, sourcing, matching QA, support and status reporting, plus an **optimistic** 15 minutes of human time per manually submitted tailored application (review/QA, portal questions, upload, evidence). At CAD $20/hour loaded labour, before AI, software, taxes, overhead, licensing, and customer acquisition:

| Applications/month | Hours/customer | Labour cost | Gross margin on $100 before other costs |
| ---: | ---: | ---: | ---: |
| 10 | 6.5 | $130 | -$30 |
| 20 | 9 | $180 | -$80 |
| 40 | 14 | $280 | -$180 |
| 60 | 19 | $380 | -$280 |

At $100 and 4 fixed hours, only **4 applications at 15 min each** fit within the remaining $20 labour allowance. The original “3–4 applications daily” scenario is incompatible with $100/month unless staff time, price, or scope changes dramatically. A fit score of 90 means *estimated fit*, not 90 applications or a 90% chance of an interview.

## Measurable next milestone: 3 synthetic end-to-end cases + 1 timed dry run
1. Finish **A01–A24** security/functional acceptance tests in `docs/ACCEPTANCE_TESTS.md` on a dedicated test backend, including two unrelated customer accounts and one staff account.
2. Execute three synthetic job lifecycles: rejected; approved -> PDF pair -> submitted with confirmation; duplicate/closed -> blocked. Preserve screenshots or audit evidence, no real resumes.
3. Time 10 synthetic or owner-authorized applications stage-by-stage: search+verify, fit, tailored resume/letter, form submission, record keeping. Compute median/p90 staff minutes and true cost.
4. Verify any real job listing independently; never import fictional listings as real opportunities.
5. Before charging, record written legal clearance and signed privacy/terms/retention policies.

Go/no-go: **NO-GO for paid pilot today**. It becomes GO only after legal classification and fee model, dedicated backend, live multi-tenant tests, operational timing, and customer consent all pass. Free concept interviews that do not involve recruiting activity can proceed subject to privacy.
