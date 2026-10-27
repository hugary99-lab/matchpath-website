# MatchPath release evidence — 2026-10-27

**Release decision: NOT ACCEPTED for real customer or paid operations.** This report uses aggregate read-only Supabase queries and source/deployment checks only. No private customer documents, identities, applications, or contact details were opened.

## Change since 2026-10-26
| Aggregate | Oct 26 | Oct 27 |
| --- | ---: | ---: |
| Customer profiles | 2 | 2 |
| Reference resume metadata | 1 | 1 |
| Candidate Evidence versions | 1 | 1 |
| Current Search Strategy versions | 0 | 1 |
| Current general resume versions | 0 | 2 |
| Search runs | 1 | 3 |
| Job records | 5 | 7 |
| Applications | 4 | 4 |
| Submitted applications | 0 | 0 |
| Staff assignments | 1 | 1 |

The new strategy/resume/search records show partial workflow activity, **not** synthetic acceptance, external job verification, real employer submissions, or approved customer consent.

## Security finding and deployed fix
The three active AI Edge Functions previously checked actor access but did not check the customer's standing AI-processing authorization before sending resumes/profile data to OpenAI. The new consent table already existed and was enforced for document versions and application status transitions, but not at the AI API boundary.

On October 27, source guards were committed and **deployed**:
- `analyze-profile` v7: require active consent before AI resume analysis and AI strategy generation; allow non-AI strategy activation.
- `generate-general-resumes` v3: require active consent before general resume generation.
- `run-job-search` v13: require active consent for AI search and prompt improvement; allow local prompt preview without AI processing.

Each function fails closed if consent cannot be checked, or if it is missing/revoked. Deployed function source was read back and matched GitHub byte-for-byte; JWT verification remains enabled. New source-level contract: `tests/ai-consent-edge-contract.test.mjs` (five checks). GitHub `Validate MatchPath build` completed successfully on commit `6f8e4cdbf`.

**Consent baseline:** `document_authorizations` has **0 rows, 0 active authorizations, 0 managed-submission authorizations** at this check. Existing AI-generated records predate the new API guard or were created without a current standing-authorization record. Do not infer consent or use them in a real submission without proper customer review and authorization.

## Not established
- Live customer browser login, save/reopen onboarding, two dummy resume uploads/downloads.
- Multi-account cross-customer denial and staff assignment revocation.
- Active/revoked consent response tests with synthetic customer sessions; no live OpenAI request was made.
- Search fit scoring quality, provenance, human-only employer application and immutable submitted versions.
- Ontario recruiter licensing, customer-fee permissibility and privacy/legal clearance.

**Next gate:** With synthetic accounts and files only, prove consent denied -> granted -> revoked for all three functions, and complete onboarding plus cross-customer authorization. No paid recruitment or real personal data until clearance.
