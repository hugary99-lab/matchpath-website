import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../beta/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../beta/styles.css',import.meta.url),'utf8');
const section=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)+from.length));
test('Review, Approved and All results use a single job status selector',()=>{
 assert.match(source,/function jobStatusSelect\(/);
 for(const anchor of ['function newReviewTriagePage()','function approvedResultsPage()','function jobResultsPanel(']){
  const part=section(anchor,'return html;');
  assert.match(part,/jobStatusSelect\(/,anchor);
 }
 assert.doesNotMatch(source,/type="radio" name="review-/);
 assert.match(source,/data-result-status/);
 assert.match(source,/data-approved-status/);
 assert.match(source,/data-review-choice/);
});
test('Job status edits save in batches with explicit dirty states',()=>{
 assert.match(source,/save-review-decisions/);
 assert.match(source,/save-result-statuses/);
 assert.match(source,/approved-save-status/);
 assert.match(source,/state\.resultStatusDrafts/);
 assert.match(source,/updateResultSaveState\(\)/);
 assert.match(source,/Object\.entries\(state\.approvedStatusDrafts\)/);
 assert.match(source,/Object\.entries\(state\.resultStatusDrafts\)/);
 assert.match(source,/const COPY=Object\.freeze\(\{/);
 assert.match(source,/save:'Save changes'/);
 assert.doesNotMatch(source,/data-action="save-job-status"/);
 assert.match(source,/beforeunload/);
 assert.match(source,/confirmDiscardChanges\(\)/);
});
test('Submission confirmation is not disguised as opening a job link',()=>{
 assert.doesNotMatch(source,/Open posting \/ Apply/);
 assert.doesNotMatch(source,/>Save role</);
 assert.match(source,/recordSubmission:'Record submission'/);
 assert.match(source,/confirmSubmission:'Confirm submission'/);
 assert.match(source,/employer application was genuinely submitted|genuinely submitted to the employer/);
});
test('Consistent document, salary, concern and evidence styles exist',()=>{
 for(const cls of ['concern-note','document-needs-attention','salary-unlisted','extra-evidence'])assert.ok(css.includes('.'+cls),cls);
 assert.match(source,/Show '\+\(items\.length-8\)\+' more/);
 assert.match(source,/Fit = match strength\. Qualification = whether key requirements are confirmed\./);
});
test('Customer privacy and consent disclosures remain intact',()=>{
 assert.match(source,/This action sends search criteria only; it does not send the customer/);
 assert.match(source,/recipient sets their own password; no password is shared with administrators/);
 assert.match(source,/documentConsentPanel\(\)/);
 assert.match(source,/revoke-document-consent/);
});
