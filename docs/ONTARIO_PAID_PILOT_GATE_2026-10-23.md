# MatchPath — Ontario paid-pilot legal/privacy release gate (2026-10-23)

**Decision: HOLD paid Ontario pilot pending qualified counsel review.** This is a source-based issue checklist, not legal advice or a determination that MatchPath is or is not licensed.

## Verified legal source findings

1. Ontario's Employment Standards Act guidance defines a recruiter as a person who, **for a fee**, finds or attempts to find Ontario employment for a prospective employee, or finds employees for Ontario employers. It expressly includes **monthly subscription** fee arrangements. MatchPath's proposed paid done-for-you discovery/application service could be in scope. Source updated June 18, 2026:
   https://www.ontario.ca/document/your-guide-employment-standards-act-0/licensing-temporary-help-agencies-and-recruiters
2. As of January 1, 2026, the licence application fee is generally **CAD $1,500**, and a new licence generally lasts two years. This is **not** a substitute for obtaining the licence.
3. The general **CAD $25,000 security** requirement has an important exception for recruiter-only applicants who will not recruit foreign nationals or who only recruit foreign nationals for positions at/above the applicable Ontario median hourly wage; verify the actual business scope with counsel and the ministry. Do not assume the exception applies.
   https://www.ontario.ca/page/licensing-temporary-help-agencies-and-recruiters
4. Ontario's Employment Protection for Foreign Nationals Act prohibits recruiters from charging covered foreign nationals for **any service, good or benefit**, including optional resume/interview preparation. Do not market a fee-based recruitment pilot to this group without legal clearance.
   https://www.ontario.ca/document/employment-standard-act-policy-and-interpretation-manual/section-7-prohibition-against-charging-fees
5. Federal PIPEDA applies to personal information in commercial activities; collection/use/disclosure generally require appropriate consent and limited, stated purposes. Resumes and job preferences are personal information.
   https://www.priv.gc.ca/en/privacy-topics/information-and-advice-for-individuals/your-privacy-rights/businesses-and-your-personal-information/

## Release controls (all require evidence)
- [ ] Written counsel assessment of Ontario recruiter classification, fee restrictions, licensing and security applicability.
- [ ] Approved customer contract describing what human staff do, no guaranteed outcomes, and applicant approval before any employer submission.
- [ ] Consent separated for storing a resume, sharing with staff, AI processing, employer applications and optional communications.
- [ ] Staff/customer RLS negative tests, private file signed-URL tests, role revocation tests, audit log review and incident-response contact.
- [ ] Retention/deletion and customer access/export process tested; no real resumes in GitHub, logs or public website.
- [ ] Synthetic onboarding and job-approval/application lifecycle passed before paid pilot.
- [ ] Unit economics validated with actual minutes per qualified job, per tailored application, customer acquisition and support costs.

## Pilot boundary
Until these gates pass: no payments, no real candidate resumes, no automatic employer applications, no paid AI processing of real customer information. Synthetic tests and code reviews may proceed.
