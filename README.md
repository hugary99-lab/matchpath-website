# MatchPath — Interactive MVP Website Prototype

This repository contains the **public, static demonstration** of MatchPath, an AI-assisted, human-supervised career-search service. It is intended for product review and workflow testing only.

## What's included

- Public homepage, How It Works, and pilot pricing
- Customer dashboard with example job matches and Approve/Reject controls
- Staff dashboard with customer selection, **CSV validation/import**, approved-job queue, **ZIP manifest preview**, and a simulated submission-status workflow
- Admin dashboard with demo customer and staff assignment controls
- `job_search_template.csv` and `manifest_template.csv` to test the specified formats

## Preview on GitHub Pages

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Choose branch **main**, folder **/(root)**, then **Save**.
4. After publishing completes, visit the Pages URL shown there. For this repository, GitHub Pages usually uses `https://hugary99-lab.github.io/matchpath-website/`; treat that address as **unverified until GitHub shows it as published**.

There is no npm build step. GitHub Pages serves the repository-root `index.html` directly.

## Demo only — not production

- No authentication, role access restrictions, customer account registration, Supabase connection, encrypted cloud document storage, or payment processing.
- Account switching and all approval/status changes are **browser-local simulations**, stored via localStorage.
- Importing a CSV does not verify actual jobs or upload to a database.
- ZIP manifest preview requires JSZip from CDN and does **not** persist actual PDF bytes.
- Jobs/employers and example records are fictional.
- **Do not upload real personal resumes or customer information into the public demo.**
- The site does not submit applications to external employers.
- Before a paid launch, obtain relevant Ontario recruiter licensing/fee and privacy legal review.

## Data format standard

Use the physical CSV template files as the v1.0 format:
- Search results: 17 columns beginning with `schema_version,customer_id,search_run_id`
- Document manifest: 5 columns beginning with `schema_version,customer_id,application_id`

Some earlier planning documents omitted the first two manifest columns or the first search column; those documents must be reconciled with these templates.

## Next implementation milestones

1. Supabase schema, private Storage, authentication, row-level security (RLS), and staff/customer assignments.
2. Authenticated staff CSV and ZIP file import endpoints with strict customer and document ID mapping.
3. Customer approval persistence, PDF version history, application submission proof, and audited status history.
4. Security, privacy, licensing, and pilot QA before any real customer data is processed.

© MatchPath — development prototype.