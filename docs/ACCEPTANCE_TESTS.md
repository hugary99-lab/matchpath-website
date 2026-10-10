# MatchPath — Acceptance and Security Tests

**All tests must use synthetic data in a dedicated Supabase project.** Record tester, date, expected vs actual, evidence and disposition. Code/CI passing is not a substitute for live RLS testing.

| ID | Scenario | Expected result |
| --- | --- | --- |
| A01 | Email signup and confirmation, log in/out | User account and customer profile created; session ends on sign out |
| A02 | Customer attempts direct UPDATE to `accounts.role` | Denied (no policy) |
| A03 | Admin promotes staff and assigns one customer | Staff sees only that customer's jobs and PDFs |
| A04 | Staff attempts unrelated customer CSV import by changing customer_id | RPC rejects unauthorized customer |
| A05 | Staff uploads valid 17-column CSV (2 qualified, 1 not, 1 duplicate) | Counts correct, only qualified threshold matches appear to customer |
| A06 | Same search_run_id imported twice | Second call is idempotent, no duplicate counts |
| A07 | Same posting in different search run | Unique customer/job deduplication retains original decision |
| A08 | Missing, malformed, invalid URL or wrong CSV columns | Error, no partial rows committed |
| A09 | Customer A tries to view Customer B jobs or applications via direct API | RLS rejects/returns none |
| A10 | Customer approves then rejects pending approved job | Application created, then closed if not submitted |
| A11 | Staff ZIP with correct 5-column manifest and two PDFs | Files privately uploaded and mapped to correct application |
| A12 | ZIP with wrong UUID, paths, missing PDF, renamed non-PDF, or customer mismatch | Rejected before commit |
| A13 | Customer attempts to access another customer's signed document link | Cannot mint signed link (verify by API) |
| A14 | Staff unassigned from a customer | Cannot list/download/import for that customer after refreshing session |
| A15 | Staff mark submitted before both PDFs or without confirmation | RPC rejects |
| A16 | Submit an application with confirmation | Event + immutable selected resume/letter versions recorded |
| A17 | Upload new PDFs after prior submission | Submitted remains locked; old document refs unchanged |
| A18 | Admin assignment and role changes | Audit events available to admin |
| A19 | Two staff concurrently import same run | Exactly one run processed and counts not doubled |
| A20 | Cross-origin use and Auth redirect | Login/email confirmation navigates only to allowed portal URL |
| A21 | Malicious HTML in job title or fit reason | Displayed as text, never executed |
| A22 | Oversized or malformed PDF, malicious ZIP traversal / zip bomb | Rejected without exposing paths or corrupting data |
| A23 | Customer updates minimum fit threshold | Server refuses decisions for below-threshold jobs |
| A24 | User attempts unauthenticated RPCs or storage reads | Permission denied |

Additional acceptance before real launch: formal privacy/security review, malware scanning, contractor confidentiality, incident response and retention/deletion process; Ontario recruiting classification, licensing and fee charging legal review; capacity/cost validation and honest marketing claims.
