# MatchPath acceptance coverage reconciliation — 2026-11-22

Source: docs/ACCEPTANCE_TESTS.md (A01–A24). This is a release-control gap analysis, **not** test execution or customer acceptance.

## Finding
The documented acceptance checklist contains **24** scenarios (A01–A24), whereas the recently reported evidence gate requires **12** scenario records. Without an explicit mapping and coverage proof, a passing 12-record gate must never be described as acceptance of all 24 checklist controls.

## Required evidence ledger
For each A01–A24 record: scenario ID; deployed commit and environment; synthetic test identity and role; UTC execution time; request/response evidence with secrets removed; expected/observed outcome; relevant database event reference; tester; PASS/FAIL/BLOCKED; and independent reviewer. Do not accept screenshots alone for negative RLS tests.

## Risk-first execution sequence
1. **Authorization and isolation**: A02, A03, A04, A09, A13, A14, A24. Use at least two unrelated synthetic customer accounts and a staff account. Confirm both REST/RPC and storage access denial.
2. **Submission integrity**: A10, A11, A12, A15, A16, A17. A customer approval is not an employer submission; submission requires staff action, confirmation, and immutable selected document versions.
3. **Discovery and import**: A05–A08, A19, A23. Confirm threshold enforcement, idempotency, deduplication, malformed input rollback, and concurrency.
4. **Identity and operations**: A01, A18, A20, A21, A22. Verify redirects, audit trails, HTML escaping, malicious/oversized file rejection.

## Release rule
BLOCK commercial pilot until all A01–A24 are individually evidenced and independently reviewed, with zero critical security failures; the evidence-gate's 12 records are insufficient unless an explicit reviewed mapping proves full coverage. Separately BLOCK paid operation pending qualified Ontario licensing, candidate-fee and privacy review. Never use real candidate data to manufacture test evidence.

## Next executable task
Build a synthetic test harness that records per-scenario evidence and runs negative cross-customer REST/RPC/storage checks. Run against an authorized test deployment only; never copy production credentials into source control.
