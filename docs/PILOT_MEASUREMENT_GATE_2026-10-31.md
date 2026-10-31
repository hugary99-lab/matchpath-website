# MatchPath — synthetic pilot measurement gate (2026-10-31)

Production baseline, aggregate read-only query: 2 customer profiles, 1 reference resume, 3 search runs, 7 jobs, 4 applications. These are records, not proof of completed onboarding or applications.

## Acceptance evidence per synthetic case
Record case ID, role, consent state, action, expected outcome, actual outcome, timestamp, and evidence reference. Required cases: customer saves mandatory/flexible preferences; uploads/downloads a fictional PDF; unassigned staff is denied access; assigned staff sees only assigned customer; customer grants AI consent and later revokes it; revoked consent prevents a new AI request; approval does not submit to an employer; authorized human marks an application submitted with evidence. Never use a real person's resume for this test.

## Pilot unit economics
For each synthetic or legally cleared pilot customer, record: setup minutes, search minutes, job verification minutes, tailored resume/letter minutes, human application minutes, QA minutes, AI spend CAD, staff cost CAD, refunds, and monthly revenue CAD. Contribution = revenue - AI cost - staff cost - processing - infrastructure. Separate 'approved' from 'submitted' and source-listed jobs from verified-open jobs. No payment collection until licensing, privacy, and fee review are complete.

Release gate: every security-negative case passes and one complete synthetic journey has timestamped evidence. Source tests alone are insufficient.
