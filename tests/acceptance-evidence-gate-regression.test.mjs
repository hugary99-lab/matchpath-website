#!/usr/bin/env node
// Fail-closed regression tests for the evidence *format* gate, not E2E acceptance.
// No real accounts, uploads, network, or employer submissions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const gate = new URL('./acceptance-evidence-gate.mjs', import.meta.url);
const baseline = () => ({
  environment: 'isolated-synthetic',
  cross_tenant_exposure: false,
  unauthorized_action_succeeded: false,
  scenarios: Array.from({length:12}, (_,i) => ({
    id: 'MP-E2E-'+String(i+1).padStart(2,'0'),
    status: 'PASS',
    tested_at: '2026-11-13T12:00:00Z',
    deployment_sha: 'abcdef1234567',
    actor_alias: 'fictional-actor',
    request_status: '200',
    evidence_ref: 'synthetic:placeholder-not-real-evidence',
    database_event_ref: 'synthetic:placeholder-not-real-event'
  }))
});
function run(data) {
  const dir = mkdtempSync(join(tmpdir(), 'matchpath-gate-'));
  try {
    const file = join(dir, 'evidence.json');
    writeFileSync(file, JSON.stringify(data));
    return spawnSync(process.execPath, [gate.pathname, file], {encoding:'utf8'});
  } finally { rmSync(dir, {recursive:true, force:true}); }
}
test('complete syntactically valid fictional record passes format gate ONLY', () => {
  const result = run(baseline());
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/manual evidence verification still required/);
});
test('missing scenario fails closed', () => {
  const d=baseline(); d.scenarios.pop();
  assert.notEqual(run(d).status,0);
});
test('duplicate scenario fails closed', () => {
  const d=baseline(); d.scenarios[11].id=d.scenarios[10].id;
  assert.notEqual(run(d).status,0);
});
test('unauthorized success fails closed', () => {
  const d=baseline(); d.unauthorized_action_succeeded=true;
  assert.notEqual(run(d).status,0);
});
test('cross-tenant exposure fails closed', () => {
  const d=baseline(); d.cross_tenant_exposure=true;
  assert.notEqual(run(d).status,0);
});
test('missing evidence reference fails closed', () => {
  const d=baseline(); d.scenarios[0].evidence_ref='';
  assert.notEqual(run(d).status,0);
});
test('non-synthetic environment fails closed', () => {
  const d=baseline(); d.environment='production';
  assert.notEqual(run(d).status,0);
});
test('non-PASS scenario fails closed', () => {
  const d=baseline(); d.scenarios[0].status='FAIL';
  assert.notEqual(run(d).status,0);
});
