# Multiple resumes per customer — implementation design

Status: design committed; not yet implemented or deployed.

- One customer owns multiple resume records; every resume belongs to exactly one customer.
- Each resume has label, career track, original private storage path, upload timestamp, archived flag, and optional default flag. Never overwrite original uploaded bytes; each replacement creates a new version.
- Each approved search strategy references a resume ID and version; strategies can share account-wide geographic, compensation, employment and pension preferences.
- Customer dashboard merges jobs across strategies and deduplicates by canonical employer posting key. Preserve source strategy attribution.
- On approval, generate a job-specific resume and cover letter. Preserve immutable document versions actually used for applications.
- Customer may archive a resume; old strategy runs and submitted applications retain referential history. Archiving must not silently redirect an approved strategy.
- Staff access only assigned customers; enforce row-level security and private storage policies on resume library and version records.
- No resume sent to external AI provider without explicit customer consent; keep customer data out of public repository.
- Migration path: retain existing customer_profiles.baseline_resume_path temporarily; backfill as default resume only after validation, with no loss of access or history.
- UI: upload multiple PDF/DOCX resumes, label them, choose default, select relevant career tracks, archive, view version history.
- Acceptance: cross-customer access denial, safe upload type/size validation, strategy resume version pinning, duplicate job suppression, archived resume behavior, download permissions, and document audit trail.
