import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const analysis = read('supabase/functions/analyze-profile/index.ts');
const generation = read('supabase/functions/generate-general-resumes/index.ts');
const portal = read('beta/app.js');

test('candidate-stated experience is retained even when role-level examples are sparse', () => {
  assert.match(analysis, /candidate_stated_experience/);
  assert.match(analysis, /Do not call an explicit resume claim unsupported/);
});
test('missing resume details generate strengthening recommendations, not deleted skills', () => {
  assert.match(analysis, /resume_strengthening_recommendations/);
  assert.match(analysis, /recommended_addition/);
  assert.match(analysis, /unresolved_evidence_questions/);
});
test('changed source resumes invalidate candidate evidence before strategy building', () => {
  assert.match(analysis, /if \(!evidenceCurrent\) return respond/);
  assert.match(analysis, /Original\/reference resumes changed/);
});
test('new strategies start as drafts and require explicit activation', () => {
  assert.match(analysis, /status: "draft"/);
  assert.match(analysis, /activate_strategy/);
  assert.match(portal, /data-action="activate-search-strategy"/);
});
test('general resume generation requires an active strategy built from latest evidence', () => {
  assert.match(generation, /\.eq\("status", "current"\)/);
  assert.match(generation, /String\(strategy\.source_evidence_id\) !== String\(evidence\.id\)/);
});
test('general resumes retain evidence and strategy provenance', () => {
  assert.match(generation, /source_evidence_id: evidence\.id/);
  assert.match(generation, /source_strategy_id: strategy\.id/);
});
test('UI disables general resume generation when evidence or strategy is stale', () => {
  assert.match(portal, /const canGenerateGeneralResumes=!!live&&liveCurrent&&!!evidence&&evidenceCurrent/);
  assert.match(portal, /data-action="generate-general-resumes"/);
});
test('source-based tests do not claim browser or real-account authorization acceptance', () => {
  assert.match(portal, /async function uploadReferenceResumes\(/);
  assert.match(portal, /async function generateGeneralResumeLibrary\(/);
});
