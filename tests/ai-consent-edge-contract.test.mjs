import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const files = [
  'supabase/functions/analyze-profile/index.ts',
  'supabase/functions/generate-general-resumes/index.ts',
  'supabase/functions/run-job-search/index.ts'
];
for (const path of files) {
  test(path + ' refuses AI calls without unrevoked customer authorization', () => {
    const source = read(path);
    const guard = source.indexOf('admin.from("document_authorizations")');
    const api = source.indexOf('api.openai.com/v1/responses');
    assert.ok(guard > 0 && api > guard, 'Authorization must precede AI API call');
    assert.match(source, /\.select\("accepted_at,revoked_at"\)\.eq\("customer_id", customerId\)\.maybeSingle\(\)/);
    assert.match(source, /if \(consentError\) return respond\(/);
    assert.match(source, /!aiConsent\?\.accepted_at \|\| aiConsent\.revoked_at/);
    assert.match(source, /AI processing authorization is required/);
  });
}
test('non-AI strategy activation is not blocked by consent guard', () => {
  assert.match(read(files[0]), /if \(action !== "activate_strategy"\) \{/);
});
test('local preview can be viewed without triggering AI processing', () => {
  assert.match(read(files[2]), /if \(input\.preview_only !== true\) \{/);
});
