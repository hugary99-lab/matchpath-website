// Run: node scripts/intake-release-gate.mjs [optional-live-columns.json]
// Read-only release gate. Optional JSON is an array of column names from
// information_schema.columns; never include customer records or credentials.
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../beta/app.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261016_customer_intake_strategy.sql',import.meta.url),'utf8');
const fields=['service_tier','salary_currency','transferable_roles','employment_types','industries','relocation_preferences','pension_preferences'];
const failures=[];
for(const field of fields){
 if(!source.includes("$('#"+field+"').value"))failures.push('Intake form does not save '+field);
 if(!migration.includes(' '+field+' '))failures.push('Migration does not define '+field);
}
if(/using\(customer_id=auth\.uid\(\) and status in \('draft','approved'\)\)/.test(migration))
 failures.push('Approved search strategies are writable through owner update policy: approval history must be immutable');
if(process.argv[2]){
 const live=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 if(!Array.isArray(live))throw Error('Expected JSON array of live column names');
 for(const field of fields)if(!live.includes(field))failures.push('Live database missing '+field);
}
console.log(JSON.stringify({checked_at:new Date().toISOString(),fields_checked:fields.length,failures,pass:failures.length===0},null,2));
if(failures.length)process.exitCode=1;
