import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const checklist = readFileSync(new URL('../docs/ACCEPTANCE_TESTS.md', import.meta.url), 'utf8');
const ids = [...checklist.matchAll(/^\| (A\d{2}) \|/gm)].map(m => m[1]);
const required = Array.from({ length: 24 }, (_, i) => 'A' + String(i + 1).padStart(2, '0'));

function auditLedger(records) {
  const errors = [];
  const seen = new Set();
  for (const record of records) {
    if (!required.includes(record.id)) errors.push('unknown scenario ' + record.id);
    if (seen.has(record.id)) errors.push('duplicate scenario ' + record.id);
    seen.add(record.id);
    for (const field of ['environment', 'commit', 'tester', 'reviewer', 'executedAt', 'expected', 'observed', 'evidenceRef', 'status']) {
      if (typeof record[field] !== 'string' || !record[field].trim()) errors.push(record.id + ': missing ' + field);
    }
    if (record.status !== 'PASS') errors.push(record.id + ': not passing');
    if (record.reviewer && record.tester && record.reviewer === record.tester) errors.push(record.id + ': not independently reviewed');
  }
  for (const id of required) if (!seen.has(id)) errors.push('missing scenario ' + id);
  return errors;
}
const fixture = required.map(id => ({ id, environment: 'synthetic-test', commit: 'fixture-only', tester: 'tester', reviewer: 'reviewer', executedAt: '2026-11-23T00:00:00Z', expected: 'deny/allow per checklist', observed: 'fictional result', evidenceRef: 'synthetic-' + id, status: 'PASS' }));

test('source checklist enumerates exactly A01-A24 once each', () => assert.deepEqual(ids, required));
test('24 individually reviewed synthetic records satisfy structural coverage only', () => assert.deepEqual(auditLedger(fixture), []));
test('12 records cannot satisfy 24-scenario coverage', () => assert.ok(auditLedger(fixture.slice(0, 12)).some(e => e.includes('missing scenario A13'))));
test('duplicate scenario cannot replace missing coverage', () => assert.ok(auditLedger([...fixture.slice(0, 23), fixture[0]]).some(e => e.includes('duplicate scenario A01'))));
test('failed scenario blocks coverage', () => assert.ok(auditLedger(fixture.map((r,i) => i === 0 ? {...r,status:'FAIL'} : r)).length));
test('self-reviewed evidence blocks coverage', () => assert.ok(auditLedger(fixture.map((r,i) => i === 0 ? {...r,reviewer:'tester'} : r)).length));
test('missing evidence reference blocks coverage', () => assert.ok(auditLedger(fixture.map((r,i) => i === 0 ? {...r,evidenceRef:''} : r)).length));

// IMPORTANT: These tests validate ledger shape using fabricated fixtures.
// They do not authenticate evidence, access a deployment, or certify release.
