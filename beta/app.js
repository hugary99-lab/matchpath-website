import config from './config.js';

const SCHEMA = ['searched_at','job_title','company','requisition_id','location','work_arrangement','salary_min','salary_max','currency','job_url','source','fit_score','qualification_status','fit_reason','concerns'];
const MANIFEST = ['schema_version','customer_id','application_id','resume_file','cover_letter_file'];
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'}) : '—';
const money = (v,c='CAD') => v==null||v==='' ? 'Not listed' : new Intl.NumberFormat('en-CA',{style:'currency',currency:c||'CAD',maximumFractionDigits:0}).format(Number(v));
const safeUrl=(u)=>{try { const x = new URL(String(u)); return x.protocol==='https:' ? x.href : ''; } catch{return ''}};
const initials=(s)=>String(s||'?').trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
const statusBadge=(s)=>'<span class="badge '+(s==='submitted'?'':s==='blocked'?'red':s==='in_progress'?'blue':s==='pending'?'warn':'neutral')+'">'+esc(String(s).replaceAll('_',' '))+'</span>';
const field=(id,label,value='',type='text',extra='')=>{const tools=['text','url'].includes(type)?'<div class="field-editor-tools"><button class="field-tool-icon" type="button" data-action="expand-field" data-field="'+esc(id)+'" aria-label="Expand editor" title="Expand editor">⛶</button><button class="field-tool-icon" type="button" data-action="voice-field" data-field="'+esc(id)+'" aria-label="Voice input" title="Voice input">🎤</button></div>':'';return '<div class="field"><div class="field-label-row"><label for="'+esc(id)+'">'+esc(label)+'</label>'+tools+'</div><input id="'+esc(id)+'" type="'+esc(type)+'" value="'+esc(value)+'" '+extra+'></div>';};
const area=(id,label,value='',hint='')=>'<div class="field"><div class="field-label-row"><label for="'+esc(id)+'">'+esc(label)+'</label><div class="field-editor-tools"><button class="field-tool-icon" type="button" data-action="expand-field" data-field="'+esc(id)+'" aria-label="Expand editor" title="Expand editor">⛶</button><button class="field-tool-icon" type="button" data-action="voice-field" data-field="'+esc(id)+'" aria-label="Voice input" title="Voice input">🎤</button></div></div><textarea id="'+esc(id)+'">'+esc(value)+'</textarea>'+(hint?'<div class="input-help">'+esc(hint)+'</div>':'')+'</div>';
const head=(k,t,d,extra='')=>'<div class="page-heading"><div><div class="eyebrow">'+esc(k)+'</div><h1>'+esc(t)+'</h1>'+(d?'<p>'+esc(d)+'</p>':'')+'</div>'+extra+'</div>';
const notice=(message,error=false)=>{const n=$('#notice');n.textContent=message||'';n.classList.toggle('error',error);if(message)window.scrollTo({top:0,behavior:'smooth'})};
const state={sb:null,me:null,account:null,accounts:[],profiles:[],assignments:[],jobs:[],apps:[],docs:[],submitted:[],runs:[],referenceResumes:[],documentAuthorizations:[],candidateEvidence:[],searchStrategies:[],generalResumes:[],selectedCustomer:null,page:'overview',csvPreview:null,zipPreview:null,editingRole:null,loading:false,workspaceView:'admin',previewStaffId:null,resultStatusFilter:'all',resultQualificationFilter:'all',resultSearch:'',reviewDrafts:{},approvedSelections:{},approvedStatusDrafts:{},bulkSubmitApps:[],resultStatusDrafts:{},profileDirty:false,aiPromptPreview:'',aiPromptProposal:null,profileEditSection:null};
let resultSearchTimer=null;
let activeSpeechRecognition=null;
let activeSpeechTarget=null;
let activeSpeechBase='';
let activeSpeechFinal='';
const byId=(rows,id)=>rows.find(r=>r.id===id);
const currentCustomer=()=>state.account?.role==='customer'?state.account.id:state.selectedCustomer;
const customerAccount=(id)=>byId(state.accounts,id);
const customerName=(id)=>customerAccount(id)?.full_name || customerAccount(id)?.email || id?.slice(0,8) || 'Customer';
const matchingJobs=(id)=>state.jobs.filter(j=>j.customer_id===id);
const matchingApps=(id)=>state.apps.filter(a=>a.customer_id===id);
const docFor=(appId,kind)=>state.docs.filter(d=>d.application_id===appId&&d.kind===kind).sort((a,b)=>b.version-a.version)[0];
const appliedDocFor=(appId,kind)=>{const chosen=state.submitted.find(d=>d.application_id===appId&&d.kind===kind);return chosen?state.docs.find(d=>d.id===chosen.document_version_id):docFor(appId,kind)};
const canPrepare=(app)=>!!docFor(app.id,'resume')&&!!docFor(app.id,'cover_letter');

function renderSetup(){
 $('#sidebar').classList.add('hidden');$('#logoutBtn').classList.add('hidden');
 $('#page').innerHTML='<div class="auth" style="max-width:660px"><section class="card"><span class="badge warn">Backend setup required</span><h1 style="margin:15px 0 9px">MatchPath beta portal</h1><p>The portal code is deployed separately from the public demo. It will activate after a dedicated Supabase project is configured and the schema migration is applied.</p><div class="warning">No customer data is stored here yet. Do not use the demonstration site to process real applicant information.</div><div class="stack" style="margin-top:21px"><a class="btn" href="../">View existing interactive demo</a><a class="btn outline" href="https://github.com/hugary99-lab/matchpath-website">View source</a></div><hr><h3>Deployment checklist</h3><ul class="checklist"><li>Create a dedicated MatchPath Supabase project</li><li>Apply the migration in supabase/migrations</li><li>Put its API URL and publishable key in beta/config.js</li><li>Create the founding admin account and assign staff</li><li>Complete RLS and document access tests</li></ul></section></div>';
}
function renderAuth(mode='login'){
 $('#sidebar').classList.add('hidden');$('#logoutBtn').classList.add('hidden');$('#signedInAs').textContent='';
 const signup=mode==='signup';
 $('#page').innerHTML='<div class="auth"><section class="card"><div class="eyebrow">Member access</div><h1>'+(signup?'Create your account':'Welcome back')+'</h1><p>'+(signup?'Start your confidential career-search profile. No charges are collected in this beta.':'Sign in to your personal MatchPath workspace.')+'</p><form id="authForm" data-mode="'+mode+'">'+(signup?field('authName','Your name','','text','autocomplete="name" required'):'')+field('authEmail','Email address','','email','autocomplete="email" required')+field('authPassword','Password','','password','autocomplete="'+(signup?'new-password':'current-password')+'" minlength="8" required')+'<button class="btn" type="submit">'+(signup?'Create account':'Sign in')+'</button></form><div class="auth-switch">'+(signup?'Already registered? <button class="btn ghost small" data-action="show-login">Sign in</button>':'New customer? <button class="btn ghost small" data-action="show-signup">Create account</button>')+'</div><hr><p class="hint">Staff and admin access is assigned by an administrator. Creating an account does not grant staff permissions.</p></section></div>';
}
function navItems(){
 const r=state.account.role==='admin'&&state.workspaceView==='staff'?'staff':state.account.role;
 if(r==='customer'){
  if(isDiyCustomer())return [['overview','Overview'],['customer-profile','Profile Review'],['profile-analysis','Profile Analysis'],['import','Job Search'],['queue-new','To be reviewed'],['queue-approved','Approved'],['queue-submitted','Submitted'],['queue-skipped','Skipped'],['queue-all','All results'],['documents','Documents'],['profile','Search profile']];
  return [['overview','Overview'],['matches','Review job matches'],['applications','My applications'],['profile','Search profile']];
 }
 return r==='staff'
  ?[['overview','Overview'],['customer-profile','Profile Review'],['profile-analysis','Profile Analysis'],['import','Job Search'],['queue-new','To be reviewed'],['queue-approved','Approved'],['queue-submitted','Submitted'],['queue-skipped','Skipped'],['queue-all','All results'],['documents','Document uploads']]
  :[['overview','Overview'],['customer-profile','Profile Review'],['profile-analysis','Profile Analysis'],['import','Job Search'],['queue-new','To be reviewed'],['queue-approved','Approved'],['queue-submitted','Submitted'],['queue-skipped','Skipped'],['queue-all','All results'],['documents','Document uploads'],['admin','Accounts & access']];
}
function buildNav(){
 $('#sidebar').classList.remove('hidden');$('#logoutBtn').classList.remove('hidden');
 const r=state.account.role;
 const preview=r==='admin'&&state.workspaceView==='staff';
 $('#modeLabel').innerHTML=r==='admin'?'<label for="workspaceSwitch">Workspace </label><select id="workspaceSwitch"><option value="admin" '+(!preview?'selected':'')+'>Admin workspace</option><option value="staff" '+(preview?'selected':'')+'>Staff workspace preview</option></select>':(r==='staff'?'Staff':isDiyCustomer()?'DIY customer':'Customer')+' workspace';
 $('#signedInAs').innerHTML='<strong>'+esc(state.account.full_name||state.me.email)+'</strong><span>'+esc(state.me.email)+'</span><span>'+esc(r.toUpperCase())+(preview?' · STAFF PREVIEW':'')+'</span>';
 $('#mainNav').innerHTML=navItems().map(([id,n])=>'<button type="button" class="nav-button '+(state.page===id?'active':'')+'" data-action="navigate" data-page="'+id+'">'+esc(n)+'</button>').join('');
}
function customerPicker(){
 if(state.account.role==='customer')return '';
 const preview=state.account.role==='admin'&&state.workspaceView==='staff';
 const staff=state.accounts.filter(x=>x.role==='staff');
 const customers=state.accounts.filter(x=>x.role==='customer'&&(!preview||!state.previewStaffId||state.assignments.some(a=>a.staff_id===state.previewStaffId&&a.customer_id===x.id)));
 if(preview&&!customers.some(c=>c.id===state.selectedCustomer))state.selectedCustomer=customers[0]?.id||null;
 const selector=preview?'<div class="field" style="min-width:220px;margin:0"><label for="previewStaffSelect">Preview staff member</label><select id="previewStaffSelect"><option value="">All customers (generic preview)</option>'+staff.map(x=>'<option value="'+esc(x.id)+'" '+(state.previewStaffId===x.id?'selected':'')+'>'+esc(x.full_name||x.email)+'</option>').join('')+'</select></div>':'';
 return selector+'<div class="field" style="min-width:min(300px,100%);margin:0"><label for="customerSelect">Working on customer</label><select id="customerSelect">'+customers.map(x=>'<option value="'+esc(x.id)+'" '+(currentCustomer()===x.id?'selected':'')+'>'+esc(x.full_name||x.email)+'</option>').join('')+'</select></div>';
}
function currentProfile(){return state.profiles.find(p=>p.customer_id===currentCustomer())}
// Text links to external employer sites use ↗; routine buttons use verbs only.
const COPY=Object.freeze({
 save:'Save changes',openPosting:'Open posting ↗',viewDocuments:'View documents',
 viewPrompt:'View AI search prompt',updatePrompt:'Update AI search prompt',
 runSearch:'Run AI job search',recordSubmission:'Record submission',
 confirmSubmission:'Confirm submission',emptyChanges:'No unsaved changes'
});
const JOB_STATUSES=Object.freeze([['new','To be reviewed'],['approved','Approved'],['skipped','Skipped'],['rejected','Rejected']]);
function jobStatusSelect(job,value,dataAttribute,allowed=['new','approved','skipped','rejected'],disabled=false){
 return '<select class="form-control" '+dataAttribute+' data-job="'+esc(job.id)+'" aria-label="Status for '+esc(job.job_title)+'" '+(disabled?'disabled':'')+'>'+
 JOB_STATUSES.filter(([v])=>allowed.includes(v)).map(([v,label])=>'<option value="'+v+'" '+(value===v?'selected':'')+'>'+label+'</option>').join('')+'</select>';
}
function draftCount(){return Object.keys(state.reviewDrafts).length+Object.keys(state.approvedStatusDrafts).length+Object.keys(state.resultStatusDrafts).length+(state.profileDirty?1:0)}
function confirmDiscardChanges(){return !draftCount()||confirm('You have unsaved changes. Discard them?')}
function clearStatusDrafts(){state.reviewDrafts={};state.approvedStatusDrafts={};state.resultStatusDrafts={};state.approvedSelections={};state.profileDirty=false}
function updateResultSaveState(){
 const count=Object.keys(state.resultStatusDrafts).length,b=$('#saveResultChanges'),n=$('#resultChangeCount');
 if(b)b.disabled=count===0;
 if(n)n.textContent=count?count+' unsaved change'+(count===1?'':'s'):COPY.emptyChanges;
}
const currentDocumentAuthorization=()=>state.documentAuthorizations.find(a=>a.customer_id===currentCustomer()&&!a.revoked_at)||null;
function canRecordSubmission(){const a=currentDocumentAuthorization(),r=state.account?.role,t=currentProfile()?.service_tier;return !!a&&(r==='customer'&&t==='diy'||(r==='admin'||r==='staff')&&t==='full_service'&&a.allow_managed_submission)}
function documentConsentPanel(){
 const id=currentCustomer();if(!id)return '';
 const a=currentDocumentAuthorization(),r=state.account?.role,full=currentProfile()?.service_tier==='full_service',managed=!!a?.allow_managed_submission;
 let html='<section class="card section"><div class="space"><h2>AI document authorization</h2><span class="badge '+(a?'neutral':'warn')+'">'+(a?'Authorized':'Authorization required')+'</span></div>';
 if(r!=='customer')return html+'<p class="muted">'+(a?'Customer accepted on '+fmtDate(a.accepted_at)+(managed?'; staff submission authorized.':'; staff submission not authorized.'):'Awaiting customer consent; no new application documents or submissions are permitted.')+'</p></section>';
 html+='<p>MatchPath can prepare truthful, ATS-friendly, job-tailored resumes and cover letters without requesting approval of each document. ATS formatting does not guarantee interviews.</p>';
 html+='<p class="hint">Preparing documents may involve processing your career profile, resume files and candidate evidence with AI service providers. MatchPath must not invent qualifications. You may review files and revoke consent for future use.</p>';
 html+='<p class="hint">'+esc("I authorize MatchPath to process my career profile, provided resume files, and candidate evidence with AI providers to prepare truthful, ATS-friendly, job-tailored resumes and cover letters. MatchPath may use these documents for jobs I authorize without asking me to approve each document. I understand that ATS compatibility does not guarantee an interview and that I may revoke this authorization for future use.")+'</p>';
 if(full)html+='<p class="hint">'+esc("For full-service jobs I authorize, I separately permit authorized MatchPath staff to submit AI-tailored application documents on my behalf following a human quality check. MatchPath will record actual employer submission confirmation.")+'</p>';
 if(a)html+='<p class="hint">Authorized '+fmtDate(a.accepted_at)+(full?(managed?' · Staff submission authorized':' · Staff submission not authorized'):' · DIY self-application')+'</p><button type="button" class="btn ghost small" data-action="revoke-document-consent">Withdraw authorization</button>';
 if(!a||(full&&!managed)){
  html+='<form id="documentConsentForm" class="section"><label class="check-option"><input id="consentConfirm" type="checkbox" required> I authorize MatchPath to generate and use AI-tailored application documents without individual resume approval under these terms.</label>';
  if(full)html+='<label class="check-option"><input id="consentManaged" type="checkbox"> I separately authorize MatchPath staff to submit documents for jobs I approve after human quality checks, recording employer confirmation.</label>';
  html+='<button class="btn" type="submit">'+(a?'Update authorization':'Authorize AI document preparation')+'</button></form>';
 }
 return html+'</section>';
}
function latestCandidateEvidence(customer=currentCustomer()){return state.candidateEvidence.filter(x=>x.customer_id===customer).sort((a,b)=>Number(b.version)-Number(a.version))[0]||null}
function latestSearchStrategy(customer=currentCustomer()){return state.searchStrategies.filter(x=>x.customer_id===customer).sort((a,b)=>Number(b.version)-Number(a.version))[0]||null}
function currentSearchStrategy(customer=currentCustomer()){return state.searchStrategies.filter(x=>x.customer_id===customer&&x.status==='current').sort((a,b)=>Number(b.version)-Number(a.version))[0]||null}
function candidateEvidenceCurrent(ev=latestCandidateEvidence(),customer=currentCustomer()){if(!ev)return false;const current=state.referenceResumes.filter(r=>r.customer_id===customer).map(r=>String(r.id)).sort(),used=(ev.source_resume_ids||[]).map(String).sort();return current.length===used.length&&current.every((id,i)=>id===used[i])}
function searchStrategyCurrent(strategy=latestSearchStrategy(),customer=currentCustomer()){if(!strategy)return false;const ev=latestCandidateEvidence(customer),p=state.profiles.find(x=>x.customer_id===customer);return !!ev&&String(strategy.source_evidence_id)===String(ev.id)&&new Date(strategy.source_profile_updated_at||0).getTime()===new Date(p?.updated_at||0).getTime()}

