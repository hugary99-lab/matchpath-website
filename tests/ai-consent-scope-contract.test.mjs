import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../beta/app.js', import.meta.url), 'utf8');
const search = readFileSync(new URL('../supabase/functions/run-job-search/index.ts', import.meta.url), 'utf8');

test('customer authorization clearly covers all AI-processing purposes', () => {
  const panel = ui.slice(ui.indexOf('function documentConsentPanel(){'), ui.indexOf('function latestCandidateEvidence('));
  assert.ok(panel.length > 1000, 'authorization panel must exist');
  for (const purpose of ['profile analysis', 'search-strategy drafting', 'job discovery', 'resumes and cover letters']) {
    assert.ok(panel.includes(purpose), 'missing disclosure: ' + purpose);
  }
  assert.match(panel, /shared with AI service providers/);
});

test('authorization explains revocation and does not imply automatic applications', () => {
  const panel = ui.slice(ui.indexOf('function documentConsentPanel(){'), ui.indexOf('function latestCandidateEvidence('));
  assert.match(panel, /Withdrawing authorization stops future AI processing/);
  assert.match(panel, /does not undo processing already completed/);
  assert.match(panel, /No employer application is submitted automatically/);
  assert.match(panel, /id="consentManaged"/);
  assert.match(panel, /I separately authorize MatchPath staff to submit documents/);
});

test('search endpoint requires standing consent for AI but allows local preview', () => {
  assert.match(search, /if \(input\.preview_only !== true\) \{/);
  assert.match(search, /from\("document_authorizations"\)/);
  assert.match(search, /!aiConsent\?\.accepted_at \|\| aiConsent\.revoked_at/);
  assert.match(search, /Customer AI processing authorization is required/);
});
