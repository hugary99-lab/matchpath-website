# MatchPath — Cross-page UI language and interaction audit
Updated: 2026-10-26. Scope: the shared beta portal source, not a signed-in screenshot acceptance test.

## Canonical language
| Operation | Use | Avoid |
| --- | --- | --- |
| Non-destructive edit persistence | Save changes | Save Status, Save Search Focus, Save role, per-row Save |
| Status selection | Status (shared dropdown) | Radio columns on one page, dropdown on another |
| Employer website | Open posting ↗ | Posting, Original posting, Open posting / Apply |
| App files | View documents; Add documents if missing | Manage files / Documents without context |
| Download | Download resume; Download cover letter | Icon-only download arrow |
| After actual employer submission | Record submission; Confirm submission | Apply, Mark Submitted |
| Account authorization | Change role (separate confirmation) | Routine Save changes |
| Prompt display | View AI search prompt | View Full AI Search Prompt / View AI Prompt |
| AI action | Run AI job search | Run AI Job Search |

## Visual conventions
- Routine controls use short verb + object labels and one primary action per panel.
- External links are labeled Open posting ↗ across screens. They open employer sites; they do not submit applications.
- Icons without visible text are limited to utility editing/voice tools, with accessible labels.
- Status selection uses the shared jobStatusSelect renderer on To be reviewed, Approved and All results.
- Status editing in these job tables uses batch Save changes and a visible unsaved count.
- Changing accounts or recording a genuine employer submission is a separate action and confirmation.
- Unknown salaries are de-emphasized. Material concerns are highlighted consistently.
- Empty states explain what happened and direct the user to the next page.
- Profile Analysis limits visible evidence pills and collapses older notes.

## Copy reduction
- Keep screen introductions to one short task-oriented sentence where possible.
- Preserve exact legal consent and privacy assurances even when they are longer.
- Distinguish fit score (match strength) from qualification (verified readiness).
- Do not imply AI resume optimization guarantees ATS screening success or interviews.

## Deferred from this copy/consistency round
- Full customer/staff navigation redesign under the separately approved shared-stream brief.
- Job-specific AI document-generation engine and application tracking beyond Submitted.
- Automated employer submission.
- Full mobile-card redesign and complete accessibility audit.
- Live Customer A / Customer B / assigned-staff end-to-end acceptance and visual screenshot QA.

## Verification required
- GitHub syntax and regression tests.
- Role-specific signed-in UI review, keyboard navigation, status draft persistence, unsaved-change warnings, empty states and external links.
- Netlify deployment status independently checked before claiming the production portal is updated.
