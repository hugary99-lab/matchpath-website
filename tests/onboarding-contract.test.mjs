import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const appPath = new URL('../beta/app.js', import.meta.url);
const source = readFileSync(appPath, 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'Missing expected source section: ' + start);
  return source.slice(a, b);
}
const form = between('function profileFormValues(){', 'async function showAiPromptPreview(');
const changes = between('function profileValuesChanged(', 'function isDiyCustomer(');
const save = between("if(type==='profileForm'){", "if(type==='bulkSubmitForm'){");
const upload = between('async function uploadReferenceResumes(', 'async function signedPdf(');
const fields = [
  'linkedin_url','target_roles','transferable_roles','preferred_locations',
  'relocation_preferences','salary_min','salary_target','salary_currency',
  'service_tier','work_preference','industries','employment_types',
  'pension_preferences','exclusions','search_instructions','min_fit_score'
];

test('portal JavaScript parses as a module', () => {
  const result = spawnSync(process.execPath, ['--check', appPath.pathname], { encoding:'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('all 16 onboarding fields are serialized and compared for changes', () => {
  for (const field of fields) {
    assert.ok(form.includes(field + ':'), 'Missing save payload: ' + field);
    assert.ok(changes.includes("'" + field + "'"), 'Missing change tracking: ' + field);
  }
});

test('hard exclusions and flexible search preferences remain separate', () => {
  assert.match(form, /exclusions:\s*\$\('#exclusions'\)/);
  assert.match(form, /search_instructions:\s*\$\('#search_instructions'\)/);
});

test('saving onboarding does not automatically run AI or submit applications', () => {
  assert.match(save, /profileFormValues\(\)/);
  assert.doesNotMatch(save, /run-job-search|staff_set_application_status|apply-ai-prompt|openai\.com/);
});

test('reference resumes are limited to five and use immutable private PDF/Word paths', () => {
  assert.match(upload, /existingCount\+list\.length>5/);
  assert.match(upload, /await validateResumeFile\(file\)/);
  assert.match(upload, /crypto\.randomUUID\(\)\+'\.'\+validated\.extension/);
  assert.match(upload, /storage\.from\('matchpath-profiles'\)\.upload\(/);
  assert.match(upload, /upsert:false/);
});

test('metadata registration follows storage upload, with best-effort cleanup on error', () => {
  const stored = upload.indexOf("storage.from('matchpath-profiles').upload(");
  const registered = upload.indexOf("rpc('register_reference_resume'");
  assert.ok(stored >= 0 && registered > stored, 'Resume metadata must follow object upload');
  for (const arg of ['p_customer:customer','p_storage_path:path','p_original_filename:file.name','p_size_bytes:file.size']) {
    assert.ok(upload.includes(arg), 'Missing registration argument: ' + arg);
  }
  assert.match(upload, /if\(metadataError\)/);
  assert.match(upload, /storage\.from\('matchpath-profiles'\)\.remove\(\[path\]\)/);
});

test('admin upload control is role-gated and limited to selected customer', () => {
  assert.ok(source.includes('data-action="choose-reference-resumes"'));
  assert.ok(source.includes("if(state.account?.role!=='admin')throw Error('Administrator access required to upload customer resumes.')"));
  assert.ok(source.includes("if(e.target.id==='reviewReferenceFiles')"));
  assert.ok(source.includes('uploadReferenceResumes(customer,files)'));
});

test('reference downloads are scoped to current customer and signed private storage', () => {
  assert.ok(source.includes('x.customer_id===currentCustomer()'));
  assert.ok(source.includes("signedPdf(item.storage_path,'matchpath-profiles')"));
});

test('AI search prompt refresh requires a stale profile and explicit approval', () => {
  assert.ok(source.includes('if(!aiPromptNeedsUpdate(profile))'));
  assert.ok(source.includes("data-action=\"apply-ai-prompt\""));
  assert.ok(source.includes("rpc('save_ai_search_prompt'"));
});