function currentGeneralResumes(customer=currentCustomer()){return state.generalResumes.filter(x=>x.customer_id===customer&&x.status==='current').sort((a,b)=>String(a.category_name||'').localeCompare(String(b.category_name||'')))}
function generalResumeLibraryCurrent(rows=currentGeneralResumes(),customer=currentCustomer()){
 const ev=latestCandidateEvidence(customer),live=currentSearchStrategy(customer);
 return !!ev&&!!live&&searchStrategyCurrent(live,customer)&&rows.length>0&&rows.every(x=>String(x.source_evidence_id)===String(ev.id)&&String(x.source_strategy_id)===String(live.id));
}
function generalResumeText(row){
 const r=row?.resume_json||{},parts=[];
 if(r.candidate_name)parts.push(String(r.candidate_name).toUpperCase());
 if(Array.isArray(r.contact_lines)&&r.contact_lines.length)parts.push(r.contact_lines.join(' | '));
 if(r.headline)parts.push('\n'+r.headline);
 if(r.professional_summary)parts.push('\nPROFESSIONAL SUMMARY\n'+r.professional_summary);
 if(Array.isArray(r.core_competencies)&&r.core_competencies.length)parts.push('\nCORE COMPETENCIES\n'+r.core_competencies.join(' • '));
 if(Array.isArray(r.systems_tools)&&r.systems_tools.length)parts.push('\nSYSTEMS & TOOLS\n'+r.systems_tools.join(' • '));
 if(Array.isArray(r.experience)&&r.experience.length){
  parts.push('\nPROFESSIONAL EXPERIENCE');
  r.experience.forEach(x=>{
   parts.push('\n'+[x.title,x.employer].filter(Boolean).join(' — '));
   const meta=[x.location,x.dates].filter(Boolean).join(' | ');if(meta)parts.push(meta);
   (x.bullets||[]).forEach(b=>parts.push('• '+b));
  });
 }
 if(Array.isArray(r.education)&&r.education.length)parts.push('\nEDUCATION\n'+r.education.join('\n'));
 if(Array.isArray(r.certifications)&&r.certifications.length)parts.push('\nCERTIFICATIONS\n'+r.certifications.join('\n'));
 (r.additional_sections||[]).forEach(s=>{if(s?.heading&&Array.isArray(s.items)&&s.items.length)parts.push('\n'+String(s.heading).toUpperCase()+'\n'+s.items.join('\n'));});
 return parts.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function generalResumePreviewHtml(row){
 const r=row?.resume_json||{};
 const list=a=>(Array.isArray(a)&&a.length?'<ul class="checklist">'+a.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p class="muted">None listed</p>');
 return '<div class="resume-preview-document">'+
  '<div class="resume-preview-header"><h2>'+esc(r.candidate_name||customerName(row?.customer_id))+'</h2>'+(Array.isArray(r.contact_lines)&&r.contact_lines.length?'<p>'+r.contact_lines.map(esc).join(' · ')+'</p>':'')+(r.headline?'<h3>'+esc(r.headline)+'</h3>':'')+'</div>'+
  (r.professional_summary?'<section><h3>Professional Summary</h3><p>'+esc(r.professional_summary)+'</p></section>':'')+
  '<section><h3>Core Competencies</h3>'+list(r.core_competencies)+'</section>'+
  (Array.isArray(r.systems_tools)&&r.systems_tools.length?'<section><h3>Systems & Tools</h3>'+list(r.systems_tools)+'</section>':'')+
  '<section><h3>Professional Experience</h3>'+((r.experience||[]).map(x=>'<div class="resume-preview-role"><div class="space"><strong>'+esc(x.title||'')+'</strong><span>'+esc(x.dates||'')+'</span></div><div class="muted">'+esc(x.employer||'')+(x.location?' · '+esc(x.location):'')+'</div>'+list(x.bullets)+'</div>').join('')||'<p class="muted">No experience listed</p>')+'</section>'+
  (Array.isArray(r.education)&&r.education.length?'<section><h3>Education</h3>'+list(r.education)+'</section>':'')+
  (Array.isArray(r.certifications)&&r.certifications.length?'<section><h3>Certifications</h3>'+list(r.certifications)+'</section>':'')+
  (r.additional_sections||[]).map(s=>'<section><h3>'+esc(s.heading||'Additional Information')+'</h3>'+list(s.items)+'</section>').join('')+
 '</div>';
}

function aiPromptNeedsUpdate(p=currentProfile()){
 if(!p)return false;
 if(!p.ai_search_prompt||!p.ai_prompt_profile_updated_at)return true;
 const profileTime=new Date(p.updated_at||0).getTime(),promptProfileTime=new Date(p.ai_prompt_profile_updated_at||0).getTime();
 return Number.isFinite(profileTime)&&Number.isFinite(promptProfileTime)?profileTime>promptProfileTime:true;
}
function profileValuesChanged(values,p=currentProfile()){
 if(!p)return true;
 const n=v=>String(v??'').trim();
 const pairs=[
  ['target_roles',values.target_roles,p.target_roles],['career_goals',values.career_goals,p.career_goals],
  ['preferred_locations',values.preferred_locations,p.preferred_locations],['salary_min',values.salary_min,p.salary_min],
  ['work_preference',values.work_preference,p.work_preference],['exclusions',values.exclusions,p.exclusions],
  ['search_instructions',values.search_instructions,p.search_instructions],['linkedin_url',values.linkedin_url,p.linkedin_url],
  ['salary_target',values.salary_target,p.salary_target],['service_tier',values.service_tier??p.service_tier,p.service_tier],
  ['salary_currency',values.salary_currency,p.salary_currency],['transferable_roles',values.transferable_roles,p.transferable_roles],
  ['employment_types',values.employment_types,p.employment_types],['industries',values.industries,p.industries],
  ['relocation_preferences',values.relocation_preferences,p.relocation_preferences],['pension_preferences',values.pension_preferences,p.pension_preferences],
  ['min_fit_score',values.min_fit_score,p.min_fit_score]
 ];
 return pairs.some(([,a,b])=>n(a)!==n(b));
}
function isDiyCustomer(){return state.account?.role==='customer'&&(currentProfile()?.service_tier||'diy')==='diy'}
function canOperateUi(){return state.account?.role==='admin'||state.account?.role==='staff'||isDiyCustomer()}
function operatorEyebrow(){return state.account?.role==='customer'?'DIY job search':'Staff operations'}
function profileText(value,fallback='Not specified'){const v=String(value??'').trim();return v?esc(v).replaceAll('\n','<br>'):esc(fallback)}
function profileEditIcon(section,label){return state.account?.role==='admin'?'<button class="icon-btn profile-edit-icon" type="button" data-action="edit-profile-section" data-section="'+esc(section)+'" aria-label="Edit '+esc(label)+'" title="Edit '+esc(label)+'">✎</button>':''}
function filteredQualifiedJobs(){const id=currentCustomer(),p=currentProfile();return matchingJobs(id).filter(j=>j.qualification_status==='Qualified'&&j.fit_score!=null&&j.fit_score>=(p?.min_fit_score??80))}
function dashboard(){
 const role=state.account.role==='admin'&&state.workspaceView==='staff'?'staff':state.account.role, id=currentCustomer();
 const operator=role!=='customer'||isDiyCustomer();
 const j=matchingJobs(id),a=matchingApps(id);
 const ready=a.filter(x=>x.status==='ready').length,submitted=a.filter(x=>x.status==='submitted').length;
 const matches=filteredQualifiedJobs();
 const pending=matches.filter(x=>x.review_status==='pending').length;
 const metrics=!operator?[['Jobs in tracker',j.length],['To review',pending],['Applications applied',submitted],['Qualified matches',matches.length]]:[['Jobs in tracker',j.length],['Approved queue',a.filter(x=>!['submitted','closed'].includes(x.status)).length],['Documents ready',ready],['Submitted',submitted]];
 const aiRuns=state.runs.filter(x=>x.customer_id===id&&x.run_type==='ai_search');
 const sumRun=(k)=>aiRuns.reduce((n,x)=>n+Number(x[k]||0),0);
 const funnelMetrics=[
  ['Web searches executed',sumRun('web_search_call_count')],
  ['Web sources retrieved',sumRun('web_sources_retrieved_count')],
  ['Postings fully evaluated',sumRun('ai_reviewed_count')],
  ['Rejected by filters',sumRun('rejected_mandatory_count')],
  ['Below fit threshold',sumRun('below_threshold_count')],
  ['Needs verification',sumRun('needs_verification_count')],
  ['Qualified',sumRun('qualified_count')],
  ['New imported',sumRun('new_rows')]
 ];
 const eyebrow=!operator?'My career search':role==='customer'?'DIY job search':role==='staff'?'Staff operations':'Administration';
 const description=!operator?'Your job matches and application activity, in one place.':role==='customer'?'Review jobs, prepare documents and track applications.':'Review jobs, prepare documents and track applications.';
 let html=head(eyebrow,'Good '+(new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening')+', '+(state.account.full_name?.split(' ')[0]||'there'),description,role==='customer'?'':customerPicker());
 html+='<div class="grid">'+metrics.map(([n,v])=>'<div class="card stat"><div class="name">'+n+'</div><div class="value">'+v+'</div></div>').join('')+'</div>';if(id)html+=documentConsentPanel();
 if(id){
  html+='<section class="section"><div class="space section-head"><div><div class="eyebrow">AI SEARCH FUNNEL</div><h2>Search activity</h2></div><span class="badge neutral">'+aiRuns.length+' AI run'+(aiRuns.length===1?'':'s')+'</span></div>'+
   (aiRuns.length?'<div class="grid">'+funnelMetrics.map(([n,v])=>'<div class="card stat"><div class="name">'+n+'</div><div class="value">'+v+'</div></div>').join('')+'</div>':'<div class="card empty"><strong>No AI searches yet</strong>Search activity appears after your first run.</div>')+
  '</section>';
 }
 if(!id&&role!=='customer')return html+'<div class="card section empty"><strong>No assigned customers yet</strong>Admin can assign customers in Accounts & access.</div>';
 const nextPage=!operator?'matches':role==='customer'?'queue-new':'import';
 const nextLabel=!operator?'Review matches':'Job Search';
 html+='<div class="section grid two"><div class="card"><h2>'+(!operator?'What happens next':'Daily workflow')+'</h2><ul class="checklist">'+(!operator?'<li>Review your verified job matches</li><li>Approve the jobs you want pursued</li><li>Access documents and submission updates</li>':role==='customer'?'<li>Review new job results</li><li>Approve or skip opportunities</li><li>Prepare/download tailored documents</li><li>Apply and record submission confirmation</li>':'<li>Choose a customer and run AI Job Search or import a CSV</li><li>Review and authorize the right jobs</li><li>Prepare job-specific documents</li><li>Apply on employer site and record confirmation</li>')+'</ul><button class="btn" data-action="navigate" data-page="'+nextPage+'">'+nextLabel+'</button></div><div class="card"><h2>Recent applications</h2>'+(a.length?a.slice(0,4).map(x=>{const job=byId(state.jobs,x.job_id);return '<div class="detail space"><div><div class="title">'+esc(job?.job_title||x.application_code)+'</div><div class="sub">'+esc(job?.company||'')+'</div></div>'+statusBadge(x.status)+'</div>'}).join(''):'<div class="empty"><strong>No applications yet</strong>Approved jobs will appear here.</div>')+'</div></div>';
 if(operator){html+='<section class="card section profile-entry"><div class="space"><div><div class="eyebrow">CUSTOMER PROFILE</div><h2>View profile</h2><p class="muted">Review the selected customer\'s saved search strategy, preferences and AI search controls.</p></div><button class="btn outline" data-action="navigate" data-page="customer-profile">View profile</button></div></section>'}
 if(role!=='customer'){html+='<section class="section card"><h2>Last search batches</h2>'+(state.runs.filter(x=>x.customer_id===id).slice(0,5).map(x=>'<p><span class="pill">'+esc(x.external_id)+'</span> · '+(x.run_type==='ai_search'?(Number(x.web_sources_retrieved_count||0)+' web sources · '+Number(x.ai_reviewed_count||0)+' fully evaluated · '+Number(x.qualified_count||0)+' qualified · '+Number(x.new_rows||0)+' new · '+Number(x.duplicate_rows||0)+' duplicates'):(Number(x.new_rows||0)+' new · '+Number(x.duplicate_rows||0)+' duplicates'))+' · '+fmtDate(x.created_at)+'</p>').join('')||'<p class="muted">No search runs yet.</p>')+'</section>'}
 return html;
}
function matchesPage(){
 let rows=filteredQualifiedJobs(), pending=rows.filter(x=>x.review_status==='pending');
 let html=head('Customer portal','Review opportunities','Approve a job before staff prepare its application.');
 if(!rows.length)return html+'<section class="card empty"><strong>No qualified matches available</strong>Staff will add results after the next search batch.</section>';
 html+='<div class="space section-head"><h2>'+pending.length+' awaiting your decision</h2><span class="badge neutral">Fit ≥ '+esc(currentProfile()?.min_fit_score??80)+'</span></div>';
 html+='<div class="flex-col">'+rows.map(j=>'<article class="card"><div class="space"><div><h3>'+esc(j.job_title)+'</h3><p class="muted">'+esc(j.company)+' · '+esc(j.location)+' · '+esc(j.work_arrangement)+'</p></div><span class="score">'+esc(j.fit_score)+'/100</span></div><p>'+esc(j.fit_reason)+'</p>'+(j.concerns?'<p class="hint">Considerations: '+esc(j.concerns)+'</p>':'')+'<div class="space detail actions"><span class="hint">'+money(j.salary_min,j.currency)+(j.salary_max?' – '+money(j.salary_max,j.currency):'')+'</span>'+statusBadge(j.review_status)+'</div><div class="stack"><a class="btn outline small" target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(j.job_url))+'">Open posting ↗</a>'+(j.review_status==='pending'?'<button class="btn small" data-action="decision" data-job="'+esc(j.id)+'" data-decision="approved">Approve</button><button class="btn ghost small" data-action="decision" data-job="'+esc(j.id)+'" data-decision="rejected">Reject</button>':'<span class="hint">Decision recorded '+fmtDate(j.decided_at)+'</span>')+'</div></article>').join('')+'</div>';
 return html;
}
function applicationsPage(){
 const a=matchingApps(currentCustomer());
 let html=head('Customer portal','My applications','View application status and documents.');
 if(!a.length)return html+'<section class="card empty"><strong>Nothing submitted or preparing yet</strong>Approve a job match to start a new application.</section>';
 return html+'<section class="flex-col">'+a.map(app=>{let j=byId(state.jobs,app.job_id);return '<article class="card"><div class="space"><div><span class="pill">'+esc(app.application_code)+'</span><h3 style="margin:9px 0 3px">'+esc(j?.job_title||'Application')+'</h3><div class="muted">'+esc(j?.company||'')+' · '+esc(j?.location||'')+'</div></div>'+statusBadge(app.status)+'</div><hr><p class="hint">Approved '+fmtDate(app.created_at)+' · Submitted '+fmtDate(app.submitted_at)+'</p>'+(app.submission_reference?'<p><strong>Confirmation:</strong> '+esc(app.submission_reference)+'</p>':'')+'<div class="stack section">'+docButtons(app)+'<a class="btn outline small" target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(j?.job_url))+'">Open posting ↗</a></div></article>'}).join('')+'</section>';
}
function docButtons(app){return ['resume','cover_letter'].map(k=>{let d=appliedDocFor(app.id,k);return d?'<button class="btn outline small" data-action="download" data-doc="'+esc(d.id)+'">'+(k==='resume'?'Download resume':'Download cover letter')+' v'+d.version+'</button>':'<span class="badge warn">'+(k==='resume'?'Resume':'Cover letter')+' pending</span>'}).join('')}
function customerProfileViewPage(){
 const p=currentProfile()||{},id=currentCustomer();
 const objectiveOptions=['Continue in my field','Change career path','Move private → public sector','Move public → private sector','Move up to management / director','Increase compensation','Improve stability / pension','Improve work-life balance'];
 const selectedObjectives=String(p.career_goals||'').split('\n').filter(x=>x.startsWith('• ')).map(x=>x.slice(2));
 const goalsFree=String(p.career_goals||'').split('\n').filter(x=>!x.startsWith('• ')).join('\n').trim();
 const employmentOptions=['Permanent','Full-time','Part-time','Contract','Temporary','Casual'];
 const selectedEmployment=String(p.employment_types||'').split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean);
 const employmentChoices=[...employmentOptions,...selectedEmployment.filter(x=>!employmentOptions.includes(x))];
 const referenceResumes=state.referenceResumes.filter(r=>r.customer_id===id);
 const referenceResumeCount=referenceResumes.length;
 const referenceResumeRemaining=Math.max(0,5-referenceResumeCount);
 const promptNeedsUpdate=aiPromptNeedsUpdate(p);
 const promptButton=promptNeedsUpdate
   ?'<button class="btn outline small" type="button" data-action="update-ai-prompt">'+(p.ai_search_prompt?'Update AI search prompt':'Create AI search prompt')+'</button>'
   :'<button class="btn outline small" type="button" disabled title="AI search prompt matches the current saved profile and reference resumes">AI prompt up to date</button>';
 const extra=state.account.role==='customer'
   ?'<div class="stack">'+promptButton+'<button class="btn ghost small" type="button" data-action="view-ai-prompt">View AI search prompt</button></div>'
   :'<div class="stack profile-heading-tools">'+customerPicker()+promptButton+'<button class="btn ghost small" type="button" data-action="view-ai-prompt">View AI search prompt</button></div>';
 let html=head('Profile Review',customerName(id)+' · Profile & Search Preferences','Review the saved search preferences. Use the pencil icon to edit a section.',extra);
 if(!id)return html+'<div class="card empty">No customer selected.</div>';
 html+=documentConsentPanel();
 const ro=(label,value)=>'<div class="field readonly-field"><label>'+esc(label)+'</label><div class="readonly-control">'+profileText(value)+'</div></div>';
 html+='<div class="profile-grid profile-review-grid">'+
 '<section class="card profile-panel"><div class="profile-view-head"><h2>Search focus</h2>'+profileEditIcon('search-focus','Search focus')+'</div>'+
 ro('Target roles and seniority',p.target_roles)+
 ro('Adjacent / transferable roles',p.transferable_roles)+
 ro('Industries and sectors',p.industries)+
 '<div class="field"><div class="field-label-row"><label>Employment type</label><span class="hint">Read only</span></div><div class="multi-check-grid readonly-checks">'+employmentChoices.map(x=>'<label class="check-option"><input type="checkbox" disabled '+(selectedEmployment.includes(x)?'checked':'')+'> '+esc(x)+'</label>').join('')+'</div></div>'+
 '</section>'+
 '<section class="card profile-panel"><div class="profile-view-head"><h2>Location, work & compensation</h2>'+profileEditIcon('location-comp','Location, work and compensation')+'</div>'+
 ro('Preferred locations',p.preferred_locations)+
 ro('Relocation flexibility',p.relocation_preferences)+
 '<div class="form-row">'+ro('Work arrangement',p.work_preference)+ro('Minimum compensation',p.salary_min?money(p.salary_min,p.salary_currency||'CAD'):'Not specified')+'</div>'+
 '<div class="form-row">'+ro('Currency',p.salary_currency||'CAD')+ro('Target compensation',p.salary_target?money(p.salary_target,p.salary_currency||'CAD'):'Not specified')+'</div>'+
 ro('Benefits / pension preferences',p.pension_preferences)+
 '</section>'+
 '<section class="card profile-panel"><div class="profile-view-head"><h2>Career priorities</h2>'+profileEditIcon('career-priorities','Career priorities')+'</div>'+
 '<div class="profile-objectives readonly-objectives">'+objectiveOptions.map(o=>'<label><input type="checkbox" disabled '+(selectedObjectives.includes(o)?'checked':'')+'> '+esc(o)+'</label>').join('')+'</div>'+
 ro('Career destination, priorities and timeline',goalsFree)+
 '</section>'+
 '<section class="card profile-panel"><div class="profile-view-head"><h2>AI search controls</h2>'+profileEditIcon('ai-search-controls','AI search controls')+'</div>'+
 ro('LinkedIn public profile URL',p.linkedin_url)+
 ro('Mandatory requirements / hard exclusions',p.exclusions)+
 ro('Additional AI search instructions',p.search_instructions)+
 '<div class="form-row">'+ro('Minimum fit score',p.min_fit_score??80)+ro('Service preference',p.service_tier==='full_service'?'Full Service — human staff applies':'DIY — customer applies')+'</div>'+
 '<div class="profile-prompt-state"><strong>'+(p.ai_search_prompt?'AI search prompt exists':'AI search prompt not created yet')+'</strong><span class="hint">'+(promptNeedsUpdate?(p.ai_search_prompt?'Profile or reference resumes changed. Update the AI search prompt before the next search.':'Create the AI search prompt from this profile and its original/reference resumes.'):'AI search prompt is current for this profile.')+'</span></div>'+
 '</section>'+
 '<section class="card profile-panel profile-span"><div class="profile-view-head"><div><h2>Original / Reference Resumes</h2><span class="hint">'+referenceResumeCount+' of 5 uploaded'+(referenceResumeRemaining?' · '+referenceResumeRemaining+' remaining':' · maximum reached')+'</span></div>'+(state.account.role==='admin'&&referenceResumeRemaining>0?'<div><input id="reviewReferenceFiles" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple class="hidden"><button class="btn outline small" type="button" data-action="choose-reference-resumes" title="Upload original/reference resumes">Upload resume</button></div>':'')+'</div>'+
 '<p class="muted">These source resumes help MatchPath verify experience and improve the AI search prompt. They are not sent on every job search.</p>'+
 '<div class="reference-resume-list">'+(referenceResumes.length?referenceResumes.map(r=>'<div class="reference-resume-row"><div class="reference-resume-file"><span class="resume-file-icon" aria-hidden="true">📄</span><div><strong>'+esc(r.original_filename)+'</strong><span class="hint">'+fmtDate(r.created_at)+'</span></div></div><button class="btn ghost small" type="button" data-action="reference-download" data-path="'+esc(r.storage_path)+'" >Open resume</button></div>').join(''):'<div class="empty compact"><strong>No original resumes uploaded yet</strong>Admin can upload up to 5 PDF or Word resumes directly here.</div>')+'</div>'+
 '</section>'+
 '</div></form>';
 return html;
}
function profileAnalysisPage(){
 const id=currentCustomer(),p=currentProfile()||{};
 let html=head('Profile Analysis',customerName(id)+' · Evidence, Strategy & Resume Library','Analyze resumes, build a search strategy and create reusable resumes.',state.account.role==='customer'?'':customerPicker());
 if(!id)return html+'<div class="card empty">No customer selected.</div>';
 const resumes=state.referenceResumes.filter(r=>r.customer_id===id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
 const evidence=latestCandidateEvidence(id),evidenceCurrent=candidateEvidenceCurrent(evidence,id);
 const strategy=latestSearchStrategy(id),strategyCurrent=searchStrategyCurrent(strategy,id);
 const live=currentSearchStrategy(id),liveCurrent=searchStrategyCurrent(live,id);
 const generalResumes=currentGeneralResumes(id),generalResumesCurrent=generalResumeLibraryCurrent(generalResumes,id);
 const e=evidence?.evidence_json||{},s=strategy?.strategy_json||{};
 const badges=(items,cls='neutral')=>(Array.isArray(items)&&items.length?items.slice(0,8).map(x=>'<span class="badge '+cls+'">'+esc(x)+'</span>').join(' ')+(items.length>8?'<details class="extra-evidence"><summary>Show '+(items.length-8)+' more</summary><div class="stack wrap section">'+items.slice(8).map(x=>'<span class="badge '+cls+'">'+esc(x)+'</span>').join(' ')+'</div></details>':''):'<span class="muted">None recorded</span>');
 html+='<div class="analysis-flow section"><div class="analysis-step '+(resumes.length?'done':'')+'"><strong>1</strong><span>Resume Analysis</span></div><div class="analysis-arrow">→</div><div class="analysis-step '+(evidence&&evidenceCurrent?'done':'')+'"><strong>2</strong><span>Candidate Evidence</span></div><div class="analysis-arrow">→</div><div class="analysis-step '+(live&&liveCurrent?'done':'')+'"><strong>3</strong><span>AI Search Strategy</span></div><div class="analysis-arrow">→</div><div class="analysis-step '+(generalResumesCurrent?'done':'')+'"><strong>4</strong><span>General Resume Library</span></div></div>';
 html+='<section class="card section"><div class="space"><div><div class="eyebrow">STEP 1</div><h2>Resume Analysis</h2><p class="muted">Analyzes up to five resumes. Your stated career preferences remain unchanged.</p></div><button class="btn" type="button" data-action="run-resume-analysis" '+(resumes.length?'':'disabled title="Upload at least one resume first"')+'>'+(evidence?(evidenceCurrent?'Re-run resume analysis':'Resume changed — re-analyze'):'Run resume analysis')+'</button></div><div class="stack section"><span class="badge '+(resumes.length?'neutral':'warn')+'">'+resumes.length+' resume'+(resumes.length===1?'':'s')+' available</span>'+(evidence?'<span class="badge '+(evidenceCurrent?'':'warn')+'">Evidence v'+esc(evidence.version)+' · '+(evidenceCurrent?'Current':'Stale')+'</span>':'<span class="badge warn">No Candidate Evidence yet</span>')+'</div>'+(resumes.length?'<div class="reference-resume-list section">'+resumes.map(r=>'<div class="reference-resume-row"><div class="reference-resume-file"><span class="resume-file-icon">📄</span><div><strong>'+esc(r.original_filename)+'</strong><span class="hint">'+fmtDate(r.created_at)+'</span></div></div><button class="btn ghost small" type="button" data-action="reference-download" data-path="'+esc(r.storage_path)+'" >Open resume</button></div>').join('')+'</div>':'<div class="warning section">Upload a resume from Profile Review to begin.</div>')+'</section>';
 html+='<section class="card section"><div class="space"><div><div class="eyebrow">STEP 2</div><h2>Candidate Evidence</h2><p class="muted">Supported and candidate-stated experience inform matching. Suggested edits strengthen resume evidence.</p></div>'+(evidence?'<span class="badge '+(evidenceCurrent?'':'warn')+'">v'+esc(evidence.version)+' · '+(evidenceCurrent?'Current':'Stale')+'</span>':'')+'</div>'+(evidence?'<div class="analysis-summary"><h3>'+esc(e.headline||'Candidate evidence')+'</h3><p>'+esc(e.career_summary||'')+'</p>'+(e.years_experience_summary?'<p class="hint">'+esc(e.years_experience_summary)+'</p>':'')+'</div><div class="grid two section"><div><h3>Verified roles</h3><div class="stack wrap">'+badges(e.verified_roles)+'</div><h3>Verified skills</h3><div class="stack wrap">'+badges(e.verified_skills)+'</div><h3>Systems / tools</h3><div class="stack wrap">'+badges(e.verified_systems)+'</div></div><div><h3>Candidate-stated experience</h3><div class="stack wrap">'+badges(e.candidate_stated_experience||e.unsupported_or_unverified||[])+'</div><p class="hint">Explicit claims on the resume are treated as candidate experience even when the work-history bullets could support them more strongly.</p><h3>Resume strengthening recommendations</h3><div class="resume-strengthening-list">'+((e.resume_strengthening_recommendations||[]).length?(e.resume_strengthening_recommendations||[]).map(r=>'<div class="resume-strengthening-item"><strong>'+esc(r.claim||'Resume claim')+'</strong><span>'+esc(r.current_support||'')+'</span><em>Recommended: '+esc(r.recommended_addition||'Add a concrete role-level example.')+'</em></div>').join(''):(e.evidence_gaps||[]).length?'<div class="empty compact"><strong>Recommendations need refreshing</strong>Re-run resume analysis to get specific suggestions. <details><summary>View '+e.evidence_gaps.length+' earlier note'+(e.evidence_gaps.length===1?'':'s')+'</summary><ul class="checklist">'+e.evidence_gaps.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details></div>':'<span class="muted">No strengthening recommendations recorded.</span>')+'</div><h3>Questions to clarify</h3><div class="stack wrap">'+badges(e.unresolved_evidence_questions||[],'warn')+'</div><h3>Education & certifications</h3><div class="stack wrap">'+badges([...(e.education||[]),...(e.certifications||[])])+'</div></div></div><details class="section"><summary>More evidence details</summary><div class="grid two section"><div><h3>Responsibilities</h3><ul class="checklist">'+(e.responsibilities||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div><div><h3>Achievements</h3><ul class="checklist">'+(e.achievements||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div></div></details>':'<div class="empty section"><strong>Candidate Evidence has not been created</strong>Run resume analysis to build a structured evidence record.</div>')+'</section>';
 const canBuild=!!evidence&&evidenceCurrent;
 html+='<section class="card section"><div class="space"><div><div class="eyebrow">STEP 3</div><h2>AI Search Strategy</h2><p class="muted">Combines your preferences and Candidate Evidence into a job-search strategy.</p></div><button class="btn" type="button" data-action="build-search-strategy" '+(canBuild?'':'disabled title="Current Candidate Evidence required"')+'>'+(strategy?(strategyCurrent?'Build new strategy version':'Update search strategy'):'Build AI search strategy')+'</button></div>'+(strategy?'<div class="stack section"><span class="badge neutral">Strategy v'+esc(strategy.version)+'</span><span class="badge '+(strategyCurrent?'':'warn')+'">'+(strategyCurrent?'Inputs Current':'Inputs Changed')+'</span><span class="badge neutral">'+esc(strategy.status)+'</span></div><div class="analysis-summary"><h3>'+esc(s.strategy_summary||'AI Search Strategy')+'</h3></div><div class="grid two section"><div><h3>Primary roles</h3><div class="stack wrap">'+badges(s.primary_roles)+'</div><h3>Adjacent roles</h3><div class="stack wrap">'+badges(s.adjacent_roles)+'</div><h3>Priority sectors</h3><div class="stack wrap">'+badges(s.priority_sectors)+'</div></div><div><h3>Mandatory filters</h3><div class="stack wrap">'+badges(s.mandatory_filters)+'</div><h3>Verified strengths</h3><div class="stack wrap">'+badges(s.verified_strengths)+'</div><h3>Needs verification</h3><div class="stack wrap">'+badges(s.needs_verification,'warn')+'</div></div></div><div class="stack section"><button class="btn outline small" type="button" data-action="view-strategy-prompt" data-strategy="'+esc(strategy.id)+'">View strategy prompt</button>'+(strategy.status!=='current'&&strategyCurrent?'<button class="btn small" type="button" data-action="activate-search-strategy" data-strategy="'+esc(strategy.id)+'">Activate strategy</button>':'')+(strategy.status==='current'&&strategyCurrent?'<span class="badge">Live AI Search Strategy</span>':'')+'</div>':'<div class="empty section"><strong>No AI Search Strategy yet</strong>Build one after Candidate Evidence is current.</div>')+'</section>';
 const canGenerateGeneralResumes=!!live&&liveCurrent&&!!evidence&&evidenceCurrent;
 html+='<section class="card section"><div class="space"><div><div class="eyebrow">STEP 4</div><h2>General Resume Library</h2><p class="muted">Creates ATS-friendly baseline resumes by career focus. Tailor them for each job.</p></div><button class="btn" type="button" data-action="generate-general-resumes" '+(canGenerateGeneralResumes?'':'disabled title="Activate a current AI Search Strategy first"')+'>'+(generalResumes.length?(generalResumesCurrent?'Regenerate resume library':'Rebuild resume library'):'Generate general resumes')+'</button></div>'+
 (generalResumes.length?'<div class="stack section"><span class="badge '+(generalResumesCurrent?'':'warn')+'">'+generalResumes.length+' categor'+(generalResumes.length===1?'y':'ies')+' · '+(generalResumesCurrent?'Current':'Inputs changed')+'</span>'+(live?'<span class="badge neutral">Strategy v'+esc(live.version)+'</span>':'')+(evidence?'<span class="badge neutral">Evidence v'+esc(evidence.version)+'</span>':'')+'</div><div class="general-resume-grid section">'+generalResumes.map(r=>'<article class="general-resume-card"><div class="space"><div><div class="eyebrow">GENERAL RESUME</div><h3>'+esc(r.category_name)+'</h3></div><span class="badge neutral">v'+esc(r.version)+'</span></div><p>'+esc(r.focus_summary||'Reusable baseline resume for this career lane.')+'</p><div class="stack wrap">'+badges(r.target_roles)+'</div><div class="stack section"><button class="btn outline small" type="button" data-action="view-general-resume" data-resume="'+esc(r.id)+'">View resume</button><button class="btn small" type="button" data-action="download-general-resume" data-format="docx" data-resume="'+esc(r.id)+'">Download DOCX</button><button class="btn small" type="button" data-action="download-general-resume" data-format="pdf" data-resume="'+esc(r.id)+'">Download PDF</button><button class="btn ghost small" type="button" data-action="copy-general-resume" data-resume="'+esc(r.id)+'">Copy text</button></div></article>').join('')+'</div>':'<div class="empty section"><strong>No baseline resumes yet</strong>Activate the current AI Search Strategy, then generate the category resume library.</div>')+
 '</section>';
 const history=state.searchStrategies.filter(x=>x.customer_id===id).sort((a,b)=>Number(b.version)-Number(a.version));
 if(history.length)html+='<section class="card section"><h2>Strategy history</h2><div class="table-wrap"><table><thead><tr><th>Version</th><th>Status</th><th>Created</th><th>Model</th></tr></thead><tbody>'+history.slice(0,10).map(x=>'<tr><td>v'+esc(x.version)+'</td><td>'+statusBadge(x.status)+'</td><td>'+fmtDate(x.created_at)+'</td><td>'+esc(x.model||'—')+'</td></tr>').join('')+'</tbody></table></div></section>';
 return html;
}

function profilePage(){
 const p=currentProfile()||{},id=currentCustomer(),operator=state.account?.role!=='customer';
 const active=state.profileEditSection||null;
 const isEditing=section=>active===section;
 const editIcon=(section,label)=>'<button class="icon-btn profile-edit-icon '+(isEditing(section)?'active':'')+'" type="button" data-action="edit-profile-section" data-section="'+esc(section)+'" aria-label="'+(isEditing(section)?'Editing ':'Edit ')+esc(label)+'" title="'+(isEditing(section)?'Editing ':'Edit ')+esc(label)+'">✎</button>';
 const saveButton=(section)=>isEditing(section)?'<div class="profile-section-actions"><button class="btn small" type="submit" data-section="'+esc(section)+'">'+COPY.save+'</button></div>':'';
 const pArea=(section,id,label,value='',hint='')=>isEditing(section)?area(id,label,value,hint):'<div class="field"><div class="field-label-row"><label for="'+esc(id)+'">'+esc(label)+'</label><span class="hint">Read only</span></div><textarea id="'+esc(id)+'" disabled>'+esc(value)+'</textarea>'+(hint?'<div class="input-help">'+esc(hint)+'</div>':'')+'</div>';
 const pField=(section,id,label,value='',type='text',extra='')=>isEditing(section)?field(id,label,value,type,extra):'<div class="field"><div class="field-label-row"><label for="'+esc(id)+'">'+esc(label)+'</label><span class="hint">Read only</span></div><input id="'+esc(id)+'" type="'+esc(type)+'" value="'+esc(value)+'" disabled></div>';
 const objectiveOptions=['Continue in my field','Change career path','Move private → public sector','Move public → private sector','Move up to management / director','Increase compensation','Improve stability / pension','Improve work-life balance'];
 const objectives=String(p.career_goals||'').split('\n').filter(x=>x.startsWith('• ')).map(x=>x.slice(2));
 const linkedinMatch=String(p.search_instructions||'').match(/^LinkedIn profile: (https:\/\/[^\s]+)/m);
 const cleanInstructions=String(p.search_instructions||'').replace(/^LinkedIn profile: https:\/\/[^\s]+\n?/m,'');
 const goalsFree=String(p.career_goals||'').split('\n').filter(x=>!x.startsWith('• ')).join('\n').trim();
 const employmentOptions=['Permanent','Full-time','Part-time','Contract','Temporary','Casual'];
 const selectedEmployment=String(p.employment_types||'').split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean);
 const employmentChoices=[...employmentOptions,...selectedEmployment.filter(x=>!employmentOptions.includes(x))];
 const referenceResumes=state.referenceResumes.filter(r=>r.customer_id===id);
 const referenceResumeCount=referenceResumes.length;
 const referenceResumeRemaining=Math.max(0,5-referenceResumeCount);
 const promptNeedsUpdate=aiPromptNeedsUpdate(p);
 const promptButton=promptNeedsUpdate
   ?'<button class="btn outline small" type="button" data-action="update-ai-prompt">'+(p.ai_search_prompt?'Update AI search prompt':'Create AI search prompt')+'</button>'
   :'<button class="btn outline small" type="button" disabled title="AI prompt matches the current saved profile">AI prompt up to date</button>';
 const headingExtra=operator
   ?'<div class="stack profile-heading-tools">'+customerPicker()+promptButton+'<button class="btn ghost small" type="button" data-action="view-ai-prompt">View AI search prompt</button></div>'
   :'<div class="stack">'+promptButton+'<button class="btn ghost small" type="button" data-action="view-ai-prompt">View AI search prompt</button></div>';
 let html=head('Edit Profile',customerName(id)+' · Profile & Search Preferences','Select the pencil icon to edit a section.',headingExtra);
 html+='<form id="profileForm" class="profile-compact"><div class="profile-grid">'+
 '<section id="profile-section-search-focus" class="card profile-panel '+(isEditing('search-focus')?'is-editing':'is-readonly')+'"><div class="profile-view-head"><h2>Search focus</h2>'+editIcon('search-focus','Search focus')+'</div>'+
 pArea('search-focus','target_roles','Target roles and seniority',p.target_roles)+
 pArea('search-focus','transferable_roles','Adjacent / transferable roles',p.transferable_roles)+
 pArea('search-focus','industries','Industries and sectors',p.industries)+
 '<div class="field"><div class="field-label-row"><label>Employment type</label><span class="hint">'+(isEditing('search-focus')?'Select all that apply':'Read only')+'</span></div><div class="multi-check-grid '+(isEditing('search-focus')?'':'readonly-checks')+'">'+employmentChoices.map(x=>'<label class="check-option"><input type="checkbox" name="employment_type" value="'+esc(x)+'" '+(selectedEmployment.includes(x)?'checked':'')+' '+(isEditing('search-focus')?'':'disabled')+'> '+esc(x)+'</label>').join('')+'</div></div>'+
 saveButton('search-focus')+
 '</section>'+
 '<section id="profile-section-location-comp" class="card profile-panel '+(isEditing('location-comp')?'is-editing':'is-readonly')+'"><div class="profile-view-head"><h2>Location, work & compensation</h2>'+editIcon('location-comp','Location, work and compensation')+'</div>'+
 pArea('location-comp','preferred_locations','Preferred locations',p.preferred_locations)+
 pArea('location-comp','relocation_preferences','Relocation flexibility',p.relocation_preferences)+
 '<div class="form-row"><div class="field"><div class="field-label-row"><label for="work_preference">Work arrangement</label><span class="hint">'+(isEditing('location-comp')?'':'Read only')+'</span></div><select id="work_preference" '+(isEditing('location-comp')?'':'disabled')+'>'+['Any','Remote','Hybrid','Onsite'].map(x=>'<option '+(p.work_preference===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div>'+
 pField('location-comp','salary_min','Minimum compensation',p.salary_min||'','number','min="0"')+'</div>'+
 '<div class="form-row"><div class="field"><div class="field-label-row"><label for="salary_currency">Currency</label><span class="hint">'+(isEditing('location-comp')?'':'Read only')+'</span></div><select id="salary_currency" '+(isEditing('location-comp')?'':'disabled')+'>'+['CAD','USD'].map(x=>'<option '+(p.salary_currency===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div>'+
 pField('location-comp','salary_target','Target compensation',p.salary_target||'','number','min="0"')+'</div>'+
 pArea('location-comp','pension_preferences','Benefits / pension preferences',p.pension_preferences)+
 saveButton('location-comp')+
 '</section>'+
 '<section id="profile-section-career-priorities" class="card profile-panel '+(isEditing('career-priorities')?'is-editing':'is-readonly')+'"><div class="profile-view-head"><h2>Career priorities</h2>'+editIcon('career-priorities','Career priorities')+'</div>'+
 '<div class="profile-objectives '+(isEditing('career-priorities')?'':'readonly-objectives')+'">'+objectiveOptions.map(o=>'<label><input type="checkbox" name="career_objective" value="'+esc(o)+'" '+(objectives.includes(o)?'checked':'')+' '+(isEditing('career-priorities')?'':'disabled')+'> '+esc(o)+'</label>').join('')+'</div>'+
 pArea('career-priorities','career_goals_detail','Career destination, priorities and timeline',goalsFree)+
 saveButton('career-priorities')+
 '</section>'+
 '<section id="profile-section-ai-search-controls" class="card profile-panel '+(isEditing('ai-search-controls')?'is-editing':'is-readonly')+'"><div class="profile-view-head"><h2>AI search controls</h2>'+editIcon('ai-search-controls','AI search controls')+'</div>'+
 pField('ai-search-controls','linkedin_url','LinkedIn public profile URL',p.linkedin_url||linkedinMatch?.[1]||'','url','placeholder="https://www.linkedin.com/in/your-profile"')+
 pArea('ai-search-controls','exclusions','Mandatory requirements / hard exclusions',p.exclusions,'Only true dealbreakers belong here.')+
 pArea('ai-search-controls','search_instructions','Additional AI search instructions',cleanInstructions,'Nice-to-have preferences belong here; keep hard exclusions above.')+
 '<div class="form-row">'+pField('ai-search-controls','min_fit_score','Minimum fit score',p.min_fit_score??80,'number','min="0" max="100" required')+
 '<div class="field"><div class="field-label-row"><label for="service_tier">Service preference</label><span class="hint">'+(state.account.role==='admin'&&isEditing('ai-search-controls')?'Admin only':'Read only')+'</span></div><select id="service_tier" '+(state.account.role==='admin'&&isEditing('ai-search-controls')?'':'disabled')+'><option value="diy" '+(p.service_tier!=='full_service'?'selected':'')+'>DIY — customer applies</option><option value="full_service" '+(p.service_tier==='full_service'?'selected':'')+'>Full Service — human staff applies</option></select></div></div>'+
 saveButton('ai-search-controls')+
 '</section>'+
 '<section id="profile-section-reference-resumes" class="card profile-panel profile-span '+(isEditing('reference-resumes')?'is-editing':'is-readonly')+'"><div class="profile-view-head"><div><h2>Original / Reference Resumes</h2><span class="hint">'+referenceResumeCount+' of 5 uploaded</span></div>'+((state.account.role==='admin'||state.account.role==='customer')?editIcon('reference-resumes','Original / Reference Resumes'):'')+'</div><div class="field"><label for="referenceFiles">Upload PDF or Word resumes</label><input id="referenceFiles" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple '+((state.account.role==='admin'||state.account.role==='customer')&&isEditing('reference-resumes')&&referenceResumeRemaining>0?'':'disabled')+'><span class="hint">'+(state.account.role==='staff'?'Staff can view these source resumes but only Admin or the customer can upload them.':referenceResumeRemaining>0?'Upload up to '+referenceResumeRemaining+' more PDF or Word resume'+(referenceResumeRemaining===1?'':'s')+'. Each file may be up to 6 MB. These resumes are used as evidence when AI builds the search prompt.':'Maximum of 5 original/reference resumes reached for this customer.')+'</span>'+((state.account.role==='admin'||state.account.role==='customer')?'<div class="input-help">When Create/Update AI search prompt runs, these resume files may be securely sent to OpenAI for resume-based experience analysis. They are not sent on every job search.</div>':'')+'</div><div class="reference-resume-list">'+(referenceResumes.length?referenceResumes.map(r=>'<div class="reference-resume-row"><div><strong>'+esc(r.original_filename)+'</strong><span class="hint">'+fmtDate(r.created_at)+'</span></div><button class="btn ghost small" type="button" data-action="reference-download" data-path="'+esc(r.storage_path)+'">Open resume</button></div>').join(''):'<div class="hint">No original/reference resumes uploaded for this customer yet.</div>')+'</div>'+(((state.account.role==='admin'||state.account.role==='customer')&&isEditing('reference-resumes')&&referenceResumeRemaining>0)?saveButton('reference-resumes'):'')+'</section>'+
 '</div></form>';
 return html;
}
function importPage(){
 const id=currentCustomer(),p=currentProfile()||{};
 const extra=state.account.role==='customer'?'<button class="btn outline small" data-action="navigate" data-page="customer-profile">View profile</button>':'<div class="stack">'+customerPicker()+'<button class="btn outline small" data-action="navigate" data-page="customer-profile">View profile</button></div>';
 let html=head(operatorEyebrow(),'Job Search','Search with saved criteria or import job results.',extra);
 if(!id)return html+'<div class="card empty">No customer assigned.</div>';
 const hasInstructions=[p.target_roles,p.search_instructions,p.career_goals,p.preferred_locations,p.industries].some(v=>String(v||'').trim());
 html+='<section class="card section"><div class="space"><div><div class="eyebrow">AI SEARCH</div><h2 style="margin:6px 0 8px">Search current openings</h2><p class="muted">Finds current jobs using your saved criteria. New matches appear in To be reviewed.</p><p class="hint">This action sends search criteria only; it does not send the customer\'s name, email or uploaded resume files.</p></div><div class="stack"><button class="btn outline small" data-action="view-ai-prompt" '+(hasInstructions?'':'disabled')+'>View AI search prompt</button><button class="btn" data-action="run-ai-search" '+(hasInstructions?'':'disabled title="Complete search instructions first"')+'>Run AI job search</button></div></div>'+(hasInstructions?'<div class="stack section"><span class="badge neutral">Fit ≥ '+esc(p.min_fit_score??80)+'</span>'+(p.preferred_locations?'<span class="badge neutral">'+esc(p.preferred_locations)+'</span>':'')+(p.employment_types?'<span class="badge neutral">'+esc(p.employment_types)+'</span>':'')+'</div>':'<div class="warning section">Search instructions are empty for this customer. Complete the Search Profile before running AI Job Search.</div>')+'</section>';
 html+='<section class="card section profile-entry"><div class="space"><div><div class="eyebrow">CUSTOMER PROFILE</div><h2>View profile</h2><p class="muted">Review the search criteria before running a search.</p></div><button class="btn outline" data-action="navigate" data-page="customer-profile">View profile</button></div></section>';
 html+='<section class="card section"><h2>Manual CSV Import</h2><p class="muted">Import a validated search CSV.</p><div class="file-box"><strong>Standard MatchPath search export (v1.0)</strong><p class="hint">UTF-8 CSV · exact 15 columns · customer and run IDs are assigned by MatchPath · up to 250 jobs per batch</p><input id="searchCsv" type="file" accept=".csv,text/csv"></div><p class="hint" style="margin-top:12px"><a href="../job_search_template.csv" target="_blank">Download standard CSV example ↗</a></p></section>';
 if(state.csvPreview){
  const v=state.csvPreview;
  html+='<section class="card section"><h2>Validate and import</h2><div class="stack"><span class="badge">'+v.rows.length+' evaluated</span><span class="badge neutral">'+v.rows.filter(x=>x.qualification_status==='Qualified').length+' qualified</span><span class="pill">Run ID assigned by backend</span></div><div class="table-wrap section"><table><thead><tr><th>Employer / role</th><th>Fit score</th><th>Classification</th></tr></thead><tbody>'+v.rows.slice(0,12).map(x=>'<tr><td><strong>'+esc(x.job_title)+'</strong><small>'+esc(x.company)+'</small></td><td>'+esc(x.fit_score||'—')+'</td><td>'+esc(x.qualification_status)+'</td></tr>').join('')+'</tbody></table></div><button class="btn section" data-action="commit-csv">Import jobs</button></section>';
 }
 return html;
}
function jobResultUiStatus(j){
 const app=state.apps.find(a=>a.job_id===j.id&&a.status!=='closed')||state.apps.find(a=>a.job_id===j.id);
 if(app?.status==='submitted')return 'applied';
 return j.review_status==='pending'?'new':j.review_status;
}
function resultFilterControls(forcedStatus,shown,total){
 const hasFilters=!!state.resultSearch.trim()||state.resultQualificationFilter!=='all'||(forcedStatus==='all'&&state.resultStatusFilter!=='all');
 return '<section class="card section"><div class="grid"><div class="field"><label for="resultSearch">Keyword</label><input id="resultSearch" value="'+esc(state.resultSearch)+'" placeholder="Title, employer, location, requisition..."></div>'+(forcedStatus==='all'?'<div class="field"><label for="resultStatusFilter">Status</label><select id="resultStatusFilter"><option value="all">All statuses</option>'+[['new','To be reviewed'],['approved','Approved'],['applied','Submitted'],['skipped','Skipped'],['rejected','Rejected']].map(([v,n])=>'<option value="'+v+'" '+(state.resultStatusFilter===v?'selected':'')+'>'+n+'</option>').join('')+'</select></div>':'')+'<div class="field"><label for="resultQualificationFilter">Qualification</label><select id="resultQualificationFilter"><option value="all">All qualifications</option>'+['Qualified','Needs Verification','Not Qualified'].map(v=>'<option value="'+esc(v)+'" '+(state.resultQualificationFilter===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></div></div><div class="stack">'+(hasFilters?'<button class="btn ghost small" type="button" data-action="clear-result-filters">Clear</button>':'')+'<span class="hint">'+shown+' of '+total+' jobs shown</span></div></section>';
}
function jobResultsPanel(forcedStatus='all'){
 const id=currentCustomer(),allRows=matchingJobs(id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 if(!id)return '<div class="card section empty"><strong>No customer selected</strong>Select a customer to view jobs.</div>';
 if(!allRows.length)return '<section class="card section empty"><strong>No jobs yet</strong>Run an AI search to find openings.<div class="section"><button class="btn outline small" data-action="navigate" data-page="import">Go to Job Search</button></div></section>';
 const search=state.resultSearch.trim().toLowerCase(),activeStatus=forcedStatus==='all'?state.resultStatusFilter:forcedStatus;
 const baseRows=allRows.filter(j=>activeStatus==='all'||jobResultUiStatus(j)===activeStatus);
 const rows=baseRows.filter(j=>(state.resultQualificationFilter==='all'||j.qualification_status===state.resultQualificationFilter)&&(!search||[j.job_title,j.company,j.location,j.requisition_id,j.fit_reason,j.concerns].join(' ').toLowerCase().includes(search)));
 const counts={new:0,approved:0,applied:0,skipped:0,rejected:0};
 allRows.forEach(j=>{const key=jobResultUiStatus(j);if(key in counts)counts[key]++});
 let html='<section class="section"><div class="stack section-head"><span class="badge neutral">'+counts.new+' To be reviewed</span><span class="badge neutral">'+counts.approved+' Approved</span><span class="badge">'+counts.applied+' Submitted</span><span class="badge neutral">'+counts.skipped+' Skipped</span><span class="badge neutral">'+counts.rejected+' Rejected</span></div>';
 html+=resultFilterControls(forcedStatus,rows.length,baseRows.length);
 if(canOperateUi()&&forcedStatus!=='applied'){
  const dirty=Object.keys(state.resultStatusDrafts).length;
  html+='<div class="space section section-head"><div class="hint" id="resultChangeCount">'+(dirty?dirty+' unsaved change'+(dirty===1?'':'s'):COPY.emptyChanges)+'</div><button class="btn" id="saveResultChanges" data-action="save-result-statuses" '+(dirty?'':'disabled')+'>'+COPY.save+'</button></div>';
 }
 if(!rows.length){
  const descriptions={applied:'No submissions recorded yet. Record confirmed employer submissions from Approved.',skipped:'No skipped jobs yet. Skipped opportunities will appear here.',all:'No jobs match these filters. Try clearing your filters.',new:'No jobs waiting for review.',approved:'No approved jobs yet.'};
  return html+'<section class="card section empty"><strong>Nothing to show</strong>'+descriptions[forcedStatus]+'<div class="section"><button class="btn outline small" data-action="navigate" data-page="'+(forcedStatus==='applied'?'queue-approved':forcedStatus==='all'?'import':'queue-new')+'">'+(forcedStatus==='applied'?'Go to Approved':forcedStatus==='all'?'Job Search':'Go to To be reviewed')+'</button></div></section></section>';
 }
 html+='<section class="card section"><div class="table-wrap"><table><thead><tr><th>Job</th><th>Fit</th><th>Qualification</th><th>Location</th><th>Salary</th><th>Status</th><th>Application</th><th>Actions</th></tr></thead><tbody>'+rows.map(j=>{
  const app=state.apps.find(a=>a.job_id===j.id&&a.status!=='closed')||state.apps.find(a=>a.job_id===j.id);
  const current=jobResultUiStatus(j),locked=current==='applied';
  const chosen=state.resultStatusDrafts[j.id]||current;
  const statusControl=canOperateUi()&&!locked?jobStatusSelect(j,chosen,'data-result-status'):('<span class="badge neutral">'+(current==='applied'?'Submitted':esc(JOB_STATUSES.find(([v])=>v===current)?.[1]||current))+'</span>');
  const qual=j.qualification_status==='Needs Verification'?'warn':j.qualification_status==='Not Qualified'?'red':'neutral';
  return '<tr><td><strong>'+esc(j.job_title)+'</strong><small>'+esc(j.company)+(j.requisition_id?' · Req '+esc(j.requisition_id):'')+'</small>'+(j.concerns?'<div class="concern-note">⚠ '+esc(j.concerns)+'</div>':'')+'</td><td><strong>'+esc(j.fit_score??'—')+(j.fit_score!=null?'/100':'')+'</strong></td><td><span class="badge '+qual+'">'+esc(j.qualification_status)+'</span></td><td>'+esc(j.location)+'<small>'+esc(j.work_arrangement||'Unknown')+'</small></td><td class="'+(j.salary_min==null?'salary-unlisted':'')+'">'+money(j.salary_min,j.currency)+(j.salary_max?' – '+money(j.salary_max,j.currency):'')+'</td><td>'+statusControl+'</td><td>'+(app&&app.status!=='closed'?'<span class="pill">'+esc(app.application_code)+'</span><small>'+esc(app.status)+'</small>':'<span class="muted">—</span>')+'</td><td><div class="stack"><a class="btn outline small" target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(j.job_url))+'">'+COPY.openPosting+'</a>'+(app&&app.status!=='closed'?'<button class="btn ghost small" data-action="navigate" data-page="documents" data-app="'+esc(app.id)+'">'+COPY.viewDocuments+'</button>':'')+'</div></td></tr>';
 }).join('')+'</tbody></table></div></section></section>';
 return html;
}
function reviewDraftCount(){return Object.keys(state.reviewDrafts||{}).length}
function updateReviewSaveState(){
 const count=reviewDraftCount(),button=$('#saveReviewDecisions'),label=$('#reviewChangeCount');
 if(button)button.disabled=count===0;
 if(label)label.textContent=count===0?'No unsaved changes':count+' unsaved change'+(count===1?'':'s');
}
function newReviewTriagePage(){
 const id=currentCustomer(),allRows=matchingJobs(id).filter(j=>jobResultUiStatus(j)==='new').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 let html=head(operatorEyebrow(),'To be reviewed','Choose Approve or Skip for each job, then save your changes.',customerPicker());
 if(!id)return html+'<div class="card empty">No customer selected.</div>';
 const search=state.resultSearch.trim().toLowerCase();
 const rows=allRows.filter(j=>(state.resultQualificationFilter==='all'||j.qualification_status===state.resultQualificationFilter)&&(!search||[j.job_title,j.company,j.location,j.requisition_id,j.fit_reason,j.concerns].join(' ').toLowerCase().includes(search)));
 html+=resultFilterControls('new',rows.length,allRows.length);
 html+='<p class="hint">Fit = match strength. Qualification = whether key requirements are confirmed.</p>';
 html+='<div class="space section section-head"><div><strong>Job decisions</strong><div class="hint" id="reviewChangeCount">'+(reviewDraftCount()?reviewDraftCount()+' unsaved change'+(reviewDraftCount()===1?'':'s'):COPY.emptyChanges)+'</div></div><button class="btn" id="saveReviewDecisions" data-action="save-review-decisions" '+(reviewDraftCount()?'':'disabled')+'>'+COPY.save+'</button></div>';
 if(!rows.length)return html+'<section class="card empty"><strong>No jobs to review</strong>Run a job search or clear the current filters.<div class="section"><button class="btn outline small" data-action="navigate" data-page="import">Go to Job Search</button></div></section>';
 html+='<section class="card"><div class="table-wrap"><table><thead><tr><th>Job</th><th>Fit</th><th>Qualification</th><th>Status</th><th>Posting</th></tr></thead><tbody>'+rows.map(j=>{
  const draft=state.reviewDrafts[j.id]||'new',qual=j.qualification_status==='Needs Verification'?'warn':j.qualification_status==='Not Qualified'?'red':'neutral';
  const salary=money(j.salary_min,j.currency)+(j.salary_max?' – '+money(j.salary_max,j.currency):'');
  return '<tr><td><strong>'+esc(j.job_title)+'</strong><small>'+esc(j.company)+(j.requisition_id?' · Req '+esc(j.requisition_id):'')+'</small><small>'+esc(j.location)+' · '+esc(j.work_arrangement||'Unknown')+' · <span class="'+(j.salary_min==null?'salary-unlisted':'')+'">'+esc(salary)+'</span></small>'+(j.concerns?'<div class="concern-note">⚠ '+esc(j.concerns)+'</div>':'')+'</td><td><strong>'+esc(j.fit_score??'—')+(j.fit_score!=null?'/100':'')+'</strong></td><td><span class="badge '+qual+'">'+esc(j.qualification_status)+'</span></td><td>'+jobStatusSelect(j,draft,'data-review-choice',['new','approved','skipped'])+'</td><td><a class="btn outline small" target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(j.job_url))+'">'+COPY.openPosting+'</a></td></tr>';
 }).join('')+'</tbody></table></div></section>';
 return html;
}
function approvedSelectionIds(){return Object.keys(state.approvedSelections||{}).filter(id=>state.approvedSelections[id])}
function updateApprovedBulkState(){
 const count=approvedSelectionIds().length;
 const label=$('#approvedSelectedCount');
 if(label)label.textContent=count+' selected';
 ['approvedResumeBatch','approvedMarkSubmitted'].forEach(id=>{const b=$('#'+id);if(b)b.disabled=count===0});
 const dirty=Object.keys(state.approvedStatusDrafts).length,save=$('#approvedSaveStatus'),changes=$('#approvedChangeCount');
 if(save)save.disabled=dirty===0;if(changes)changes.textContent=dirty?dirty+' unsaved change'+(dirty===1?'':'s'):COPY.emptyChanges;
}
function approvedResultsPage(){
 const id=currentCustomer(),allRows=matchingJobs(id).filter(j=>jobResultUiStatus(j)==='approved').sort((a,b)=>(b.fit_score??-1)-(a.fit_score??-1));
 let html=head(operatorEyebrow(),'Approved','Prepare documents and record employer submissions for approved jobs.',customerPicker());
 if(!id)return html+'<div class="card empty">No customer selected.</div>';
 html+=documentConsentPanel();
 const search=state.resultSearch.trim().toLowerCase();
 const rows=allRows.filter(j=>(state.resultQualificationFilter==='all'||j.qualification_status===state.resultQualificationFilter)&&(!search||[j.job_title,j.company,j.location,j.requisition_id,j.fit_reason,j.concerns].join(' ').toLowerCase().includes(search)));
 html+=resultFilterControls('approved',rows.length,allRows.length);
 const selectedCount=approvedSelectionIds().length,dirty=Object.keys(state.approvedStatusDrafts).length;
 html+='<div class="space section section-head" style="position:sticky;top:0;z-index:5;background:var(--bg,#fff);padding:12px 0"><div class="stack"><label><input type="checkbox" id="approvedSelectAll"> Select all visible</label><span class="hint" id="approvedSelectedCount">'+selectedCount+' selected</span><span class="hint" id="approvedChangeCount">'+(dirty?dirty+' unsaved change'+(dirty===1?'':'s'):COPY.emptyChanges)+'</span></div><div class="stack"><button class="btn outline small" id="approvedResumeBatch" data-action="approved-resume-batch" '+(selectedCount?'':'disabled')+'>Download documents</button><button class="btn" id="approvedSaveStatus" data-action="approved-save-status" '+(dirty?'':'disabled')+'>'+COPY.save+'</button><button class="btn outline small" id="approvedMarkSubmitted" data-action="approved-mark-submitted" '+(selectedCount?'':'disabled')+'>'+COPY.recordSubmission+'</button></div></div>';
 if(!rows.length)return html+'<section class="card empty"><strong>No approved jobs</strong>Approve a job from To be reviewed to prepare its documents.<div class="section"><button class="btn outline small" data-action="navigate" data-page="queue-new">Go to To be reviewed</button></div></section>';
 html+='<section class="card"><div class="table-wrap"><table><thead><tr><th style="width:42px"></th><th>Job</th><th>Fit</th><th>Qualification</th><th>Status</th><th>Documents</th><th>Posting</th></tr></thead><tbody>'+rows.map(j=>{
  const app=state.apps.find(a=>a.job_id===j.id&&a.status!=='closed');
  const res=app?docFor(app.id,'resume'):null,letter=app?docFor(app.id,'cover_letter'):null;
  const draft=state.approvedStatusDrafts[j.id]||'approved',qual=j.qualification_status==='Needs Verification'?'warn':j.qualification_status==='Not Qualified'?'red':'neutral';
  return '<tr><td><input type="checkbox" data-approved-select data-job="'+esc(j.id)+'" '+(state.approvedSelections[j.id]?'checked':'')+' aria-label="Select '+esc(j.job_title)+'"></td><td><strong>'+esc(j.job_title)+'</strong><small>'+esc(j.company)+(j.requisition_id?' · Req '+esc(j.requisition_id):'')+'</small><small>'+esc(j.location)+' · '+esc(j.work_arrangement||'Unknown')+' · <span class="'+(j.salary_min==null?'salary-unlisted':'')+'">'+esc(money(j.salary_min,j.currency)+(j.salary_max?' – '+money(j.salary_max,j.currency):''))+'</span></small>'+(j.concerns?'<div class="concern-note">⚠ '+esc(j.concerns)+'</div>':'')+'</td><td><strong>'+esc(j.fit_score??'—')+(j.fit_score!=null?'/100':'')+'</strong></td><td><span class="badge '+qual+'">'+esc(j.qualification_status)+'</span></td><td>'+jobStatusSelect(j,draft,'data-approved-status')+'</td><td><div class="'+(!res||!letter?'document-needs-attention':'')+'">'+(res?'Resume ready':'Resume missing')+' · '+(letter?'Cover letter ready':'Cover letter missing')+'</div>'+(app?'<button class="btn ghost small" data-action="navigate" data-page="documents" data-app="'+esc(app.id)+'">'+(!res||!letter?'Add documents':COPY.viewDocuments)+'</button>':'')+'</td><td><a class="btn outline small" target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(j.job_url))+'">'+COPY.openPosting+'</a></td></tr>';
 }).join('')+'</tbody></table></div></section>';return html;
}
function queuePage(status,title,description){
 return head(operatorEyebrow(),title,description,customerPicker())+jobResultsPanel(status);
}
function newResultsPage(){return newReviewTriagePage();}
function submittedResultsPage(){return queuePage('applied','Submitted','Applications with recorded employer submission confirmations.');}
function skippedResultsPage(){return queuePage('skipped','Skipped','Jobs you chose not to pursue.');}
function allResultsPage(){return queuePage('all','All results','Every job found or imported for this customer.');}
function workbenchPage(){
 const id=currentCustomer(),a=matchingApps(id).filter(x=>x.status!=='closed').sort((x,y)=>x.status==='submitted'?1:y.status==='submitted'?-1:0);
 let html=head('Step 2 · Staff operations','Approved applications','Prepare documents and record confirmed employer submissions.',customerPicker());
 if(!id)return html+'<div class="card empty">No customer assigned.</div>';
 if(!a.length)return html+'<div class="card empty"><strong>No approved jobs yet</strong>Wait for customer review before preparing documents.</div>';
 const count=a.reduce((n,app)=>n+['resume','cover_letter'].filter(kind=>!!appliedDocFor(app.id,kind)).length,0);
 html+='<section class="card section"><div class="space"><div><strong>Batch download for this customer</strong><p class="hint">Latest resume and cover letter PDFs for each approved application, packaged by job in a ZIP. Missing documents are listed in the manifest.</p></div><button class="btn outline" data-action="download-all-documents" '+(!count?'disabled':'')+'>Download documents ('+count+')</button></div></section>';
 html+='<div class="flex-col">'+a.map(app=>{let j=byId(state.jobs,app.job_id),res=docFor(app.id,'resume'),letter=docFor(app.id,'cover_letter'),can=canPrepare(app);
 return '<article class="card"><div class="space"><div><span class="pill">'+esc(app.application_code)+'</span><h3 style="margin:9px 0 3px">'+esc(j?.job_title||'Unknown job')+'</h3><p class="muted">'+esc(j?.company||'')+' · '+esc(j?.location||'')+'</p></div>'+statusBadge(app.status)+'</div><p>'+esc(j?.fit_reason||'')+'</p><div class="detail"><div class="space"><span>Resume</span>'+(res?'<span class="badge">v'+res.version+' saved</span>':'<span class="badge warn">Missing</span>')+'</div><div class="space" style="margin-top:8px"><span>Cover letter</span>'+(letter?'<span class="badge">v'+letter.version+' saved</span>':'<span class="badge warn">Missing</span>')+'</div></div><div class="stack">'+docButtons(app)+'<a href="'+esc(safeUrl(j?.job_url))+'" class="btn outline small" target="_blank" rel="noopener noreferrer">Open posting ↗</a></div><div class="stack section">'+(app.status==='submitted'?'<span class="badge">Submitted '+fmtDate(app.submitted_at)+'</span><span class="hint">'+esc(app.submission_reference||'')+'</span>': '<button class="btn outline small" data-action="navigate" data-page="documents" data-app="'+esc(app.id)+'">View documents</button><button class="btn outline small" '+(!can?'disabled':'')+' data-action="status" data-status="ready" data-app="'+esc(app.id)+'">Mark ready</button><button class="btn outline small" '+(!can?'disabled':'')+' data-action="status" data-status="in_progress" data-app="'+esc(app.id)+'">In progress</button><button class="btn" '+(!can||!['ready','in_progress'].includes(app.status)?'disabled':'')+' data-action="submit" data-app="'+esc(app.id)+'">Record submission</button><button class="btn ghost small" data-action="status" data-status="blocked" data-app="'+esc(app.id)+'">Blocked</button>')+'</div></article>'}).join('')+'</div>';
 return html;
}
function documentsPage(){
 const id=currentCustomer(),a=matchingApps(id).filter(x=>!['submitted','closed','in_progress'].includes(x.status));
 let html=head(operatorEyebrow(),'Documents','Upload documents for approved applications.',customerPicker());
 if(!id)return html+'<div class="card empty">No customer assigned.</div>';
 html+='<div class="grid two"><section class="card"><h2>Bulk ZIP upload</h2><p class="muted">Upload a ZIP containing documents and manifest.csv.</p><div class="file-box section"><input id="batchZip" type="file" accept=".zip,application/zip"></div><p class="hint"><a href="../manifest_template.csv" target="_blank">Manifest CSV example ↗</a></p>'+(state.zipPreview?'<p class="section"><span class="badge">'+state.zipPreview.items.length+' complete application packages validated</span></p><button class="btn" data-action="commit-zip">Upload documents</button>':'')+'</section><section class="card"><h2>Individual PDF correction</h2><p class="muted">Upload a new PDF version. Submitted files stay unchanged.</p><form id="singleDocumentForm"><div class="field"><label for="singleApp">Approved application</label><select id="singleApp">'+a.map(x=>{const j=byId(state.jobs,x.job_id);return '<option value="'+esc(x.id)+'" '+(window.location.hash.endsWith(x.id)?'selected':'')+'>'+esc(x.application_code)+' · '+esc(j?.job_title||'')+'</option>'}).join('')+'</select></div><div class="field"><label for="singleKind">Document type</label><select id="singleKind"><option value="resume">Resume</option><option value="cover_letter">Cover letter</option></select></div><div class="field"><label for="singlePdf">PDF file</label><input id="singlePdf" type="file" accept=".pdf,application/pdf" required></div><button class="btn" type="submit" '+(!a.length?'disabled':'')+'>Upload PDF</button></form></section></div>';
 html+='<section class="card section"><h2>Document readiness</h2>'+(a.length?a.map(x=>{const j=byId(state.jobs,x.job_id);return '<div class="detail space"><div><strong>'+esc(x.application_code)+'</strong> · '+esc(j?.job_title||'')+'<div class="hint">'+(docFor(x.id,'resume')?'Resume ✓':'Resume missing')+' · '+(docFor(x.id,'cover_letter')?'Cover letter ✓':'Cover letter missing')+'</div></div>'+statusBadge(x.status)+'</div>'}).join(''):'<div class="empty">No applications eligible for document changes.</div>')+'</section>';
 return html;
}
function adminPage(){
 if(state.account.role!=='admin')return '<section class="card">Not authorized.</section>';
 const all=state.accounts,staff=all.filter(a=>a.role==='staff'),assignees=all.filter(a=>a.role==='staff'||a.role==='admin'),customers=all.filter(a=>a.role==='customer');
 let html=head('Super admin','Accounts & staff assignments','Manage roles and customer assignments.');
 html+='<section class="card section"><h2>Invite a customer or staff member</h2><p class="hint">Send a secure invitation. The recipient sets their own password; no password is shared with administrators.</p><form id="inviteAccountForm"><div class="grid">'+field('inviteName','Full name','','text','required maxlength="120"')+field('inviteEmail','Email address','','email','required autocomplete="off"')+'<div class="field"><label for="inviteRole">Account type</label><select id="inviteRole" class="form-control"><option value="customer">Customer</option><option value="staff">Staff</option></select></div></div><button class="btn" type="submit">Send invitation</button></form></section>';
 html+='<div class="grid"><div class="card stat"><div class="name">Customers</div><div class="value">'+customers.length+'</div></div><div class="card stat"><div class="name">Staff</div><div class="value">'+staff.length+'</div></div><div class="card stat"><div class="name">Assignments</div><div class="value">'+state.assignments.length+'</div></div></div>';
 html+='<section class="card section"><h2>Account roles</h2><div class="table-wrap"><table><thead><tr><th>Account</th><th>Current role</th><th>Change role</th></tr></thead><tbody>'+all.map(a=>'<tr><td><strong>'+esc(a.full_name||'Name not set')+'</strong><small>'+esc(a.email)+'</small></td><td>'+statusBadge(a.role)+'</td><td><div class="stack"><select id="role-'+esc(a.id)+'" class="form-control" style="max-width:145px" '+(a.id===state.account.id?'disabled':'')+'>'+['customer','staff','admin'].map(r=>'<option value="'+r+'" '+(a.role===r?'selected':'')+'>'+r+'</option>').join('')+'</select><button class="btn small" data-action="set-role" data-user="'+esc(a.id)+'" '+(a.id===state.account.id?'disabled':'')+'>Change role</button></div></td></tr>').join('')+'</tbody></table></div></section>';
 html+='<section class="card section"><h2>Assign staff to customers</h2><div class="table-wrap"><table><thead><tr><th>Customer</th>'+assignees.map(s=>'<th>'+esc(s.full_name||s.email)+(s.role==='admin'?' (Admin)':'')+'</th>').join('')+'</tr></thead><tbody>'+customers.map(c=>'<tr><td><strong>'+esc(c.full_name||c.email)+'</strong></td>'+assignees.map(s=>'<td><label><input type="checkbox" data-change="assign" data-customer="'+esc(c.id)+'" data-staff="'+esc(s.id)+'" '+(state.assignments.some(x=>x.staff_id===s.id&&x.customer_id===c.id)?'checked':'')+'> Assigned</label></td>').join('')+'</tr>').join('')+'</tbody></table></div>'+(assignees.length===0?'<p class="hint">Create a staff account or use an administrator account to assign customers.</p>':'')+'</section>';
 return html;
}
function render(){
 if(!state.account)return renderAuth();
 buildNav();
 const r=state.account.role==='admin'&&state.workspaceView==='staff'?'staff':state.account.role;
 if(r==='customer'){
  const allowed=isDiyCustomer()?['overview','import','customer-profile','profile-analysis','queue-new','queue-approved','queue-submitted','queue-skipped','queue-all','documents','profile']:['overview','matches','applications','customer-profile','profile-analysis','profile'];
  if(!allowed.includes(state.page))state.page='overview';
 }
 if(r!=='customer'&&!['overview','import','customer-profile','profile-analysis','queue-new','queue-approved','queue-submitted','queue-skipped','queue-all','workbench','documents','profile',...(r==='admin'?['admin']:[])].includes(state.page))state.page='overview';
 $('#mainNav').querySelectorAll('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page));
 const pageMap={overview:dashboard,matches:matchesPage,applications:applicationsPage,'customer-profile':customerProfileViewPage,'profile-analysis':profileAnalysisPage,profile:profilePage,import:importPage,'queue-new':newResultsPage,'queue-approved':approvedResultsPage,'queue-submitted':submittedResultsPage,'queue-skipped':skippedResultsPage,'queue-all':allResultsPage,workbench:workbenchPage,documents:documentsPage,admin:adminPage};
 $('#page').innerHTML=pageMap[state.page]();
}
async function loadData(knownUser=null){
 const sb=state.sb;
 const within=(operation,label,ms=12000)=>Promise.race([Promise.resolve(operation),new Promise((_,reject)=>setTimeout(()=>reject(new Error(label+' did not respond within '+Math.round(ms/1000)+' seconds.')),ms))]);
 if(knownUser){state.me=knownUser;}
 else {
  let session;
  try { session=await within(sb.auth.getSession(),'Authentication session',10000); }
  catch(e) {
   state.me=null;state.account=null;renderAuth();
   notice('Saved login unavailable. Sign in to continue. Details: '+errorMsg(e),true);
   return false;
  }
  if(session.error||!session.data.session?.user){state.me=null;state.account=null;state.loginToken=null;renderAuth();return false;}
  state.me=session.data.session.user;
  state.loginToken=session.data.session.access_token||null;
 }
 const token=state.loginToken;
 if(!token)throw Error('Missing login token. Please sign in again.');
 const endpoint=config.supabaseUrl+'/rest/v1/accounts?select=*&id=eq.'+encodeURIComponent(state.me.id);
 const response=await within(fetch(endpoint,{headers:{apikey:config.supabasePublishableKey,Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(12000)}),'Account lookup HTTP',12000);
 if(!response.ok)throw Error('Account lookup HTTP '+response.status+': '+(await response.text()).slice(0,250));
 const records=await response.json();
 const account=records[0];
 if(!account)throw Error('No account record returned.');
 state.account=account;
 const keys=['accounts','customer_profiles','staff_assignments','jobs','applications','document_versions','submitted_documents','search_runs','reference_resumes','document_authorizations','candidate_evidence_versions','search_strategy_versions','general_resume_versions'];
 const tables=await Promise.all(keys.map(async table=>{
   const url=config.supabaseUrl+'/rest/v1/'+table+'?select=*&limit='+(table==='jobs'?1000:500);
   const response=await within(fetch(url,{headers:{apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.loginToken,Accept:'application/json'},signal:AbortSignal.timeout(12000)}),'Loading '+table,12000);
   if(!response.ok)throw Error('Loading '+table+' HTTP '+response.status+': '+(await response.text()).slice(0,250));
   return await response.json();
 }));
 [state.accounts,state.profiles,state.assignments,state.jobs,state.apps,state.docs,state.submitted,state.runs,state.referenceResumes,state.documentAuthorizations,state.candidateEvidence,state.searchStrategies,state.generalResumes]=tables;
 state.jobs.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 state.apps.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 state.runs.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 const cs=state.accounts.filter(a=>a.role==='customer');
 if(account.role==='customer')state.selectedCustomer=account.id;
 else if(!cs.some(x=>x.id===state.selectedCustomer))state.selectedCustomer=cs[0]?.id||null;
 render();
 return true;
}
const refresh=async()=>{try{await loadData();}catch(e){notice(errorMsg(e),true)}};
function errorMsg(e){return e?.message || String(e || 'Unknown error')}
function openDialog(title,body,wide=false){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=body;$('#dialog .modal')?.classList.toggle('wide',wide);$('#dialog').classList.remove('hidden')}
function closeDialog(){stopVoiceInput();$('#dialog').classList.add('hidden');$('#dialog .modal')?.classList.remove('wide');$('#dialogBody').replaceChildren()}
function speechRecognitionClass(){return window.SpeechRecognition||window.webkitSpeechRecognition||null}
function setVoiceButtons(listening){
 document.querySelectorAll('[data-action="start-expanded-voice"],[data-action="stop-expanded-voice"]').forEach(b=>{
  if(b.dataset.action==='start-expanded-voice')b.disabled=listening;
  if(b.dataset.action==='stop-expanded-voice')b.disabled=!listening;
 });
}
function stopVoiceInput(){
 if(activeSpeechRecognition){try{activeSpeechRecognition.stop()}catch{}}
 activeSpeechRecognition=null;
 activeSpeechTarget=null;
 activeSpeechBase='';
 activeSpeechFinal='';
 setVoiceButtons(false);
}
function startVoiceInput(target){
 const Recognition=speechRecognitionClass();
 if(!Recognition)throw Error('Voice transcription is not supported in this browser. Use Chrome, Edge, or another browser with speech recognition enabled.');
 stopVoiceInput();
 const recognition=new Recognition();
 recognition.lang=navigator.language||'en-CA';
 recognition.continuous=true;
 recognition.interimResults=true;
 activeSpeechRecognition=recognition;
 activeSpeechTarget=target;
 activeSpeechBase=target.value.trimEnd();
 activeSpeechFinal='';
 recognition.onstart=()=>setVoiceButtons(true);
 recognition.onresult=(event)=>{
  let interim='';
  for(let i=event.resultIndex;i<event.results.length;i++){
   const spoken=event.results[i][0]?.transcript||'';
   if(event.results[i].isFinal)activeSpeechFinal+=(activeSpeechFinal?' ':'')+spoken.trim();
   else interim+=(interim?' ':'')+spoken.trim();
  }
  const transcript=[activeSpeechFinal,interim].filter(Boolean).join(' ');
  target.value=activeSpeechBase+(activeSpeechBase&&transcript?' ':'')+transcript;
 };
 recognition.onerror=(event)=>{
  if(event.error!=='aborted'&&event.error!=='no-speech')notice('Voice transcription: '+event.error,true);
 };
 recognition.onend=()=>{activeSpeechRecognition=null;setVoiceButtons(false)};
 recognition.start();
}
function openExpandedEditor(fieldId,startVoice=false){
 const source=document.getElementById(fieldId);
 if(!source)throw Error('Field unavailable.');
 const label=source.closest('.field')?.querySelector('label')?.textContent||'Edit text';
 const supported=!!speechRecognitionClass();
 openDialog(label,'<textarea id="expandedFieldEditor" class="expanded-field-editor">'+esc(source.value)+'</textarea><div class="expanded-editor-footer"><div><span class="hint">Use the larger editor for longer profile and search instructions.</span><br><span class="hint">'+(supported?'Voice transcription uses your browser speech-recognition service and may process audio through the browser provider.':'Voice transcription is not supported by this browser.')+'</span></div><div class="stack">'+(supported?'<button class="field-tool-icon large" type="button" data-action="start-expanded-voice" aria-label="Start voice input" title="Start voice input">🎤</button><button class="field-tool-icon large" type="button" data-action="stop-expanded-voice" aria-label="Stop voice input" title="Stop voice input" disabled>⏹</button>':'')+'<button class="btn" type="button" data-action="save-expanded-field" data-field="'+esc(fieldId)+'">Use text</button><button class="btn ghost" type="button" data-action="close-dialog">Cancel</button></div></div>',true);
 const editor=$('#expandedFieldEditor');
 editor.focus();
 editor.setSelectionRange(editor.value.length,editor.value.length);
 if(startVoice&&supported)startVoiceInput(editor);
}
function profileFormValues(){
 const score=Number($('#min_fit_score').value);
 if(!Number.isInteger(score)||score<0||score>100)throw Error('Fit score must be between 0 and 100');
 const linked=$('#linkedin_url').value.trim();
 if(linked&&!/^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%.-]+\/?(?:\?.*)?$/.test(linked))throw Error('Enter a valid public LinkedIn profile URL (linkedin.com/in/...).');
 const selected=[...document.querySelectorAll('input[name="career_objective"]:checked')].map(x=>'• '+x.value);
 const goals=[...selected,$('#career_goals_detail').value.trim()].filter(Boolean).join('\n');
 const target=$('#salary_target').value.trim();
 return {
  target_roles:$('#target_roles').value,
  career_goals:goals,
  preferred_locations:$('#preferred_locations').value,
  salary_min:$('#salary_min').value||null,
  work_preference:$('#work_preference').value,
  exclusions:$('#exclusions').value,
  search_instructions:$('#search_instructions').value,
  linkedin_url:linked,
  salary_target:target||null,
  service_tier:$('#service_tier').value,
  salary_currency:$('#salary_currency').value,
  transferable_roles:$('#transferable_roles').value,
  employment_types:[...document.querySelectorAll('input[name="employment_type"]:checked')].map(x=>x.value).join('; '),
  industries:$('#industries').value,
  relocation_preferences:$('#relocation_preferences').value,
  pension_preferences:$('#pension_preferences').value,
  min_fit_score:score,
  updated_at:new Date().toISOString()
 };
}
async function showAiPromptPreview(customer){
 const response=await fetch(config.supabaseUrl+'/functions/v1/run-job-search',{
  method:'POST',
  headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.loginToken},
  body:JSON.stringify({customer_id:customer,preview_only:true}),
  signal:AbortSignal.timeout(30000)
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)throw Error(result.error||'Could not load AI prompt preview.');
 state.aiPromptPreview=result.full_prompt||'';
 openDialog('Full AI Search Prompt','<div class="prompt-meta"><span class="badge neutral">Model: '+esc(result.model||'configured model')+'</span><span class="badge neutral">'+esc(result.suppress_count||0)+' previously seen jobs suppressed</span></div><p class="hint">This is the saved prompt MatchPath will use for the selected customer.</p><pre class="prompt-preview">'+esc(state.aiPromptPreview)+'</pre><div class="stack"><button class="btn outline small" data-action="copy-ai-prompt">Copy prompt</button><button class="btn ghost small" data-action="close-dialog">Close</button></div>',true);
 return result;
}
async function callProfileAnalysis(action,extra={}){
 const customer=currentCustomer();if(!customer)throw Error('Choose a customer first.');
 const response=await fetch(config.supabaseUrl+'/functions/v1/analyze-profile',{
  method:'POST',
  headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.loginToken},
  body:JSON.stringify({customer_id:customer,action,...extra}),
  signal:AbortSignal.timeout(120000)
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)throw Error(result.error||'Profile Analysis failed (HTTP '+response.status+').');
 return result;
}

async function generateGeneralResumeLibrary(){
 const customer=currentCustomer();if(!customer)throw Error('Choose a customer first.');
 const response=await fetch(config.supabaseUrl+'/functions/v1/generate-general-resumes',{
  method:'POST',
  headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.loginToken},
  body:JSON.stringify({customer_id:customer}),
  signal:AbortSignal.timeout(180000)
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)throw Error(result.error||'General Resume generation failed (HTTP '+response.status+').');
 return result;
}

async function downloadGeneralResumeFile(resumeId,format){
 const row=state.generalResumes.find(x=>x.id===resumeId&&x.customer_id===currentCustomer());
 if(!row)throw Error('General resume unavailable.');
 const response=await fetch(config.supabaseUrl+'/functions/v1/export-general-resume',{
  method:'POST',
  headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.loginToken},
  body:JSON.stringify({resume_id:resumeId,format}),
  signal:AbortSignal.timeout(120000)
 });
 if(!response.ok){
  const err=await response.json().catch(()=>({}));
  throw Error(err.error||'Resume download failed (HTTP '+response.status+').');
 }
 const blob=await response.blob();
 const cd=response.headers.get('content-disposition')||'';
 const match=cd.match(/filename="([^"]+)"/i);
 const fallback=((row.resume_json?.candidate_name||customerName(row.customer_id))+' - '+row.category_name+' - v'+row.version+'.'+format)
   .replace(/[^A-Za-z0-9._ -]+/g,'').replace(/\s+/g,' ').trim();
 const filename=match?.[1]||fallback;
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
 return filename;
}
async function uploadReferenceResumes(customer,files){
 const list=[...(files||[])];
 if(!customer)throw Error('Customer unavailable.');
 const existingCount=state.referenceResumes.filter(r=>r.customer_id===customer).length;
 if(!list.length)return 0;
 if(existingCount+list.length>5)throw Error('A customer can have at most 5 original/reference resumes. You can upload '+Math.max(0,5-existingCount)+' more.');
 let uploaded=0;
 for(const file of list){
  const validated=await validateResumeFile(file);
  const path=customer+'/reference-resumes/'+crypto.randomUUID()+'.'+validated.extension;
  const {error:e}=await state.sb.storage.from('matchpath-profiles').upload(path,file,{contentType:validated.contentType,upsert:false});
  if(e)throw Error('Resume upload '+(uploaded+1)+' failed: '+errorMsg(e));
  const {error:metadataError}=await state.sb.rpc('register_reference_resume',{p_customer:customer,p_storage_path:path,p_original_filename:file.name.slice(0,240),p_size_bytes:file.size});
  if(metadataError){
   await state.sb.storage.from('matchpath-profiles').remove([path]).catch(()=>{});
   throw Error('Resume upload could not be registered: '+errorMsg(metadataError));
  }
  uploaded++;
 }
 return uploaded;
}
async function signedPdf(path,bucket){const {data,error}=await state.sb.storage.from(bucket).createSignedUrl(path,120);if(error)throw error;window.open(data.signedUrl,'_blank','noopener,noreferrer')}
async function downloadAllCustomerDocuments(){
 const customerId=currentCustomer();if(!customerId)throw Error('Select a customer first.');
 const applications=matchingApps(customerId).filter(a=>a.status!=='closed');
 const {default:JSZip}=await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
 const zip=new JSZip();const rows=['application_code,job_title,company,document_type,status'];
 let downloaded=0;const missing=[];
 for(const app of applications){
  const job=byId(state.jobs,app.job_id)||{};
  const folder=String(app.application_code||app.id).replace(/[^a-zA-Z0-9_-]/g,'_');
  for(const kind of ['resume','cover_letter']){
   const doc=appliedDocFor(app.id,kind);
   if(!doc){missing.push(folder+'/'+kind);rows.push([app.application_code,job.job_title,job.company,kind,'missing'].map(csvCell).join(','));continue;}
   const url=config.supabaseUrl+'/storage/v1/object/authenticated/matchpath-documents/'+doc.storage_path.split('/').map(encodeURIComponent).join('/');
   const response=await fetch(url,{headers:{apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.loginToken},signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Could not download '+folder+'/'+kind+' (HTTP '+response.status+'). No partial ZIP was saved.');
   const pdf=await response.blob();
   if(pdf.size<4||pdf.size>20*1024*1024||!(await pdf.slice(0,4).text()).startsWith('%PDF'))throw Error('Invalid PDF for '+folder+'/'+kind);
   zip.file(folder+'/'+kind+'_v'+doc.version+'.pdf',pdf);downloaded++;
   rows.push([app.application_code,job.job_title,job.company,kind,'included'].map(csvCell).join(','));
  }
 }
 if(!downloaded)throw Error('No PDF documents are available for this customer.');
 zip.file('manifest.csv',rows.join('\\r\\n'));
 const archive=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});
 const link=document.createElement('a'),objectUrl=URL.createObjectURL(archive);
 link.href=objectUrl;link.download='MatchPath_'+customerId.slice(0,8)+'_approved_documents.zip';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
 notice('ZIP prepared: '+downloaded+' PDFs from '+applications.length+' approved applications.'+(missing.length?' '+missing.length+' missing documents are listed in manifest.csv.':''));
}
async function downloadSelectedResumes(jobIds){
 const selected=jobIds.map(id=>byId(state.jobs,id)).filter(Boolean);
 if(!selected.length){openDialog('No jobs selected','<p>Select at least one approved job first.</p>');return;}
 const {default:JSZip}=await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
 const zip=new JSZip(),manifest=['job_title,company,document_type,status'];
 let ready=0,missing=0;
 for(const job of selected){
  const app=state.apps.find(a=>a.job_id===job.id&&a.status!=='closed');
  const safeName=(job.company+'_'+job.job_title).replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,120);
  for(const kind of ['resume','cover_letter']){
   const doc=app?docFor(app.id,kind):null;
   if(!app||!doc){
    missing++;
    manifest.push([job.job_title,job.company,kind,'missing'].map(csvCell).join(','));
    continue;
   }
   const url=config.supabaseUrl+'/storage/v1/object/authenticated/matchpath-documents/'+doc.storage_path.split('/').map(encodeURIComponent).join('/');
   const response=await fetch(url,{headers:{apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.loginToken},signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Could not download '+kind.replace('_',' ')+' for '+job.job_title+' (HTTP '+response.status+').');
   const pdf=await response.blob();
   if(pdf.size<4||!(await pdf.slice(0,4).text()).startsWith('%PDF'))throw Error('Invalid PDF for '+job.job_title+' '+kind.replace('_',' '));
   zip.file(safeName+'_'+kind+'_v'+doc.version+'.pdf',pdf);
   ready++;
   manifest.push([job.job_title,job.company,kind,'included'].map(csvCell).join(','));
  }
 }
 if(!ready){
  openDialog('No files available','<p>No AI resume or cover-letter files are available yet for the selected job'+(selected.length===1?'':'s')+'.</p>');
  return;
 }
 zip.file('manifest.csv',manifest.join('\r\n'));
 const archive=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});
 const link=document.createElement('a'),objectUrl=URL.createObjectURL(archive);
 link.href=objectUrl;
 link.download='MatchPath_selected_AI_documents.zip';
 document.body.appendChild(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
 notice('Downloaded '+ready+' AI document'+(ready===1?'':'s')+'.'+(missing?' '+missing+' selected file'+(missing===1?' is':'s are')+' not available yet.':''));
}

const csvCell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
async function handleClick(target){
 const action=target.dataset.action;
 if(action==='choose-reference-resumes'){
  if(state.account?.role!=='admin')throw Error('Administrator access required to upload customer resumes.');
  const input=$('#reviewReferenceFiles');if(!input)throw Error('Resume upload control unavailable.');
  input.click();return;
 }
 if(action==='reference-download'){const item=state.referenceResumes.find(x=>x.storage_path===target.dataset.path&&x.customer_id===currentCustomer());if(!item)throw Error('Resume unavailable for this customer');await signedPdf(item.storage_path,'matchpath-profiles');return}
 if(action==='close-dialog'){closeDialog();return}
 if(action==='show-login'){renderAuth('login');return}
 if(action==='show-signup'){renderAuth('signup');return}
 if(action==='navigate'){if(state.page!==target.dataset.page&&!confirmDiscardChanges())return;if(state.page!==target.dataset.page)clearStatusDrafts();state.page=target.dataset.page;if(state.page==='profile')state.profileEditSection=null;if(target.dataset.app)window.location.hash=target.dataset.app;state.csvPreview=null;state.zipPreview=null;render();return}
 if(action==='expand-field'){openExpandedEditor(target.dataset.field,false);return}
 if(action==='voice-field'){openExpandedEditor(target.dataset.field,true);return}
 if(action==='start-expanded-voice'){
  const editor=$('#expandedFieldEditor');if(!editor)throw Error('Editor unavailable.');
  startVoiceInput(editor);return;
 }
 if(action==='stop-expanded-voice'){stopVoiceInput();return}
 if(action==='save-expanded-field'){
  const source=document.getElementById(target.dataset.field),editor=$('#expandedFieldEditor');
  if(!source||!editor)throw Error('Editor field unavailable.');
  stopVoiceInput();source.value=editor.value;source.dispatchEvent(new Event('input',{bubbles:true}));closeDialog();return;
 }
 if(action==='edit-profile-section'){
   if(state.profileDirty&&!confirmDiscardChanges())return;
   state.profileDirty=false;
  const role=state.account?.role;
  const customer=currentCustomer();
  const authorized=role==='customer'?customer===state.me.id:(role==='admin'||role==='staff');
  if(!authorized)throw Error('You are not authorized to edit this customer profile.');
  state.profileEditSection=target.dataset.section||null;
  state.page='profile';
  render();
  const sectionId='profile-section-'+state.profileEditSection;
  setTimeout(()=>document.getElementById(sectionId)?.scrollIntoView({behavior:'smooth',block:'start'}),0);
  return;
 }
 if(action==='run-resume-analysis'){
  const original=target.textContent;target.disabled=true;target.textContent='Analyzing resumes…';
  try{
   const result=await callProfileAnalysis('analyze_resumes');
   await loadData(state.me);
   state.page='profile-analysis';render();
   notice('Resume Analysis complete. Candidate Evidence v'+(result.evidence?.version||'new')+' created.');
  }finally{
   if(target.isConnected){target.disabled=false;target.textContent=original}
  }
  return;
 }
 if(action==='build-search-strategy'){
  const original=target.textContent;target.disabled=true;target.textContent='Building strategy…';
  try{
   const result=await callProfileAnalysis('build_strategy');
   await loadData(state.me);
   state.page='profile-analysis';render();
   notice('AI Search Strategy v'+(result.strategy?.version||'new')+' created as a draft. Review and activate it when ready.');
  }finally{
   if(target.isConnected){target.disabled=false;target.textContent=original}
  }
  return;
 }
 if(action==='activate-search-strategy'){
  const id=target.dataset.strategy;if(!id)throw Error('Search Strategy unavailable.');
  if(!confirm('Activate this strategy as the live AI Search Prompt for future job searches?'))return;
  target.disabled=true;target.textContent='Activating…';
  await callProfileAnalysis('activate_strategy',{strategy_id:id});
  await loadData(state.me);
  state.page='profile-analysis';render();
  notice('AI Search Strategy activated. Future job searches will use this strategy.');
  return;
 }
 if(action==='view-strategy-prompt'){
  const strategy=state.searchStrategies.find(x=>x.id===target.dataset.strategy&&x.customer_id===currentCustomer());
  if(!strategy)throw Error('Search Strategy unavailable.');
  openDialog('AI Search Strategy v'+strategy.version,'<div class="prompt-meta"><span class="badge neutral">'+esc(strategy.status)+'</span><span class="badge neutral">'+esc(strategy.model||'configured model')+'</span></div><p class="hint">This prompt becomes the live AI Search Prompt after activation.</p><pre class="prompt-preview">'+esc(strategy.prompt_text||'')+'</pre><div class="stack"><button class="btn ghost small" type="button" data-action="close-dialog">Close</button></div>',true);
  return;
 }
 if(action==='generate-general-resumes'){
  const original=target.textContent;target.disabled=true;target.textContent='Generating resumes…';
  try{
   const result=await generateGeneralResumeLibrary();
   await loadData(state.me);
   state.page='profile-analysis';render();
   notice('General Resume Library created with '+(result.count||0)+' categor'+((result.count||0)===1?'y':'ies')+'.');
  }finally{
   if(target.isConnected){target.disabled=false;target.textContent=original}
  }
  return;
 }
 if(action==='view-general-resume'){
  const row=state.generalResumes.find(x=>x.id===target.dataset.resume&&x.customer_id===currentCustomer());
  if(!row)throw Error('General resume unavailable.');
  openDialog(row.category_name+' · General Resume v'+row.version,'<div class="prompt-meta"><span class="badge neutral">'+esc(row.status)+'</span><span class="badge neutral">'+esc(row.model||'configured model')+'</span></div><p class="hint">'+esc(row.focus_summary||'Reusable baseline resume')+'</p>'+generalResumePreviewHtml(row)+'<div class="stack section"><button class="btn small" type="button" data-action="download-general-resume" data-format="docx" data-resume="'+esc(row.id)+'">Download DOCX</button><button class="btn small" type="button" data-action="download-general-resume" data-format="pdf" data-resume="'+esc(row.id)+'">Download PDF</button><button class="btn outline small" type="button" data-action="copy-general-resume" data-resume="'+esc(row.id)+'">Copy resume text</button><button class="btn ghost small" type="button" data-action="close-dialog">Close</button></div>',true);
  return;
 }
 if(action==='copy-general-resume'){
  const row=state.generalResumes.find(x=>x.id===target.dataset.resume&&x.customer_id===currentCustomer());
  if(!row)throw Error('General resume unavailable.');
  const text=generalResumeText(row);if(!text)throw Error('Resume text is empty.');
  await navigator.clipboard.writeText(text);
  notice(row.category_name+' resume copied to clipboard.');
  return;
 }
 if(action==='download-general-resume'){
  const resumeId=target.dataset.resume,format=target.dataset.format;
  if(!resumeId||!['docx','pdf'].includes(format))throw Error('Download format unavailable.');
  const original=target.textContent;target.disabled=true;target.textContent='Preparing '+format.toUpperCase()+'…';
  try{
   const filename=await downloadGeneralResumeFile(resumeId,format);
   notice(filename+' downloaded.');
  }finally{
   if(target.isConnected){target.disabled=false;target.textContent=original}
  }
  return;
 }
 if(action==='decision'){
  if(!confirm('Record this job as '+target.dataset.decision+'?'))return;
  const {error}=await state.sb.rpc('customer_decide_job',{p_job:target.dataset.job,p_decision:target.dataset.decision});
  if(error)throw error;await loadData();notice('Your decision has been recorded.');return;
 }
 if(action==='save-review-decisions'){
  if(!canOperateUi())throw Error('This workspace is not authorized to change job status.');
  const updates=Object.entries(state.reviewDrafts||{}).filter(([,status])=>status==='approved'||status==='skipped').map(([job_id,status])=>({job_id,status}));
  if(!updates.length){notice('No review decisions to save.');return;}
  if(!confirm('Save '+updates.length+' review decision'+(updates.length===1?'':'s')+'? Approved jobs will move to Approved; skipped jobs will move to Skipped.'))return;
  const {data,error}=await state.sb.rpc('operator_apply_job_review_decisions',{p_updates:updates});
  if(error)throw error;
  state.reviewDrafts={};
  await loadData(state.me);
  state.page='queue-new';
  render();
  notice((data?.updated||updates.length)+' review decision'+((data?.updated||updates.length)===1?'':'s')+' saved. Unchanged jobs remain To be reviewed.');
  return;
 }
 if(action==='save-result-statuses'){
  if(!canOperateUi())throw Error('Not authorized to change job statuses.');
  const updates=Object.entries(state.resultStatusDrafts).map(([job_id,status])=>({job_id,status}));
  if(!updates.length){notice(COPY.emptyChanges);return;}
  if(updates.length>100)throw Error('Save up to 100 status changes at a time.');
  const {data,error}=await state.sb.rpc('operator_bulk_set_job_statuses',{p_updates:updates});
  if(error)throw error;
  state.resultStatusDrafts={};await loadData(state.me);
  notice((data?.updated||updates.length)+' job status change'+(updates.length===1?'':'s')+' saved.');return;
 }
 if(action==='approved-resume-batch'){
  if(!canOperateUi())throw Error('Not authorized.');
  await downloadSelectedResumes(approvedSelectionIds());return;
 }
 if(action==='approved-save-status'){
  if(!canOperateUi())throw Error('Not authorized.');
  const updates=Object.entries(state.approvedStatusDrafts).map(([job_id,status])=>({job_id,status}));
  if(!updates.length){notice('No unsaved changes.');return;}
  const {data,error}=await state.sb.rpc('operator_bulk_set_job_statuses',{p_updates:updates});
  if(error)throw error;
  state.approvedSelections={};state.approvedStatusDrafts={};
  await loadData(state.me);state.page='queue-approved';render();
  notice((data?.updated||updates.length)+' job status'+((data?.updated||updates.length)===1?'':'es')+' updated.');return;
 }
 if(action==='revoke-document-consent'){
  if(state.account?.role!=='customer'||currentCustomer()!==state.me.id)throw Error('Only customers may revoke their own consent.');
  if(!confirm('Withdraw permission for future AI application document preparation and use? Existing submissions remain recorded.'))return;
  const {error}=await state.sb.rpc('customer_set_document_authorization',{p_accept:false,p_allow_staff_submit:false});
  if(error)throw error;
  await loadData(state.me);notice('Document authorization withdrawn.');return;
 }
 if(action==='approved-mark-submitted'){
  if(draftCount()>0)throw Error('Save or discard your status changes before recording submissions.');
  if(!canRecordSubmission())throw Error('Standing customer document authorization for this submission mode is required.');
  if(!canOperateUi())throw Error('Not authorized.');
  const ids=approvedSelectionIds();if(!ids.length)throw Error('Select at least one job.');
  const rows=ids.map(id=>{const job=byId(state.jobs,id);const app=state.apps.find(a=>a.job_id===id&&a.status!=='closed');return {job,app}}).filter(x=>x.job&&x.app);
  if(rows.length!==ids.length)throw Error('Every selected job must have an active application.');
  const missing=rows.filter(x=>!canPrepare(x.app));
  if(missing.length)throw Error(missing.length+' selected application'+(missing.length===1?' is':'s are')+' missing a resume or cover letter.');
  state.bulkSubmitApps=rows.map(x=>x.app.id);
  openDialog('Confirm selected submissions','<p class="warning">Only confirm jobs that were genuinely submitted to the employer. Enter a confirmation/reference for each application.</p><form id="bulkSubmitForm">'+rows.map(x=>'<div class="field"><label for="bulk-ref-'+esc(x.app.id)+'">'+esc(x.job.job_title)+' · '+esc(x.job.company)+'</label><input id="bulk-ref-'+esc(x.app.id)+'" type="text" minlength="3" required placeholder="Employer confirmation / reference"></div>').join('')+area('bulkSubmissionNotes','Shared submission note (optional)')+'<button class="btn" type="submit">Confirm '+rows.length+' submission'+(rows.length===1?'':'s')+'</button></form>');
  return;
 }
 if(action==='view-ai-prompt'){
  if(!canOperateUi())throw Error('This workspace is not authorized to view the AI search prompt.');
  const customer=currentCustomer();if(!customer)throw Error('Choose a customer first.');
  const originalLabel=target.textContent;
  target.textContent='Loading prompt…';
  try{
   await showAiPromptPreview(customer);
  }finally{
   if(target.isConnected)target.textContent=originalLabel;
  }
  return;
 }
 if(action==='update-ai-prompt'){
  const customer=currentCustomer();if(!customer)throw Error('Choose a customer first.');
  const profile=currentProfile();if(!profile)throw Error('Customer profile unavailable.');
  if(!aiPromptNeedsUpdate(profile)){notice('AI search prompt is already up to date with the current profile.');return;}
  target.textContent='Generating AI proposal…';
  const response=await fetch(config.supabaseUrl+'/functions/v1/run-job-search',{
   method:'POST',
   headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.loginToken},
   body:JSON.stringify({customer_id:customer,improve_prompt:true}),
   signal:AbortSignal.timeout(90000)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.ok)throw Error(result.error||'Could not generate AI search prompt update.');
  if(result.prompt_up_to_date){
   await loadData(state.me);state.page='profile';render();notice('AI search prompt is already up to date.');return;
  }
  state.aiPromptProposal={
   customer,
   prompt:result.proposed_prompt||'',
   current:result.current_prompt||'',
   summary:result.change_summary||'',
   profileUpdatedAt:result.profile_updated_at,
   model:result.model||''
  };
  openDialog('AI Search Prompt Update','<div class="prompt-meta"><span class="badge neutral">AI proposal</span>'+(result.model?'<span class="badge neutral">'+esc(result.model)+'</span>':'')+'<span class="badge neutral">'+esc(result.resumes_used||0)+' resume'+((result.resumes_used||0)===1?'':'s')+' used</span></div><p><strong>What AI changed</strong></p><p class="muted">'+esc(result.change_summary||'AI rebuilt the search strategy from the updated customer profile.')+'</p>'+(result.current_prompt?'<details class="prompt-current"><summary>View current AI search prompt</summary><pre class="prompt-preview compact">'+esc(result.current_prompt)+'</pre></details>':'<p class="hint">This will create the first AI-generated search strategy for this profile.</p>')+'<div class="field"><label for="aiPromptProposalText">Proposed AI search prompt</label><textarea id="aiPromptProposalText" class="expanded-field-editor">'+esc(result.proposed_prompt||'')+'</textarea></div><div class="stack"><button class="btn" type="button" data-action="apply-ai-prompt">Apply AI Update</button><button class="btn ghost" type="button" data-action="close-dialog">Cancel</button></div>',true);
  return;
 }
 if(action==='apply-ai-prompt'){
  const proposal=state.aiPromptProposal;
  if(!proposal)throw Error('No AI prompt proposal is loaded.');
  const prompt=$('#aiPromptProposalText')?.value.trim()||'';
  if(prompt.length<40)throw Error('AI search prompt is too short.');
  target.textContent='Applying…';
  const {error}=await state.sb.rpc('save_ai_search_prompt',{p_customer:proposal.customer,p_prompt:prompt,p_profile_updated_at:proposal.profileUpdatedAt});
  if(error)throw error;
  state.aiPromptProposal=null;
  closeDialog();
  await loadData(state.me);
  state.page='profile';render();
  notice('AI search prompt updated for the current customer profile.');
  return;
 }
 if(action==='copy-ai-prompt'){
  if(!state.aiPromptPreview)throw Error('No prompt is loaded.');
  await navigator.clipboard.writeText(state.aiPromptPreview);
  notice('AI search prompt copied.');return;
 }
 if(action==='run-ai-search'){
  if(!canOperateUi())throw Error('This workspace is not authorized to run job searches.');
  const customer=currentCustomer();if(!customer)throw Error('Choose a customer first.');
  target.textContent='Searching current openings…';
  notice('AI Job Search is checking current openings using the saved search instructions.');
  const response=await fetch(config.supabaseUrl+'/functions/v1/run-job-search',{
   method:'POST',
   headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.loginToken},
   body:JSON.stringify({customer_id:customer}),
   signal:AbortSignal.timeout(120000)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.ok)throw Error(result.error||'AI Job Search failed (HTTP '+response.status+').');
  const rows=Array.isArray(result.jobs)?result.jobs:[];
  const funnel=result.funnel&&typeof result.funnel==='object'?result.funnel:{};
  const metrics={...funnel,web_search_call_count:Number(result.web_search_call_count||0),web_sources_retrieved_count:Number(result.web_sources_retrieved_count||0),model:result.model||'',response_id:result.response_id||''};
  const {data,error}=await state.sb.rpc('import_ai_search_results_v3',{p_customer:customer,p_rows:rows,p_metrics:metrics});
  if(error)throw error;
  await loadData(state.me);
  const reviewed=Number(data?.ai_reviewed_count||funnel.reviewed_count||0);
  const qualified=Number(data?.qualified_count||funnel.qualified_count||0);
  if(!rows.length){
   state.page='overview';render();
   openDialog('No matching openings found','<p>The AI search reviewed '+reviewed+' job posting'+(reviewed===1?'':'s')+' but returned no current openings meeting the saved criteria and fit threshold.</p><p class="hint">The search funnel has been logged on Overview.</p>');
   notice('AI Job Search completed: '+reviewed+' reviewed, '+qualified+' qualified, 0 returned.');
   return;
  }
  if((data?.new_rows||0)>0){
   state.page='queue-new';render();
   notice(reviewed+' reviewed · '+qualified+' qualified · '+(data.new_rows||0)+' new job'+((data.new_rows||0)===1?'':'s')+' added to To be reviewed · '+(data.duplicate_rows||0)+' duplicate'+((data.duplicate_rows||0)===1?'':'s')+' skipped.');
  }else{
   state.page='overview';render();
   openDialog('No new openings','<p>The AI search reviewed '+reviewed+' job posting'+(reviewed===1?'':'s')+' and returned '+rows.length+' matching posting'+(rows.length===1?'':'s')+', but all returned jobs were already in MatchPath.</p><p class="hint">The full search funnel is logged on Overview.</p>');
  }
  return;
 }
 if(action==='clear-result-filters'){
  state.resultStatusFilter='all';state.resultQualificationFilter='all';state.resultSearch='';render();return;
 }
 if(action==='commit-csv'){
  if(!state.csvPreview)throw Error('No validated CSV selected');
  const customer=currentCustomer();
  if(!customer)throw Error('Choose a customer workspace before importing.');
  const {data,error}=await state.sb.rpc('import_search_results_v2',{p_customer:customer,p_rows:state.csvPreview.rows});
  if(error)throw error;
  const runId=data?.search_run_id||'assigned';
  state.csvPreview=null;await loadData(state.me);if((data?.new_rows||0)>0)state.page='queue-new';render();notice(data?.new_rows+' new jobs imported, '+data?.duplicate_rows+' duplicates skipped. Run '+runId+'.');return;
 }
 if(action==='status'){
  const {error}=await state.sb.rpc('staff_set_application_status',{p_application:target.dataset.app,p_status:target.dataset.status,p_reference:null,p_note:''});
  if(error)throw error;await loadData();notice('Application status updated.');return;
 }
 if(action==='submit'){
  if(draftCount()>0)throw Error('Save or discard your changes before recording a submission.');
  const a=byId(state.apps,target.dataset.app);if(!a)throw Error('Application not found');
  openDialog('Confirm actual job application','<p class="warning">Only mark as submitted after completing the employer application. Record a confirmation/reference or verifiable submission acknowledgment.</p><form id="submitForm" data-app="'+esc(a.id)+'">'+field('submissionReference','Employer confirmation / reference','','text','required minlength="3"')+area('submissionNotes','Submission notes (optional)')+'<button class="btn" type="submit">Confirm submission</button></form>');return;
 }
 if(action==='download-all-documents'){await downloadAllCustomerDocuments();return;}
 if(action==='download'){
  const d=state.docs.find(x=>x.id===target.dataset.doc);if(!d)throw Error('File record missing');
  await signedPdf(d.storage_path,'matchpath-documents');return;
 }
 if(action==='baseline-download'){
  const p=currentProfile();if(!p?.baseline_resume_path)throw Error('No baseline PDF uploaded');
  await signedPdf(p.baseline_resume_path,'matchpath-profiles');return;
 }
 if(action==='set-role'){
  const user=target.dataset.user;const role=$('#role-'+CSS.escape(user))?.value;
  if(!role)throw Error('Choose a role');
  if(!confirm('Change this account role to '+role+'?'))return;
  const {error}=await state.sb.rpc('admin_set_role',{p_user:user,p_role:role});
  if(error)throw error;await loadData();notice('Account role updated.');return;
 }
 if(action==='commit-zip'){await uploadZip();return}
}
async function handleSubmit(form){
 const type=form.id;

 if(type==='inviteAccountForm'){
  if(state.account?.role!=='admin')throw Error('Administrator access required.');
  const response=await fetch(config.supabaseUrl+'/functions/v1/admin-invite-account',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.loginToken},body:JSON.stringify({full_name:$('#inviteName').value.trim(),email:$('#inviteEmail').value.trim(),role:$('#inviteRole').value}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok||!result.ok)throw Error(result.error||'Invitation failed (HTTP '+response.status+')');
  await loadData(state.me);
  notice('Invitation sent to '+result.email+' as '+result.role+'.');
  return;
 }
 if(type==='acceptInviteForm'){
  if(!state.inviteToken)throw Error('Invitation session missing. Please reopen the email link.');
  const password=$('#invitePassword').value;
  const response=await fetch(config.supabaseUrl+'/auth/v1/user',{method:'PUT',headers:{apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.inviteToken,'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(15000)});
  if(!response.ok){const detail=await response.json().catch(()=>({}));throw Error(detail.msg||detail.message||detail.error_description||'Password setup failed (HTTP '+response.status+')');}
  state.inviteToken=null;
  window.history.replaceState(null,'',window.location.pathname+window.location.search);
  renderAuth('login');notice('Account activated. Sign in with your new password.');return;
 }
 if(type==='authForm'){
  if(!state.sb)throw Error('Authentication is still initializing. Please try again in a moment.');
  const email=$('#authEmail').value.trim(),password=$('#authPassword').value,name=$('#authName')?.value.trim()||'';
  let signedInUser=null;
  let signedInSession=null;
  if(form.dataset.mode==='signup'){
   const {data,error}=await state.sb.auth.signUp({email,password,options:{data:{full_name:name}}});
   if(error)throw error;
   if(!data.session){renderAuth('login');notice('Account created. Check your email to confirm your address before signing in.');return}
   signedInUser=data.user;
   signedInSession=data.session;
  }else{
   const {data,error}=await state.sb.auth.signInWithPassword({email,password});
   if(error)throw error;
   signedInUser=data.user;
   signedInSession=data.session;
  }
  if(!signedInUser)throw Error('Authentication returned no user. Please retry.');
  state.loginToken=signedInSession?.access_token||null;
  state.page='overview';
  const loaded=await loadData(signedInUser);
  if(loaded)notice('Signed in securely.');
  return;
 }
 if(type==='documentConsentForm'){
  if(state.account?.role!=='customer'||currentCustomer()!==state.me.id)throw Error('Only customers can authorize their own document use.');
  if(!$('#consentConfirm')?.checked)throw Error('Accept the disclosure to continue.');
  const {error}=await state.sb.rpc('customer_set_document_authorization',{p_accept:true,p_allow_staff_submit:!!$('#consentManaged')?.checked});
  if(error)throw error;
  await loadData(state.me);notice('Standing AI document authorization saved. Individual resume approval is not required.');return;
 }
 if(type==='profileForm'){
  const values=profileFormValues();
  if(state.account?.role==='customer')delete values.service_tier;
  const role=state.account.role;
  const operator=role!=='customer';
  const customer=currentCustomer();if(!customer)throw Error('Customer unavailable.');
  const canUploadReference=role==='admin'||role==='customer';
  const pendingFiles=canUploadReference?[...($('#referenceFiles')?.files||[])]:[];
  const changed=profileValuesChanged(values);
  if(!changed&&!pendingFiles.length){
   state.profileEditSection=null;state.profileDirty=false;render();notice('No changes to save.');return;
  }

  if(changed){
   if(operator){
    const {error}=await state.sb.rpc('operator_update_customer_profile',{p_customer:customer,p_values:values});
    if(error)throw error;
   }else{
    const {error}=await state.sb.from('customer_profiles').update(values).eq('customer_id',state.me.id).select('customer_id');
    if(error)throw error;
   }
  }

  const uploaded=await uploadReferenceResumes(customer,pendingFiles);

  state.profileEditSection=null;state.profileDirty=false;
  await loadData(state.me);
  state.page='profile';
  render();
  notice((changed?'Customer profile saved.':'')+(uploaded?' '+uploaded+' original/reference resume'+(uploaded===1?'':'s')+' uploaded privately.':''));
  return;
 }
 if(type==='bulkSubmitForm'){
  const ids=[...(state.bulkSubmitApps||[])];
  if(!ids.length)throw Error('No selected applications.');
  const note=$('#bulkSubmissionNotes')?.value||'';
  const updates=ids.map(application_id=>({application_id,reference:$('#bulk-ref-'+CSS.escape(application_id))?.value.trim()||'',note}));
  if(updates.some(x=>x.reference.length<3))throw Error('Every selected application requires a confirmation/reference.');
  const {data,error}=await state.sb.rpc('operator_bulk_mark_submitted',{p_updates:updates});
  if(error)throw error;
  state.bulkSubmitApps=[];state.approvedSelections={};state.approvedStatusDrafts={};
  closeDialog();await loadData(state.me);state.page='queue-submitted';render();
  notice((data?.submitted||updates.length)+' application'+((data?.submitted||updates.length)===1?'':'s')+' marked Submitted.');
  return;
 }
 if(type==='singleDocumentForm'){
  const app=$('#singleApp').value,kind=$('#singleKind').value,file=$('#singlePdf').files?.[0];
  if(!app||!file)throw Error('Select an application and PDF file');
  await uploadDocument(app,kind,file);await loadData();notice('Document uploaded and version recorded.');return;
 }
 if(type==='submitForm'){
  const ref=$('#submissionReference').value.trim();
  if(ref.length<3)throw Error('Submission reference is required');
  const {error}=await state.sb.rpc('staff_set_application_status',{p_application:form.dataset.app,p_status:'submitted',p_reference:ref,p_note:$('#submissionNotes').value});
  if(error)throw error;closeDialog();await loadData();
  if(form.dataset.returnPage){state.page=form.dataset.returnPage;render();}
  notice('Application marked Submitted, with exact submitted document versions preserved.');return;
 }
}
function parseCsv(text){
 const rows=[];let row=[],part='',quoted=false;const t=text.replace(/^\uFEFF/,'');
 for(let i=0;i<t.length;i++){
  const c=t[i];
  if(c==='"'){if(quoted&&t[i+1]==='"'){part+='"';i++}else if(quoted){quoted=false}else if(part===''){quoted=true}else throw Error('Malformed CSV quote at character '+i)}
  else if(c===','&&!quoted){row.push(part);part=''}
  else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&t[i+1]==='\n')i++;row.push(part);part='';if(row.some(x=>x!==''))rows.push(row);row=[]}
  else part+=c;
 }
 if(quoted)throw Error('CSV has an unclosed quoted field');
 if(part!==''||row.length){row.push(part);if(row.some(x=>x!==''))rows.push(row)}
 if(!rows.length)throw Error('CSV file is empty');
 const keys=rows.shift().map(x=>x.trim());
 if(rows.some(r=>r.length!==keys.length))throw Error('CSV contains rows with the wrong number of columns');
 return {keys,rows:rows.map(r=>Object.fromEntries(keys.map((key,i)=>[key,r[i]])))};
}
function exactColumns(actual,expected){return actual.length===expected.length&&actual.every((x,i)=>x===expected[i])}
async function validateCsvFile(file){
 if(!file||file.size>3*1024*1024)throw Error('CSV must be under 3 MB');
 const {keys,rows}=parseCsv(await file.text());
 if(!exactColumns(keys,SCHEMA))throw Error('CSV header does not match MatchPath Standard v1.0 (15 exact columns). Expected: '+SCHEMA.join(',')+' | Received: '+keys.join(','));
 if(!rows.length||rows.length>250)throw Error('CSV batch must contain 1–250 rows');
 rows.forEach((r,i)=>{
  if(!r.searched_at||!Number.isFinite(Date.parse(r.searched_at)))throw Error('Row '+(i+2)+': missing or invalid search timestamp');
  if(!r.job_title.trim()||!r.company.trim()||!safeUrl(r.job_url))throw Error('Row '+(i+2)+': missing employer/title or invalid HTTPS job URL');
  if((r.requisition_id||'').length>120)throw Error('Row '+(i+2)+': requisition ID is too long');
  if(!['Qualified','Not Qualified','Needs Verification'].includes(r.qualification_status))throw Error('Row '+(i+2)+': invalid qualification status');
  if(r.fit_score!==''&&(!/^\d+$/.test(r.fit_score)||Number(r.fit_score)>100))throw Error('Row '+(i+2)+': invalid score');
 });
 state.csvPreview={rows};render();notice('CSV passed format checks. The MatchPath backend will assign schema, customer, and run metadata when you import.');
}
async function validatePdf(file){
 if(!file||file.size<10||file.size>6*1024*1024)throw Error('PDF must be 10 bytes–6 MB');
 if(file.name&&!/\.pdf$/i.test(file.name))throw Error('Please select a PDF file.');
 const probe=new Uint8Array(await file.slice(0,Math.min(1024,file.size)).arrayBuffer());
 const signature=[0x25,0x50,0x44,0x46,0x2d];
 let found=false;
 for(let i=0;i<=probe.length-signature.length;i++){
  let match=true;
  for(let j=0;j<signature.length;j++){if(probe[i+j]!==signature[j]){match=false;break}}
  if(match){found=true;break}
 }
 if(!found)throw Error('This file does not contain a valid PDF signature. If it opens as a PDF on your computer, re-save or export it as PDF and try again.');
}
async function validateResumeFile(file){
 if(!file||file.size<10||file.size>6*1024*1024)throw Error('Resume file must be 10 bytes–6 MB.');
 const name=String(file.name||'');
 const ext=(name.match(/\.([^.]+)$/)?.[1]||'').toLowerCase();
 if(!['pdf','doc','docx'].includes(ext))throw Error('Resume must be a PDF, DOC, or DOCX file.');
 const probe=new Uint8Array(await file.slice(0,Math.min(1024,file.size)).arrayBuffer());
 if(ext==='pdf'){
  const sig=[0x25,0x50,0x44,0x46,0x2d];
  let found=false;
  for(let i=0;i<=probe.length-sig.length;i++){
   let match=true;
   for(let j=0;j<sig.length;j++){if(probe[i+j]!==sig[j]){match=false;break}}
   if(match){found=true;break}
  }
  if(!found)throw Error('This file does not contain a valid PDF signature.');
 }
 if(ext==='docx'){
  const zipOk=probe.length>=4&&probe[0]===0x50&&probe[1]===0x4b&&[0x03,0x05,0x07].includes(probe[2])&&[0x04,0x06,0x08].includes(probe[3]);
  if(!zipOk)throw Error('This DOCX file does not contain a valid Word document signature.');
 }
 if(ext==='doc'){
  const ole=[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1];
  const oleOk=ole.every((v,i)=>probe[i]===v);
  if(!oleOk)throw Error('This DOC file does not contain a valid legacy Word document signature.');
 }
 return {
  extension:ext,
  contentType:ext==='pdf'?'application/pdf':ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/msword'
 };
}
async function uploadDocument(appId,kind,file){
 const app=byId(state.apps,appId);if(!app||app.customer_id!==currentCustomer()||!['approved','preparing','ready','blocked'].includes(app.status))throw Error('Application cannot receive documents');
 if(!['resume','cover_letter'].includes(kind))throw Error('Invalid document type');
 if(!currentDocumentAuthorization())throw Error('Customer standing consent is required before application documents can be prepared.');
 await validatePdf(file);
 const path=app.customer_id+'/'+app.id+'/'+crypto.randomUUID()+'.pdf';
 const {error}=await state.sb.storage.from('matchpath-documents').upload(path,file,{contentType:'application/pdf',upsert:false});
 if(error)throw error;
 const {error:e}=await state.sb.rpc('register_document',{p_application:app.id,p_kind:kind,p_storage_path:path});
 if(e)throw Error('PDF uploaded, but metadata registration failed. Contact admin; orphan file path: '+path+' · '+errorMsg(e));
}
async function validateZip(file){
 if(file.size>45*1024*1024)throw Error('ZIP limit is 45 MB');
 const {default:JSZip}=await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
 const zip=await JSZip.loadAsync(file);
 const entries=Object.values(zip.files);if(entries.length>90)throw Error('ZIP contains too many entries');
 const uncompressed=entries.reduce((sum,item)=>sum+Number(item._data?.uncompressedSize||0),0);
 if(uncompressed>120*1024*1024)throw Error('ZIP decompressed size exceeds 120 MB');
 const m=zip.file('manifest.csv');if(!m)throw Error('ZIP must have manifest.csv at its root');
 if(Number(m._data?.uncompressedSize||0)>32768)throw Error('Manifest exceeds 32 KB');
 const {keys,rows}=parseCsv(await m.async('string'));
 if(!exactColumns(keys,MANIFEST))throw Error('Manifest columns do not match v1.0 format');
 if(!rows.length||rows.length>25)throw Error('ZIP must have 1–25 application packages');
 const items=[],seen=new Set(),id=currentCustomer();
 for(const row of rows){
  if(row.schema_version!=='1.0'||row.customer_id!==id)throw Error('Manifest customer ID or version mismatch');
  const a=byId(state.apps,row.application_id);
  if(!a||a.customer_id!==id||!['approved','preparing','ready','blocked'].includes(a.status))throw Error('Unknown or ineligible application: '+row.application_id);
  if(seen.has(a.id))throw Error('Duplicate application in manifest');seen.add(a.id);
  const expected=a.application_code; // Official directory is the MatchPath display application code.
  if(row.resume_file!==expected+'/resume.pdf'||row.cover_letter_file!==expected+'/cover_letter.pdf')
    throw Error('Expected '+expected+'/resume.pdf and '+expected+'/cover_letter.pdf');
  const rf=zip.file(row.resume_file),lf=zip.file(row.cover_letter_file);
  if(!rf||!lf)throw Error('Missing PDF files for '+expected);
  const rb=await rf.async('blob'),lb=await lf.async('blob');
  await validatePdf(rb);await validatePdf(lb);items.push({app:a,resume:rb,cover_letter:lb});
 }
 state.zipPreview={items};render();notice('ZIP manifest validated for '+items.length+' application packages.');
}
async function uploadZip(){
 const v=state.zipPreview;if(!v?.items.length)throw Error('No validated package');
 let completed=0;
 for(const item of v.items){
  await uploadDocument(item.app.id,'resume',item.resume);
  await uploadDocument(item.app.id,'cover_letter',item.cover_letter);
  completed++;
 }
 state.zipPreview=null;await loadData();notice('Uploaded both PDF documents for '+completed+' applications.');
}
document.addEventListener('click',async e=>{
 const action=e.target.closest('[data-action]');if(!action)return;
 try{action.disabled=true;await handleClick(action)}catch(err){notice(errorMsg(err),true)}finally{if(action.isConnected)action.disabled=false}
});
document.addEventListener('submit',async e=>{
 const form=e.target.closest('form');if(!form)return;e.preventDefault();
 if(state.loading)return;state.loading=true;form.classList.add('loading');
 try{await handleSubmit(form)}catch(err){notice(errorMsg(err),true)}finally{state.loading=false;form.classList.remove('loading')}
});
document.addEventListener('input',e=>{
 if(e.target.closest('#profileForm')&&!e.target.disabled)state.profileDirty=true;
 if(e.target.id!=='resultSearch')return;
 state.resultSearch=e.target.value;
 const cursor=e.target.selectionStart??state.resultSearch.length;
 clearTimeout(resultSearchTimer);
 resultSearchTimer=setTimeout(()=>{
  render();
  const input=$('#resultSearch');
  if(input){input.focus();const pos=Math.min(cursor,input.value.length);input.setSelectionRange(pos,pos);}
 },180);
});
document.addEventListener('change',async e=>{
 try{
  if(e.target.closest('#profileForm')&&!e.target.disabled)state.profileDirty=true;
  if(e.target.id==='reviewReferenceFiles'){
   if(state.account?.role!=='admin')throw Error('Administrator access required to upload customer resumes.');
   const customer=currentCustomer();if(!customer)throw Error('Choose a customer first.');
   const files=[...(e.target.files||[])];
   if(!files.length)return;
   notice('Uploading '+files.length+' resume'+(files.length===1?'':'s')+'…');
   const uploaded=await uploadReferenceResumes(customer,files);
   await loadData(state.me);
   state.page='customer-profile';
   render();
   notice(uploaded+' original/reference resume'+(uploaded===1?'':'s')+' uploaded. AI search prompt now needs an update.');
   return;
  }
  if(e.target.id==='resultQualificationFilter'){
   state.resultQualificationFilter=e.target.value||'all';
   render();
   return;
  }
  if(e.target.id==='resultStatusFilter'){
   state.resultStatusFilter=e.target.value||'all';
   render();
   return;
  }
  if(e.target.id==='approvedSelectAll'){
   document.querySelectorAll('[data-approved-select]').forEach(box=>{box.checked=e.target.checked;state.approvedSelections[box.dataset.job]=e.target.checked});
   updateApprovedBulkState();return;
  }
  if(e.target.matches('[data-approved-select]')){
   state.approvedSelections[e.target.dataset.job]=e.target.checked;
   updateApprovedBulkState();return;
  }
  if(e.target.matches('[data-approved-status]')){
   const job=e.target.dataset.job,status=e.target.value;
   if(status==='approved')delete state.approvedStatusDrafts[job];else state.approvedStatusDrafts[job]=status;
   state.approvedSelections[job]=true;
   const box=document.querySelector('[data-approved-select][data-job="'+CSS.escape(job)+'"]');if(box)box.checked=true;
   updateApprovedBulkState();
   return;
  }
  if(e.target.matches('[data-result-status]')){
   const job=e.target.dataset.job,status=e.target.value,original=jobResultUiStatus(byId(state.jobs,job)||{});
   if(status===original)delete state.resultStatusDrafts[job];else state.resultStatusDrafts[job]=status;
   updateResultSaveState();return;
  }
  if(e.target.matches('[data-review-choice]')){
   const job=e.target.dataset.job,status=e.target.value;
   if(status==='new')delete state.reviewDrafts[job];
   else state.reviewDrafts[job]=status;
   updateReviewSaveState();
   return;
  }
  if(e.target.id==='workspaceSwitch'&&state.account?.role==='admin'){
   if(!confirmDiscardChanges()){e.target.value=state.workspaceView;return;}state.workspaceView=e.target.value==='staff'?'staff':'admin';state.page='overview';state.selectedCustomer=null;clearStatusDrafts();render();return;
  }
  if(e.target.id==='previewStaffSelect'&&state.account?.role==='admin'){
   if(!confirmDiscardChanges()){e.target.value=state.previewStaffId||'';return;}state.previewStaffId=e.target.value||null;state.selectedCustomer=null;clearStatusDrafts();render();return;
  }
  if(e.target.id==='customerSelect'){if(!confirmDiscardChanges()){e.target.value=state.selectedCustomer||'';return;}state.selectedCustomer=e.target.value;state.csvPreview=null;state.zipPreview=null;clearStatusDrafts();render();return}
  if(e.target.id==='searchCsv'){await validateCsvFile(e.target.files?.[0]);return}
  if(e.target.id==='batchZip'){await validateZip(e.target.files?.[0]);return}
  if(e.target.dataset.change==='assign'){
   const b=e.target;const {error}=await state.sb.rpc('admin_assign_staff',{p_customer:b.dataset.customer,p_staff:b.dataset.staff,p_assign:b.checked});
   if(error)throw error;await loadData(state.me);notice('Staff assignment updated.');return;
  }
 }catch(err){notice(errorMsg(err),true)}
});
window.addEventListener('beforeunload',e=>{if(!draftCount())return;e.preventDefault();e.returnValue='';});
$('#logoutBtn').addEventListener('click',async()=>{if(!confirmDiscardChanges())return;if(state.sb)await state.sb.auth.signOut();state.me=null;state.account=null;state.page='overview';renderAuth('login');notice('Signed out.')});
$('#dialogClose').addEventListener('click',closeDialog);
$('#dialog').addEventListener('click',e=>{if(e.target.id==='dialog')closeDialog()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDialog()});
async function boot(){
 if(!config.supabaseUrl||!config.supabasePublishableKey){renderSetup();return;}
 // Show usable login UI immediately; do not block first paint on network or session restoration.
 const inviteParams=new URLSearchParams(window.location.hash.replace(/^#/,''));
 const inviteToken=inviteParams.get('type')==='invite'?inviteParams.get('access_token'):null;
 if(inviteToken){
  $('#sidebar').classList.add('hidden');$('#logoutBtn').classList.add('hidden');
  $('#page').innerHTML='<div class="auth"><section class="card"><div class="eyebrow">MatchPath invitation</div><h1>Set your password</h1><p>Choose a password to activate your account.</p><form id="acceptInviteForm">'+field('invitePassword','New password','','password','required minlength="8" autocomplete="new-password"')+'<button class="btn" type="submit">Activate account</button></form></section></div>';
  state.inviteToken=inviteToken;
 }else renderAuth('login');
 const timeout=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(label+' timed out. Check your network and retry.')),ms))]);
 try{
  let sdk;
  try { sdk=await timeout(import('https://esm.sh/@supabase/supabase-js@2.57.0'),12000,'Primary authentication library'); }
  catch(primaryError) { sdk=await timeout(import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm'),12000,'Backup authentication library'); }
  const timedFetch=(url,options={})=>fetch(url,{...options,signal:options.signal||AbortSignal.timeout(10000)});
  state.sb=sdk.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true},global:{fetch:timedFetch}});
  state.sb.auth.onAuthStateChange((event,session)=>{
   state.loginToken=session?.access_token||null;
   if(event==='SIGNED_OUT'){state.me=null;state.account=null;state.loginToken=null;renderAuth()}
  });
  if(!inviteToken){
   try{
    const {data,error}=await timeout(state.sb.auth.getSession(),10000,'Saved authentication session');
    if(error)throw error;
    if(data.session?.user){
     state.loginToken=data.session.access_token||null;
     state.page='overview';
     const loaded=await loadData(data.session.user);
     if(loaded)notice('Signed in from your saved session.');
    }else{
     state.me=null;state.account=null;state.loginToken=null;renderAuth('login');
    }
   }catch(sessionError){
    state.me=null;state.account=null;state.loginToken=null;renderAuth('login');
    notice('Saved login could not be restored. Sign in to continue. Details: '+errorMsg(sessionError),true);
   }
  }
 }catch(e){
  $('#sidebar').classList.add('hidden');$('#logoutBtn').classList.add('hidden');
  $('#page').innerHTML='<section class="card" style="max-width:660px"><h1>MatchPath could not finish loading</h1><p>The portal could not connect to its authentication service. Your account has not been changed.</p><p class="hint" id="bootError"></p><button class="btn" id="retryBoot" type="button">Retry loading</button></section>';
  $('#bootError').textContent=errorMsg(e);
  $('#retryBoot').addEventListener('click',()=>window.location.reload());
 }
}
boot();
