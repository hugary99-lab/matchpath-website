import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Executes the actual production function body with synthetic role/consent inputs.
// This is a source-level behavioral test, NOT an authenticated browser/RLS test.
const source=readFileSync(new URL('../beta/app.js',import.meta.url),'utf8');
const match=source.match(/^function canRecordSubmission\(\)\{[^\n]+\}/m);
assert.ok(match,'Production submission authorization function was not found');

function check({role,tier,authorization,managed=false}){
 const context={
   state:{account:{role}},
   currentProfile:()=>({service_tier:tier}),
   currentDocumentAuthorization:()=>authorization?{allow_managed_submission:managed}:null
 };
 return vm.runInNewContext(match[0]+';canRecordSubmission()',context);
}
const scenarios=[
 ['DIY customer with consent', 'customer','diy',true,false,true],
 ['DIY customer without consent','customer','diy',false,false,false],
 ['full-service customer cannot record managed submission','customer','full_service',true,true,false],
 ['staff with managed consent','staff','full_service',true,true,true],
 ['staff without managed consent','staff','full_service',true,false,false],
 ['staff without authorization','staff','full_service',false,true,false],
 ['admin with managed consent','admin','full_service',true,true,true],
 ['admin without managed consent','admin','full_service',true,false,false],
 ['staff cannot record DIY customer submission','staff','diy',true,true,false],
 ['unknown role is denied','viewer','full_service',true,true,false]
];
for(const [name,role,tier,authorization,managed,expected] of scenarios){
 test(name,()=>assert.equal(check({role,tier,authorization,managed}),expected));
}
