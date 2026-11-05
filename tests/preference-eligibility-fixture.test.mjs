import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const csv = readFileSync(new URL('./fixtures/preference-fit-cases-2026-11-04.csv', import.meta.url), 'utf8').trim().split(/\r?\n/);
const [header,...lines]=csv;
const columns=header.split(',');
const rows=lines.map(line=>Object.fromEntries(line.split(',').map((value,i)=>[columns[i],value])));
function eligible(row) {
  const location = !row.location_mandatory || row.location_job === row.location_mandatory;
  const salary = !row.minimum_salary_mandatory || (row.job_salary !== '' && Number(row.job_salary) >= Number(row.minimum_salary_mandatory));
  const remote = row.remote_mandatory !== 'true' || row.job_remote === 'true';
  return location && salary && remote;
}
test('fixture has six unique, labelled synthetic eligibility scenarios',()=>{
  assert.equal(rows.length,6);
  assert.equal(new Set(rows.map(r=>r.case_id)).size,6);
  assert.ok(rows.every(r=>r.reason && ['true','false'].includes(r.expected_eligible)));
});
for(const row of rows) test(row.case_id+' '+row.reason,()=>assert.equal(eligible(row),row.expected_eligible==='true'));
test('flexible skill is not a mandatory eligibility gate',()=>{
  const base=rows.find(r=>r.case_id==='MP01');
  assert.equal(eligible({...base,job_has_skill:'false'}),eligible(base));
});
// Fixture semantics only. This does not invoke the actual search/scoring implementation.
