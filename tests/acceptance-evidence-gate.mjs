#!/usr/bin/env node
// MatchPath acceptance evidence gate. No network access, secrets, or real customer data.
// Usage: node tests/acceptance-evidence-gate.mjs <path-to-synthetic-evidence.json>
// Exit 0 ONLY when all 12 application-level observations have been recorded.
import { readFileSync } from 'node:fs';
const ids = Array.from({length:12},(_,i)=>'MP-E2E-'+String(i+1).padStart(2,'0'));
const errors=[];
const file=process.argv[2];
if(!file){console.error('NOT ACCEPTED: evidence JSON path required');process.exit(2)}
let data;
try { data=JSON.parse(readFileSync(file,'utf8')); }
catch(e){console.error('NOT ACCEPTED: cannot parse evidence: '+e.message);process.exit(2)}
if(!data || !Array.isArray(data.scenarios)) errors.push('scenarios array missing');
const rows=Array.isArray(data?.scenarios)?data.scenarios:[];
const seen=new Set();
for(const row of rows){
 if(!row || !ids.includes(row.id)){errors.push('unexpected or missing scenario ID');continue}
 if(seen.has(row.id))errors.push('duplicate '+row.id);
 seen.add(row.id);
 if(row.status!=='PASS')errors.push(row.id+' not PASS');
 for(const field of ['tested_at','deployment_sha','actor_alias','request_status','evidence_ref','database_event_ref']){
  if(typeof row[field]!=='string'||!row[field].trim())errors.push(row.id+' missing '+field);
 }
 if(row.deployment_sha && !/^[a-f0-9]{7,40}$/.test(row.deployment_sha))errors.push(row.id+' invalid deployment SHA');
 if(row.evidence_ref && !/^(synthetic:|redacted:)/.test(row.evidence_ref))errors.push(row.id+' evidence must be labelled synthetic/redacted');
}
for(const id of ids)if(!seen.has(id))errors.push('missing '+id);
if(rows.length!==12)errors.push('expected exactly 12 scenarios');
if(data?.environment!=='isolated-synthetic')errors.push('environment must be isolated-synthetic');
if(data?.cross_tenant_exposure!==false)errors.push('cross_tenant_exposure must be explicitly false');
if(data?.unauthorized_action_succeeded!==false)errors.push('unauthorized_action_succeeded must be explicitly false');
if(errors.length){console.error('NOT ACCEPTED ('+errors.length+' failures):\n'+errors.join('\n'));process.exit(1)}
console.log('EVIDENCE GATE PASS: 12/12 recorded synthetic observations; manual evidence verification still required.');
