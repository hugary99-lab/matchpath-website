import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const jobs=['schema_version','searched_at','job_title','company','location','work_arrangement','salary_min','salary_max','currency','job_url','source','fit_score','qualification_status','fit_reason','concerns'];
const docs=['schema_version','customer_id','application_id','resume_file','cover_letter_file'];
test('CSV formats are frozen and correctly documented',()=>{
 assert.deepEqual(read('job_search_template.csv').split(/\r?\n/)[0].split(','),jobs);
 assert.deepEqual(read('manifest_template.csv').split(/\r?\n/)[0].split(','),docs);
});
test('beta portal includes authenticated role-specific workflows',()=>{
 const app=read('beta/app.js'),html=read('beta/index.html'),css=read('beta/styles.css');
 for(const field of ['customer_decide_job','import_search_results','register_document','staff_set_application_status','admin_set_role','admin_assign_staff'])assert.ok(app.includes(field),field);
 for(const field of ['validatePdf','validateZip','validateCsvFile','signedPdf','renderAuth','renderSetup'])assert.ok(app.includes(field),field);
 assert.match(app,/dataset\.change==='assign'/);
 assert.match(html,/type="module" src="\.\/app\.js"/);
 assert.match(css,/\.sidebar/);
});
test('security migration enables RLS and secures document buckets',()=>{
 const sql=read('supabase/migrations/20261010_matchpath_mvp.sql');
 for(const table of ['accounts','customer_profiles','staff_assignments','search_runs','jobs','applications','document_versions','submitted_documents','application_events','audit_events'])assert.ok(sql.includes('alter table public.'+table+' enable row level security'),table);
 for(const guard of ['can_work_customer','can_access_customer','can_access_document_path','auth.uid()','security definer'])assert.ok(sql.includes(guard),guard);
 assert.match(sql,/values\('matchpath-documents','matchpath-documents',false/);
 assert.match(sql,/values\('matchpath-profiles','matchpath-profiles',false/);
});
test('search import identity is owned by MatchPath, not the CSV',()=>{
 const app=read('beta/app.js');
 assert.match(app,/MatchPath Standard v1\.0 \(15 exact columns\)/);
 assert.match(app,/customer_id:customer,search_run_id:state\.csvPreview\.runId/);
 assert.match(app,/const run='MP-'/);
});
test('public config contains only browser-safe Supabase connection values',()=>{
 const c=read('beta/config.js');
 assert.match(c,/supabaseUrl:\s*"https:\/\/[^"]+\.supabase\.co"/);
 assert.match(c,/supabasePublishableKey:\s*"sb_publishable_[^"]+"/);
 assert.doesNotMatch(c,/(service_role|sb_secret_)/);
});
