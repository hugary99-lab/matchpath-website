# MatchPath career strategy engine — product contract

Status: architecture specification only; no AI provider or runtime deployed.

## Inputs
- **Where they are:** multiple reference resumes, customer-confirmed consolidated career profile, evidence-backed experience, skills, seniority, sector, achievements and qualifications.
- **Where they want to go:** customer-ranked objectives (career change, public/private transition, ladder-up, compensation, stability, work-life balance), target roles, industries, sectors, locations, timeframe, minimum vs target compensation, mandatory vs preferred constraints.
- **Constraints:** willingness to accept lateral or bridge roles, retraining, relocation, salary tradeoffs; explicit customer consent for AI processing.

## AI output: proposed Career Search Strategy
Versioned structured record:
- current_state_summary with evidence references and unresolved conflicts
- destination_goals ranked by customer priority
- gap_analysis (transferable strengths, missing requirements, realistic transition steps)
- search_lanes[] each with id, rationale, role titles/synonyms, sectors, target employers/sources, geography, filters, weighting, fit scoring, verification rules, bridge/stretch flag
- hard_exclusions, preferences, salary currency, thresholds, risks/assumptions
- approval_status (draft/approved/superseded), customer edits and timestamp

## Workflow
1. Collect multiple reference resumes; never replace originals.
2. Extract and consolidate verified career facts; surface conflicting claims for customer confirmation.
3. Customer approves master career profile and priorities.
4. AI proposes multiple search lanes; explain why each is realistic and how it advances destination.
5. Customer edits and approves strategy. Only approved versions are used in daily search.
6. Daily operator run reuses the exact strategy version with current search date and deduplication history. Output standard CSV, verified links and rationale.
7. Customer approves jobs; generate job-specific resume/letter grounded in approved career profile.
8. Customer feedback can trigger proposed strategy revision, never unannounced mutation.

## Guardrails
No fabricated achievements, postings, compensation, or credential claims. No AI processing of personal resumes without informed consent. Cross-customer RLS; private document storage. Do not confuse clicking an employer application link with successful submission.

## Acceptance
- Distinct search lanes for direct, adjacent, bridge and stretch opportunities.
- Mandatory constraints remain hard filters; ranked preferences influence score.
- Strategy ties every lane to a stated customer goal.
- Explicit customer review and approval before daily execution.
- Full audit trail of strategy version, run, job provenance, and submitted document versions.
