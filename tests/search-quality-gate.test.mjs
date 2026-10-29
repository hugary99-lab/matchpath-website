import test from 'node:test';
import assert from 'node:assert/strict';
import { gateJobResults } from '../supabase/functions/run-job-search/quality-gate.mjs';
const job = (id, overrides = {}) => ({job_title:'Analyst',company:'Example Co',requisition_id:id,job_url:`https://jobs.example.com/${id}`,fit_score:90,qualification_status:'Qualified',...overrides});
test('rejects invalid, non-HTTPS and non-posting URLs without a title',()=>{
 const r=gateJobResults([job('1',{job_url:'http://jobs.example.com/1'}),job('2',{job_title:''}),job('3')],[],80);
 assert.equal(r.jobs.length,1);assert.equal(r.dropped.invalid,2);
});
test('enforces current minimum score even if model returns a low-fit result',()=>{
 const r=gateJobResults([job('1',{fit_score:79}),job('2',{fit_score:80}),job('3',{fit_score:NaN})],[],80);
 assert.deepEqual(r.jobs.map(j=>j.requisition_id),['2']);assert.equal(r.dropped.below_threshold,2);
});
test('suppresses exact employer and requisition even with changed job URL',()=>{
 const r=gateJobResults([job('X',{job_url:'https://new.example.com/x'})],[job('X',{job_url:'https://old.example.com/x'})],80);
 assert.equal(r.jobs.length,0);assert.equal(r.dropped.suppressed_existing,1);
});
test('suppresses matching canonical URLs while preserving non-tracking query IDs',()=>{
 const existing=[job('',{job_url:'https://jobs.example.com/posting?id=42'})];
 const r=gateJobResults([job('1',{job_url:'https://jobs.example.com/posting?id=42&utm_source=mail'}),job('2',{job_url:'https://jobs.example.com/posting?id=43'})],existing,80);
 assert.deepEqual(r.jobs.map(j=>j.requisition_id),['2']);assert.equal(r.dropped.suppressed_existing,1);
});
test('deduplicates within a model response by URL or employer and requisition',()=>{
 const r=gateJobResults([job('A'),job('A',{job_url:'https://jobs.example.com/alternate'}),job('B',{job_url:'https://jobs.example.com/A'}),job('C')],[],80);
 assert.deepEqual(r.jobs.map(j=>j.requisition_id),['A','C']);assert.equal(r.dropped.duplicate,2);
});
test('filters before limiting, so invalid early rows do not crowd out valid rows',()=>{
 const r=gateJobResults([job('A',{fit_score:10}),job('B'),job('C')],[],80,2);
 assert.deepEqual(r.jobs.map(j=>j.requisition_id),['B','C']);
});
test('does not invent independent verification from model output',()=>{
 const j=job('1',{qualification_status:'Needs Verification'});
 const r=gateJobResults([j],[],80);
 assert.equal(r.jobs[0].qualification_status,'Needs Verification');
});
