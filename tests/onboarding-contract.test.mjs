import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const path = new URL('../beta/app.js', import.meta.url);
const source = readFileSync(path, 'utf8');
const profileSave = source.slice(
  source.indexOf("if(type==='profileForm')"),
  source.indexOf("if(type==='singleDocumentForm')")
);
const requiredFields = [
  'linkedin_url', 'target_roles', 'transferable_roles', 'preferred_locations',
  'relocation_preferences', 'salary_min', 'salary_target', 'salary_currency',
  'service_tier', 'work_preference', 'industries', 'employment_types',
  'pension_preferences', 'exclusions', 'search_instructions', 'min_fit_score'
];

test('portal JavaScript passes Node module syntax check', () => {
  const result = spawnSync(process.execPath, ['--check', path.pathname], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('every onboarding field is rendered and included in the save payload', () => {
  assert.ok(profileSave.length > 1000, 'Could not locate onboarding handler');
  for (const field of requiredFields) {
    assert.ok(
      source.includes("field('" + field + "'") ||
      source.includes("area('" + field + "'") ||
      source.includes('id="' + field + '"'),
      field + ' is not rendered'
    );
    assert.ok(profileSave.includes(field + ':'), field + ' is not saved');
  }
});

test('resume uploads use non-overwriting unique private paths', () => {
  assert.match(profileSave, /reference-resumes\/['"]\+crypto\.randomUUID\(\)\+['"]\.pdf/);
  assert.match(profileSave, /storage\.from\('matchpath-profiles'\)\.upload\(/);
  assert.match(profileSave, /upsert:false/);
  assert.match(profileSave, /await validatePdf\(file\)/);
});

test('every uploaded resume is registered with owner, path and original filename', () => {
  assert.match(profileSave, /from\('reference_resumes'\)\.insert\(/);
  for (const key of ['customer_id:state.me.id', 'storage_path:path', 'original_filename:file.name', 'size_bytes:file.size']) {
    assert.ok(profileSave.includes(key), 'Missing metadata: ' + key);
  }
  assert.match(profileSave, /if\(metadataError\)throw/);
});

test('reference download is owner-scoped and uses private signed URL', () => {
  assert.ok(source.includes("x.customer_id===state.me.id"), 'Owner guard missing');
  assert.ok(source.includes("signedPdf(item.storage_path,'matchpath-profiles')"), 'Private signed download missing');
});

test('profile save does not imply AI processing or employer submission', () => {
  assert.match(profileSave, /AI career profiling has not started/);
  assert.doesNotMatch(profileSave, /customer_decide_job|staff_set_application_status|openai\.com/);
});
