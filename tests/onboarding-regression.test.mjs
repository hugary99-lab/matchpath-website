import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../beta/app.js', import.meta.url));
const source = readFileSync(app, 'utf8');

test('beta portal parses as JavaScript before deployment', () => {
  const result = spawnSync(process.execPath, ['--check', app], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || 'node --check failed');
});

test('reference resume handling contains real statement separators', () => {
  assert.doesNotMatch(source, /\}\\n\s*if\s*\(/);
  assert.doesNotMatch(source, /;\\n\s*(?:if\s*\(|uploaded\+\+)/);
  assert.match(source, /reference-download/);
  assert.match(source, /from\('reference_resumes'\)\.insert/);
});

test('customer onboarding fields are persisted and resume library loaded', () => {
  for (const name of ['linkedin_url', 'salary_target', 'salary_currency',
    'service_tier', 'transferable_roles', 'employment_types',
    'industries', 'relocation_preferences', 'pension_preferences']) {
    assert.match(source, new RegExp(name + ':'));
  }
  assert.match(source, /'reference_resumes'/);
  assert.match(source, /referenceResumes/);
});
