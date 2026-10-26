import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261026_standing_ai_document_authorization.sql');
const app=read('beta/app.js');
test('Standing authorization is customer-granted, versioned, revocable and auditable',()=>{
 for(const identifier of ['document_authorizations','document_authorization_events','customer_set_document_authorization','accepted_at','disclosure_version','revoked_at','granted_by','allow_managed_submission'])assert.ok(sql.includes(identifier),identifier);
 assert.match(sql,/v_user is null or not exists\(select 1 from public\.accounts where id=v_user and role='customer'\)/);
 assert.match(sql,/if p_accept and p_allow_staff_submit and v_tier<>'full_service'/);
 assert.match(sql,/on public\.document_authorizations for select to authenticated/);
 assert.match(sql,/on public\.document_authorization_events for select to authenticated/);
 assert.match(sql,/revoke all on public\.document_authorizations,public\.document_authorization_events from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.customer_set_document_authorization\(boolean,boolean\) to authenticated/);
});
test('No individual resume approval; submission must have consent and job approval',()=>{
 assert.match(sql,/Customer standing document authorization is required/);
 assert.match(sql,/Customer has not authorized managed application submission/);
 assert.match(sql,/Customer must approve this specific job before staff submission/);
 assert.match(sql,/before insert on public\.document_versions/);
 assert.match(sql,/before update of status on public\.applications/);
 assert.match(sql,/v_actor_role='customer'/);
 assert.match(app,/documentConsentForm/);
 assert.match(app,/consentManaged/);
 assert.match(app,/revoke-document-consent/);
 assert.match(app,/No per-resume sign-off|without individual resume approval/);
 assert.match(app,/currentDocumentAuthorization\(\)/);
 assert.match(app,/canRecordSubmission\(\)/);
});
test('Customers cannot self-promote package or alter protected profile columns',()=>{
 assert.match(sql,/revoke update on public\.customer_profiles from public,anon,authenticated/);
 const grants=sql.match(/grant update \(([\s\S]*?)\) on public\.customer_profiles to authenticated;/);
 assert.ok(grants);
 assert.doesNotMatch(grants[1],/service_tier|ai_search_prompt|ai_prompt_updated_at/);
 assert.match(app,/if\(state\.account\?\.role==='customer'\)delete values\.service_tier/);
});
test('Consent disclosure displayed is the version stored on the server',()=>{
 const terms=sql.match(/v_terms constant text:='([^']+)'/);
 const managed=sql.match(/v_managed_terms constant text:='([^']+)'/);
 assert.ok(terms&&managed);
 assert.ok(app.includes(JSON.stringify(terms[1])));
 assert.ok(app.includes(JSON.stringify(managed[1])));
});
