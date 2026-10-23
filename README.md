# MatchPath — Website and Operational Beta

**Status:** Production implementation in progress. The public root `index.html` is an interactive *demo* with fictional data. The separate `/beta/` application is connected to a dedicated MatchPath Supabase project. On 2026-10-23, three JavaScript syntax defects that prevented startup were corrected in source and a regression test was added. **A live deployment, synthetic login/upload flow, cross-customer RLS checks and privacy review have NOT yet passed. Do not use real customers.**

## Repository structure

| Path | Purpose |
| --- | --- |
| `index.html` | Existing public marketing / interactive demonstration (no real backend) |
| `beta/index.html` | Authenticated customer, staff and admin portal |
| `beta/app.js` | Portal logic: login, profiles, approval, CSV import, documents, submissions, admin |
| `beta/styles.css` | Responsive portal styles |
| `beta/config.js` | Configured public Supabase URL and **publishable** key only; never secret keys |
| `supabase/migrations/20261010_matchpath_mvp.sql` | RLS-protected Postgres, RPCs and private file-storage policies |
| `job_search_template.csv` | Actual 17-column v1.0 search export format |
| `manifest_template.csv` | Actual 5-column v1.0 document manifest format |
| `docs/SETUP.md` | Technical setup and deployment instructions |
| `docs/OPERATIONS.md` | Staff and customer workflow, export specs and manual pilot SOP |
| `docs/ACCEPTANCE_TESTS.md` | QA checklist and release gate |
| `tests/...` | Automated static/regression checks |

## Local checks

Requires Node 20+ for checks only. Browser site itself is static and requires no build.

```sh
npm run check
npm test
```

## GitHub Pages

Open **Settings → Pages**, choose **Deploy from a branch**, `main`, `/(root)`, and Save if not already enabled. The expected URL, which must be independently verified after publishing, is `https://hugary99-lab.github.io/matchpath-website/`. After the beta files reach main, the secure portal path will be `/beta/`; it shows a backend-configuration screen until Supabase is connected.

## Live-service prerequisites

1. Choose a **new, dedicated** MatchPath Supabase project in the correct organization and region. Do NOT reuse Waytold, pickleball or seniors' databases.
2. Apply migration SQL, then configure URL + public publishable key in `beta/config.js`.
3. Set Auth site URL/redirects, verify email-confirmation flow, sign up founder, and bootstrap founder role as admin in SQL editor.
4. Create staff accounts, promote to staff, and assign customers.
5. Test authorization with multiple real **test** accounts, including cross-customer access and document permission denial.
6. Run CSV and ZIP pilot tests and check submitted-document version immutability.
7. Resolve Ontario recruiter licence/fee restrictions and privacy/commercial terms **before taking customer payments or running a paid service**.

## Limitations

This code does **not** create AI searches inside ChatGPT, submit third-party job applications automatically, verify job postings independently, bill customers, or guarantee outcomes. Staff run ChatGPT searches and submit employer applications manually. The backend records decisions, documents and confirmed outcomes.

Application data is not stored in GitHub. The repository and public website contain **no** real customer data or secrets. Only publicly intended Supabase project URL/publishable key may appear in the static configuration; never include a service-role/secret key.

For full instructions see [docs/SETUP.md](docs/SETUP.md).
