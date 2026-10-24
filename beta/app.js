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
const field=(id,label,value='',type='text',extra='')=>'<div class="field"><label for="'+esc(id)+'">'+esc(label)+'</label><input id="'+esc(id)+'" type="'+esc(type)+'" value="'+esc(value)+'" '+extra+'></div>';
const area=(id,label,value='',hint='')=>'<div class="field"><label for="'+esc(id)+'">'+esc(label)+'</label><textarea id="'+esc(id)+'">'+esc(value)+'</textarea>'+(hint?'<div class="input-help">'+esc(hint)+'</div>':'')+'</div>';
const head=(k,t,d,extra='')=>'<div class="page-heading"><div><div class="eyebrow">'+esc(k)+'</div><h1>'+esc(t)+'</h1>'+(d?'<p>'+esc(d)+'</p>':'')+'</div>'+extra+'</div>';
const notice=(message,error=false)=>{const n=$('#notice');n.textContent=message||'';n.classList.toggle('error',error);if(message)window.scrollTo({top:0,behavior:'smooth'})};
const state={sb:null,me:null,account:null,accounts:[],profiles:[],assignments:[],jobs:[],apps:[],docs:[],submitted:[],runs:[],referenceResumes:[],selectedCustomer:null,page:'overview',csvPreview:null,zipPreview:null,editingRole:null,loading:false,workspaceView:'admin',previewStaffId:null,resultStatusFilter:'all',resultQualificationFilter:'all',resultSearch:''};
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
function navItems(){const r=state.account.role==='admin'&&state.workspaceView==='staff'?'staff':state.account.role;return r==='customer'?[['overview','Overview'],['matches','Review job matches'],['applications','My applications'],['profile','Search profile']]:r==='staff'?[['overview','Overview'],['import','Import search CSV'],['queue-new','To be reviewed'],['queue-approved','Approved'],['queue-submitted','Submitted'],['queue-skipped','Skipped'],['queue-all','All search results'],['documents','Document uploads']]:[['overview','Overview'],['import','Import search CSV'],['queue-new','To be reviewed'],['queue-approved','Approved'],['queue-submitted','Submitted'],['queue-skipped','Skipped'],['queue-all','All search results'],['documents','Document uploads'],['admin','Accounts & access']];}
function buildNav(){
 $('#sidebar').classList.remove('hidden');$('#logoutBtn').classList.remove('hidden');
 const r=state.account.role;
 const preview=r==='admin'&&state.workspaceView==='staff';
 $('#modeLabel').innerHTML=r==='admin'?'<label for="workspaceSwitch">Workspace </label><select id="workspaceSwitch"><option value="admin" '+(!preview?'selected':'')+'>Admin workspace</option><option value="staff" '+(preview?'selected':'')+'>Staff workspace preview</option></select>':(r==='staff'?'Staff':'Customer')+' workspace';
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
function filteredQualifiedJobs(){const id=currentCustomer(),p=currentProfile();return matchingJobs(id).filter(j=>j.qualification_status==='Qualified'&&j.fit_score!=null&&j.fit_score>=(p?.min_fit_score??90))}
function dashboard(){
 const role=state.account.role==='admin'&&state.workspaceView==='staff'?'staff':state.account.role, id=currentCustomer();
 const j=matchingJobs(id),a=matchingApps(id);
 const ready=a.filter(x=>x.status==='ready').length,submitted=a.filter(x=>x.status==='submitted').length;
 const matches=filteredQualifiedJobs();
 const pending=matches.filter(x=>x.review_status==='pending').length;
 const metrics=role==='customer'?[['Jobs screened',j.length],['To review',pending],['Applications applied',submitted],['Qualified matches',matches.length]]:[['Jobs evaluated',j.length],['Approved queue',a.filter(x=>!['submitted','closed'].includes(x.status)).length],['Documents ready',ready],['Applied',submitted]];
 let html=head(role==='customer'?'My career search':role==='staff'?'Staff operations':'Administration','Good '+(new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening')+', '+(state.account.full_name?.split(' ')[0]||'there'),role==='customer'?'Your job matches and application activity, in one place.':'Select a customer, review imported jobs, authorize the right opportunities, prepare documents, and track applications.',role==='customer'?'':customerPicker());
 html+='<div class="grid">'+metrics.map(([n,v])=>'<div class="card stat"><div class="name">'+n+'</div><div class="value">'+v+'</div></div>').join('')+'</div>';
 if(!id&&role!=='customer')return html+'<div class="card section empty"><strong>No assigned customers yet</strong>Admin can assign customers in Accounts & access.</div>';
 html+='<div class="section grid two"><div class="card"><h2>'+(role==='customer'?'What happens next':'Daily workflow')+'</h2><ul class="checklist">'+(role==='customer'?'<li>Review your verified job matches</li><li>Approve the jobs you want pursued</li><li>Access documents and submission updates</li>':'<li>Choose a customer and import a search CSV</li><li>Review and authorize the right jobs</li><li>Upload job-specific resume and cover letter PDFs</li><li>Apply on employer site and record confirmation</li>')+'</ul><button class="btn" data-action="navigate" data-page="'+(role==='customer'?'matches':'import')+'">'+(role==='customer'?'Review matches':'Import search results')+'</button></div><div class="card"><h2>Recent applications</h2>'+(a.length?a.slice(0,4).map(x=>{const j=byId(state.jobs,x.job_id);return '<div class="detail space"><div><div class="title">'+esc(j?.job_title||x.application_code)+'</div><div class="sub">'+esc(j?.company||'')+'</div></div>'+statusBadge(x.status)+'</div>'}).join(''):'<div class="empty"><strong>No applications yet</strong>Approved jobs will appear here.</div>')+'</div></div>';
 if(role!=='customer'){html+='<section class="section card"><h2>Last search batches</h2>'+(state.runs.filter(x=>x.customer_id===id).slice(0,5).map(x=>'<p><span class="pill">'+esc(x.external_id)+'</span> · '+x.new_rows+' new · '+x.duplicate_rows+' duplicates · '+fmtDate(x.created_at)+'</p>').join('')||'<p class="muted">No imports yet.</p>')+'</section>'}
 return html;
}
function matchesPage(){
 let rows=filteredQualifiedJobs(), pending=rows.filter(x=>x.review_status==='pending');
 let html=head('Customer portal','Review opportunities','Only matches meeting your approved fit threshold appear here. Approve each posting before staff prepare and submit an application.');
 if(!rows.length)return html+'<section class="card empty"><strong>No qualified matches available</strong>Staff will add results after the next search batch.</section>';
 html+='<div class="space section-head"><h2>'+pending.length+' awaiting your decision</h2><span class="badge neutral">Fit ≥ '+esc(currentProfile()?.min_fit_score??90)+'</span></div>';
 html+='<div class="flex-col">'+rows.map(j=>'<article class="card"><div class="space"><div><h3>'+esc(j.job_title)+'</h3><p class="muted">'+esc(j.company)+' · '+esc(j.location)+' · '+esc(j.work_arrangement)+'</p></div><span class="score">'+esc(j.fit_score)+'/100</span></div><p>'+esc(j.fit_reason)+'</p>'+(j.concerns?'<p class="hint">Considerations: '+esc(j.concerns)+'</p>':'')+'<div class="space detail actions"><span class="hint">'+money(j.salary_min,j.currency)+(j.salary_max?' – '+money(j.salary_max,j.currency):'')+'</span>'+statusBadge(j.review_status)+'</div><div class="stack"><a class="btn outline small" target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(j.job_url))+'">Original posting ↗</a>'+(j.review_status==='pending'?'<button class="btn small" data-action="decision" data-job="'+esc(j.id)+'" data-decision="approved">Approve</button><button class="btn ghost small" data-action="decision" data-job="'+esc(j.id)+'" data-decision="rejected">Reject</button>':'<span class="hint">Decision recorded '+fmtDate(j.decided_at)+'</span>')+'</div></article>').join('')+'</div>';
 return html;
}
function applicationsPage(){
 const a=matchingApps(currentCustomer());
 let html=head('Customer portal','My applications','View actual status, job-specific documents, and the files used for submitted applications.');
 if(!a.length)return html+'<section class="card empty"><strong>Nothing submitted or preparing yet</strong>Approve a job match to start a new application.</section>';
 return html+'<section class="flex-col">'+a.map(app=>{let j=byId(state.jobs,app.job_id);return '<article class="card"><div class="space"><div><span class="pill">'+esc(app.application_code)+'</span><h3 style="margin:9px 0 3px">'+esc(j?.job_title||'Application')+'</h3><div class="muted">'+esc(j?.company||'')+' · '+esc(j?.location||'')+'</div></div>'+statusBadge(app.status)+'</div><hr><p class="hint">Approved '+fmtDate(app.created_at)+' · Submitted '+fmtDate(app.submitted_at)+'</p>'+(app.submission_reference?'<p><strong>Confirmation:</strong> '+esc(app.submission_reference)+'</p>':'')+'<div class="stack section">'+docButtons(app)+'<a class="btn outline small" target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(j?.job_url))+'">Job posting ↗</a></div></article>'}).join('')+'</section>';
}
function docButtons(app){return ['resume','cover_letter'].map(k=>{let d=appliedDocFor(app.id,k);return d?'<button class="btn outline small" data-action="download" data-doc="'+esc(d.id)+'">'+(k==='resume'?'Resume':'Cover letter')+' v'+d.version+' ↓</button>':'<span class="badge warn">'+(k==='resume'?'Resume':'Cover letter')+' pending</span>'}).join('')}
function profilePage(){
 const p=currentProfile()||{};
 const objectiveOptions=['Continue in my field','Change career path','Move private → public sector','Move public → private sector','Move up to management / director','Increase compensation','Improve stability / pension','Improve work-life balance'];
 const objectives=String(p.career_goals||'').split('\n').filter(x=>x.startsWith('• ')).map(x=>x.slice(2));
 const linkedinMatch=String(p.search_instructions||'').match(/^LinkedIn profile: (https:\/\/[^\s]+)/m);
 const cleanInstructions=String(p.search_instructions||'').replace(/^LinkedIn profile: https:\/\/[^\s]+\n?/m,'');
 const goalsFree=String(p.career_goals||'').split('\n').filter(x=>!x.startsWith('• ')).join('\n').trim();
 return head('Customer onboarding','Build your career search','Tell us where you are today and where you want to go. Your uploaded resumes are references for one verified career profile—not separate job-search tracks.')+
 '<section class="card"><form id="profileForm"><h2>1 · Your background</h2><p class="hint">Do not enter passwords or private LinkedIn access tokens. We will not scrape a private LinkedIn account.</p>'+
 field('linkedin_url','LinkedIn public profile URL',p.linkedin_url||linkedinMatch?.[1]||'','url','placeholder="https://www.linkedin.com/in/your-profile"')+
 '<div class="field"><label for="referenceFiles">Upload reference resumes (PDF, multiple files)</label><input id="referenceFiles" type="file" accept=".pdf,application/pdf" multiple><span class="hint">Each PDF up to 6 MB. Originals are preserved privately; no automatic AI processing is triggered by saving.</span></div>'+
 '<div class="field"><strong>Uploaded reference resumes</strong><div class="hint">'+(state.referenceResumes.filter(r=>r.customer_id===state.me.id).length?state.referenceResumes.filter(r=>r.customer_id===state.me.id).map(r=>'<div>'+esc(r.original_filename)+' · '+fmtDate(r.created_at)+' <button class="btn ghost small" type="button" data-action="reference-download" data-path="'+esc(r.storage_path)+'">Open</button></div>').join(''):'No resumes uploaded yet.')+'</div></div>'+'<h2>2 · Your next career move</h2><p class="hint">Select every goal that matters. Describe the most important tradeoffs below.</p>'+
 '<div class="field">'+objectiveOptions.map((o,i)=>'<label style="display:block;margin:9px 0"><input type="checkbox" name="career_objective" value="'+esc(o)+'" '+(objectives.includes(o)?'checked':'')+'> '+esc(o)+'</label>').join('')+'</div>'+
 area('career_goals_detail','Career destination, priorities and timeline',goalsFree,'Example: move from consulting into a permanent public-sector IT manager role within six months; pension matters more than a 10% salary increase.')+
 area('target_roles','Target roles and seniority',p.target_roles)+area('transferable_roles','Adjacent or transferable roles',p.transferable_roles)+
 '<h2>3 · Search preferences and constraints</h2>'+area('preferred_locations','Preferred locations',p.preferred_locations)+area('relocation_preferences','Relocation flexibility',p.relocation_preferences)+
 '<div class="form-row">'+field('salary_min','Minimum acceptable compensation',p.salary_min||'','number','min="0"')+'<div class="field"><label for="salary_currency">Currency</label><select id="salary_currency">'+['CAD','USD'].map(x=>'<option '+(p.salary_currency===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div></div>'+
 field('salary_target','Aspirational compensation target',p.salary_target||'','number','min="0" placeholder="Optional; describe in priorities if needed"')+
 '<div class="form-row"><div class="field"><label for="work_preference">Work arrangement</label><select id="work_preference">'+['Any','Remote','Hybrid','Onsite'].map(x=>'<option '+(p.work_preference===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="field"><label for="service_tier">Service preference</label><select id="service_tier"><option value="diy" '+(p.service_tier!=='full_service'?'selected':'')+'>DIY — I apply</option><option value="full_service" '+(p.service_tier==='full_service'?'selected':'')+'>Full Service — human staff applies</option></select></div></div>'+
 area('industries','Industries and sectors',p.industries)+area('employment_types','Employment type',p.employment_types)+area('pension_preferences','Benefits and pension preferences',p.pension_preferences)+
 area('exclusions','Mandatory requirements / hard exclusions',p.exclusions,'Only true dealbreakers belong here.')+
 area('search_instructions','Flexible preferences and additional search instructions',cleanInstructions,'List nice-to-have preferences separately from hard exclusions.')+
 '<div class="form-row">'+field('min_fit_score','Minimum fit score (0–100)',p.min_fit_score??90,'number','min="0" max="100" required')+'</div>'+
 '<p class="hint">Saving does not approve an AI-generated strategy or authorize application submissions. AI processing requires separate explicit consent.</p>'+
 '<div class="stack"><button class="btn" type="submit">Save onboarding information</button>'+(p.baseline_resume_path?'<button type="button" class="btn outline" data-action="baseline-download">Download previous baseline resume</button>':'')+'</div></form></section>';
}
function importPage(){
 const id=currentCustomer();let html=head('Step 1 · Staff operations','Import a job-search batch','Download the standard CSV from ChatGPT, choose its customer, validate the file, and import once. The backend prevents duplicate job records.',customerPicker());
 if(!id)return html+'<div class="card empty">No customer assigned.</div>';
 html+='<div class="warning">The CSV contains job-search data only. MatchPath backend assigns schema version, customer identity, and search-run identity during import. Only genuine evaluated postings should be included.</div>';
 html+='<section class="card section"><h2>1. Choose the CSV</h2><div class="file-box"><strong>Standard MatchPath search export (v1.0)</strong><p class="hint">UTF-8 CSV · exact 15 columns · customer and run IDs are added by MatchPath · up to 250 jobs per batch</p><input id="searchCsv" type="file" accept=".csv,text/csv"></div><p class="hint" style="margin-top:12px"><a href="../job_search_template.csv" target="_blank">Download standard CSV example ↗</a></p></section>';
 if(state.csvPreview){const v=state.csvPreview;html+='<section class="card section"><h2>2. Validate and commit</h2><div class="stack"><span class="badge">'+v.rows.length+' evaluated</span><span class="badge neutral">'+v.rows.filter(x=>x.qualification_status==='Qualified').length+' qualified</span><span class="pill">Run ID assigned by backend</span></div><div class="table-wrap section"><table><thead><tr><th>Employer / role</th><th>Fit score</th><th>Classification</th></tr></thead><tbody>'+v.rows.slice(0,12).map(x=>'<tr><td><strong>'+esc(x.job_title)+'</strong><small>'+esc(x.company)+'</small></td><td>'+esc(x.fit_score||'—')+'</td><td>'+esc(x.qualification_status)+'</td></tr>').join('')+'</tbody></table></div><button class="btn section" data-action="commit-csv">Import validated batch</button></section>'}
 return html;
}
function jobResultUiStatus(j){
 const app=state.apps.find(a=>a.job_id===j.id&&a.status!=='closed')||state.apps.find(a=>a.job_id===j.id);
 if(app?.status==='submitted')return 'applied';
 return j.review_status==='pending'?'new':j.review_status;
}
function jobResultsPanel(forcedStatus='all'){
 const id=currentCustomer(),allRows=matchingJobs(id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 if(!id)return '<div class="card section empty">No customer assigned.</div>';
 if(!allRows.length)return '<section class="card section empty"><strong>No imported jobs yet</strong>Import a validated search CSV first.</section>';

 const statusLabel=s=>s==='new'?'New':s==='skipped'?'Skipped':s==='approved'?'Approved':s==='applied'?'Submitted':'Rejected';
 const search=state.resultSearch.trim().toLowerCase();
 const activeStatus=forcedStatus==='all'?state.resultStatusFilter:forcedStatus;
 const rows=allRows.filter(j=>{
   if(activeStatus!=='all'&&jobResultUiStatus(j)!==activeStatus)return false;
   if(state.resultQualificationFilter!=='all'&&j.qualification_status!==state.resultQualificationFilter)return false;
   if(search&&!([j.job_title,j.company,j.location,j.requisition_id,j.fit_reason,j.concerns].join(' ').toLowerCase().includes(search)))return false;
   return true;
 });

 const counts={
   new:allRows.filter(j=>jobResultUiStatus(j)==='new').length,
   approved:allRows.filter(j=>jobResultUiStatus(j)==='approved').length,
   applied:allRows.filter(j=>jobResultUiStatus(j)==='applied').length,
   skipped:allRows.filter(j=>jobResultUiStatus(j)==='skipped').length,
   rejected:allRows.filter(j=>jobResultUiStatus(j)==='rejected').length
 };

 let html='<section class="section">';
 html+='<div class="stack section-head"><span class="badge neutral">'+counts.new+' To review</span><span class="badge neutral">'+counts.approved+' Approved</span><span class="badge">'+counts.applied+' Submitted</span><span class="badge neutral">'+counts.skipped+' Skipped</span><span class="badge neutral">'+counts.rejected+' Rejected</span></div>';

 html+='<section class="card"><form id="resultFilterForm"><input type="hidden" id="forcedResultStatus" value="'+esc(forcedStatus)+'"><div class="grid"><div class="field"><label for="resultSearch">Keyword</label><input id="resultSearch" value="'+esc(state.resultSearch)+'" placeholder="Title, employer, location, requisition..."></div>'+(forcedStatus==='all'?'<div class="field"><label for="resultStatusFilter">Status</label><select id="resultStatusFilter"><option value="all">All statuses</option>'+[['new','To be reviewed'],['approved','Approved'],['applied','Submitted'],['skipped','Skipped'],['rejected','Rejected']].map(([v,n])=>'<option value="'+v+'" '+(state.resultStatusFilter===v?'selected':'')+'>'+n+'</option>').join('')+'</select></div>':'')+'<div class="field"><label for="resultQualificationFilter">Qualification</label><select id="resultQualificationFilter"><option value="all">All qualifications</option>'+['Qualified','Needs Verification','Not Qualified'].map(v=>'<option value="'+esc(v)+'" '+(state.resultQualificationFilter===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></div></div><div class="stack"><button class="btn small" type="submit">Apply filters</button><button class="btn ghost small" type="button" data-action="clear-result-filters">Clear</button><span class="hint">'+rows.length+' of '+allRows.length+' jobs shown</span></div></form></section>';

 html+='<section class="card section"><div class="table-wrap"><table><thead><tr><th>Employer / role</th><th>Fit</th><th>Qualification</th><th>Location</th><th>Salary</th><th>Status</th><th>Application</th><th>Action</th></tr></thead><tbody>'+rows.map(j=>{
   const app=state.apps.find(a=>a.job_id===j.id&&a.status!=='closed')||state.apps.find(a=>a.job_id===j.id);
   const current=jobResultUiStatus(j);
   const lockedApplied=current==='applied';
   const statusControl=state.account.role==='admin'
     ?'<select id="job-status-'+esc(j.id)+'" class="form-control" style="min-width:132px" '+(lockedApplied?'disabled title="Submitted records are immutable"':'')+'>'+[['new','To be reviewed'],['approved','Approved'],['applied','Submitted'],['skipped','Skipped'],['rejected','Rejected']].map(([v,n])=>'<option value="'+v+'" '+(current===v?'selected':'')+'>'+n+'</option>').join('')+'</select>'
     :'<span class="badge neutral">'+esc(statusLabel(current))+'</span>';
   const qualificationClass=j.qualification_status==='Needs Verification'?'warn':j.qualification_status==='Not Qualified'?'red':'neutral';
   return '<tr><td><strong>'+esc(j.job_title)+'</strong><small>'+esc(j.company)+(j.requisition_id?' · Req '+esc(j.requisition_id):'')+'</small>'+(j.concerns?'<small class="muted">Concern: '+esc(j.concerns)+'</small>':'')+'</td><td><strong>'+esc(j.fit_score??'—')+(j.fit_score!=null?'/100':'')+'</strong></td><td><span class="badge '+qualificationClass+'">'+esc(j.qualification_status)+'</span></td><td>'+esc(j.location)+'<small>'+esc(j.work_arrangement||'Unknown')+'</small></td><td>'+money(j.salary_min,j.currency)+(j.salary_max?' – '+money(j.salary_max,j.currency):'')+'</td><td>'+statusControl+'</td><td>'+(app&&app.status!=='closed'?'<span class="pill">'+esc(app.application_code)+'</span><small>'+esc(app.status)+'</small>':'<span class="muted">—</span>')+'</td><td><div class="stack"><a class="btn outline small" target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(j.job_url))+'">Posting ↗</a>'+(state.account.role==='admin'&&!lockedApplied?'<button class="btn small" data-action="save-job-status" data-job="'+esc(j.id)+'">Save</button>':'')+(app&&app.status!=='closed'?'<button class="btn outline small" data-action="navigate" data-page="documents" data-app="'+esc(app.id)+'">Documents</button>':'')+'</div></td></tr>';
 }).join('')+'</tbody></table></div></section></section>';
 return html;
}
function queuePage(status,title,description){
 return head('Staff operations',title,description,customerPicker())+jobResultsPanel(status);
}
function newResultsPage(){return queuePage('new','To be reviewed','New imported search results waiting for Admin review and disposition.');}
function approvedResultsPage(){return queuePage('approved','Approved search results','Jobs authorized for application preparation but not yet submitted.');}
function submittedResultsPage(){return queuePage('applied','Submitted','Applications confirmed as submitted to the employer.');}
function skippedResultsPage(){return queuePage('skipped','Skipped','Jobs intentionally retained but not currently being pursued.');}
function allResultsPage(){return queuePage('all','All search results','Complete search-result history for the selected customer, including rejected items.');}
function workbenchPage(){
 const id=currentCustomer(),a=matchingApps(id).filter(x=>x.status!=='closed').sort((x,y)=>x.status==='submitted'?1:y.status==='submitted'?-1:0);
 let html=head('Step 2 · Staff operations','Approved applications','Work directly from each approved job. Upload the right documents, open the original posting, submit manually, then record the confirmation.',customerPicker());
 if(!id)return html+'<div class="card empty">No customer assigned.</div>';
 if(!a.length)return html+'<div class="card empty"><strong>No approved jobs yet</strong>Wait for customer review before preparing documents.</div>';
 const count=a.reduce((n,app)=>n+['resume','cover_letter'].filter(kind=>!!appliedDocFor(app.id,kind)).length,0);
 html+='<section class="card section"><div class="space"><div><strong>Batch download for this customer</strong><p class="hint">Latest resume and cover letter PDFs for each approved application, packaged by job in a ZIP. Missing documents are listed in the manifest.</p></div><button class="btn outline" data-action="download-all-documents" '+(!count?'disabled':'')+'>Download all resumes &amp; cover letters ('+count+')</button></div></section>';
 html+='<div class="flex-col">'+a.map(app=>{let j=byId(state.jobs,app.job_id),res=docFor(app.id,'resume'),letter=docFor(app.id,'cover_letter'),can=canPrepare(app);
 return '<article class="card"><div class="space"><div><span class="pill">'+esc(app.application_code)+'</span><h3 style="margin:9px 0 3px">'+esc(j?.job_title||'Unknown job')+'</h3><p class="muted">'+esc(j?.company||'')+' · '+esc(j?.location||'')+'</p></div>'+statusBadge(app.status)+'</div><p>'+esc(j?.fit_reason||'')+'</p><div class="detail"><div class="space"><span>Resume</span>'+(res?'<span class="badge">v'+res.version+' saved</span>':'<span class="badge warn">Missing</span>')+'</div><div class="space" style="margin-top:8px"><span>Cover letter</span>'+(letter?'<span class="badge">v'+letter.version+' saved</span>':'<span class="badge warn">Missing</span>')+'</div></div><div class="stack">'+docButtons(app)+'<a href="'+esc(safeUrl(j?.job_url))+'" class="btn outline small" target="_blank" rel="noopener noreferrer">Open employer posting ↗</a></div><div class="stack section">'+(app.status==='submitted'?'<span class="badge">Submitted '+fmtDate(app.submitted_at)+'</span><span class="hint">'+esc(app.submission_reference||'')+'</span>': '<button class="btn outline small" data-action="navigate" data-page="documents" data-app="'+esc(app.id)+'">Manage files</button><button class="btn outline small" '+(!can?'disabled':'')+' data-action="status" data-status="ready" data-app="'+esc(app.id)+'">Mark ready</button><button class="btn outline small" '+(!can?'disabled':'')+' data-action="status" data-status="in_progress" data-app="'+esc(app.id)+'">In progress</button><button class="btn" '+(!can||!['ready','in_progress'].includes(app.status)?'disabled':'')+' data-action="submit" data-app="'+esc(app.id)+'">Mark submitted</button><button class="btn ghost small" data-action="status" data-status="blocked" data-app="'+esc(app.id)+'">Blocked</button>')+'</div></article>'}).join('')+'</div>';
 return html;
}
function documentsPage(){
 const id=currentCustomer(),a=matchingApps(id).filter(x=>!['submitted','closed','in_progress'].includes(x.status));
 let html=head('Staff document operations','Upload resumes and cover letters','Each PDF belongs to one approved application. Use a batch ZIP with manifest.csv, or upload a single PDF.',customerPicker());
 if(!id)return html+'<div class="card empty">No customer assigned.</div>';
 html+='<div class="grid two"><section class="card"><h2>Bulk ZIP upload</h2><p class="muted">ChatGPT export: application-ID folders plus manifest.csv. The website verifies ownership and PDF files before uploading.</p><div class="file-box section"><input id="batchZip" type="file" accept=".zip,application/zip"></div><p class="hint"><a href="../manifest_template.csv" target="_blank">Manifest CSV example ↗</a></p>'+(state.zipPreview?'<p class="section"><span class="badge">'+state.zipPreview.items.length+' complete application packages validated</span></p><button class="btn" data-action="commit-zip">Upload validated documents</button>':'')+'</section><section class="card"><h2>Individual PDF correction</h2><p class="muted">Select a job and document type. A new version is stored without overwriting past submissions.</p><form id="singleDocumentForm"><div class="field"><label for="singleApp">Approved application</label><select id="singleApp">'+a.map(x=>{const j=byId(state.jobs,x.job_id);return '<option value="'+esc(x.id)+'" '+(window.location.hash.endsWith(x.id)?'selected':'')+'>'+esc(x.application_code)+' · '+esc(j?.job_title||'')+'</option>'}).join('')+'</select></div><div class="field"><label for="singleKind">Document type</label><select id="singleKind"><option value="resume">Resume</option><option value="cover_letter">Cover letter</option></select></div><div class="field"><label for="singlePdf">PDF file</label><input id="singlePdf" type="file" accept=".pdf,application/pdf" required></div><button class="btn" type="submit" '+(!a.length?'disabled':'')+'>Upload new version</button></form></section></div>';
 html+='<section class="card section"><h2>Document readiness</h2>'+(a.length?a.map(x=>{const j=byId(state.jobs,x.job_id);return '<div class="detail space"><div><strong>'+esc(x.application_code)+'</strong> · '+esc(j?.job_title||'')+'<div class="hint">'+(docFor(x.id,'resume')?'Resume ✓':'Resume missing')+' · '+(docFor(x.id,'cover_letter')?'Cover letter ✓':'Cover letter missing')+'</div></div>'+statusBadge(x.status)+'</div>'}).join(''):'<div class="empty">No applications eligible for document changes.</div>')+'</section>';
 return html;
}
function adminPage(){
 if(state.account.role!=='admin')return '<section class="card">Not authorized.</section>';
 const all=state.accounts,staff=all.filter(a=>a.role==='staff'),assignees=all.filter(a=>a.role==='staff'||a.role==='admin'),customers=all.filter(a=>a.role==='customer');
 let html=head('Super admin','Accounts & staff assignments','Grant staff access only to designated customer accounts. The pilot can assign all ten customers to one staff member.');
 html+='<section class="card section"><h2>Invite a customer or staff member</h2><p class="hint">Send a secure invitation. The recipient sets their own password; no password is shared with administrators.</p><form id="inviteAccountForm"><div class="grid">'+field('inviteName','Full name','','text','required maxlength="120"')+field('inviteEmail','Email address','','email','required autocomplete="off"')+'<div class="field"><label for="inviteRole">Account type</label><select id="inviteRole" class="form-control"><option value="customer">Customer</option><option value="staff">Staff</option></select></div></div><button class="btn" type="submit">Send invitation</button></form></section>';
 html+='<div class="grid"><div class="card stat"><div class="name">Customers</div><div class="value">'+customers.length+'</div></div><div class="card stat"><div class="name">Staff</div><div class="value">'+staff.length+'</div></div><div class="card stat"><div class="name">Assignments</div><div class="value">'+state.assignments.length+'</div></div></div>';
 html+='<section class="card section"><h2>Account roles</h2><div class="table-wrap"><table><thead><tr><th>Account</th><th>Current role</th><th>Change role</th></tr></thead><tbody>'+all.map(a=>'<tr><td><strong>'+esc(a.full_name||'Name not set')+'</strong><small>'+esc(a.email)+'</small></td><td>'+statusBadge(a.role)+'</td><td><div class="stack"><select id="role-'+esc(a.id)+'" class="form-control" style="max-width:145px" '+(a.id===state.account.id?'disabled':'')+'>'+['customer','staff','admin'].map(r=>'<option value="'+r+'" '+(a.role===r?'selected':'')+'>'+r+'</option>').join('')+'</select><button class="btn small" data-action="set-role" data-user="'+esc(a.id)+'" '+(a.id===state.account.id?'disabled':'')+'>Save role</button></div></td></tr>').join('')+'</tbody></table></div></section>';
 html+='<section class="card section"><h2>Assign staff to customers</h2><div class="table-wrap"><table><thead><tr><th>Customer</th>'+assignees.map(s=>'<th>'+esc(s.full_name||s.email)+(s.role==='admin'?' (Admin)':'')+'</th>').join('')+'</tr></thead><tbody>'+customers.map(c=>'<tr><td><strong>'+esc(c.full_name||c.email)+'</strong></td>'+assignees.map(s=>'<td><label><input type="checkbox" data-change="assign" data-customer="'+esc(c.id)+'" data-staff="'+esc(s.id)+'" '+(state.assignments.some(x=>x.staff_id===s.id&&x.customer_id===c.id)?'checked':'')+'> Assigned</label></td>').join('')+'</tr>').join('')+'</tbody></table></div>'+(assignees.length===0?'<p class="hint">Create a staff account or use an administrator account to assign customers.</p>':'')+'</section>';
 return html;
}
function render(){
 if(!state.account)return renderAuth();
 buildNav();
 const r=state.account.role==='admin'&&state.workspaceView==='staff'?'staff':state.account.role;
 if(r==='customer'&&!['overview','matches','applications','profile'].includes(state.page))state.page='overview';
 if(r!=='customer'&&!['overview','import','queue-new','queue-approved','queue-submitted','queue-skipped','queue-all','workbench','documents',...(r==='admin'?['admin']:[])].includes(state.page))state.page='overview';
 $('#mainNav').querySelectorAll('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page));
 const pageMap={overview:dashboard,matches:matchesPage,applications:applicationsPage,profile:profilePage,import:importPage,'queue-new':newResultsPage,'queue-approved':approvedResultsPage,'queue-submitted':submittedResultsPage,'queue-skipped':skippedResultsPage,'queue-all':allResultsPage,workbench:workbenchPage,documents:documentsPage,admin:adminPage};
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
 const keys=['accounts','customer_profiles','staff_assignments','jobs','applications','document_versions','submitted_documents','search_runs','reference_resumes'];
 const tables=await Promise.all(keys.map(async table=>{
   const url=config.supabaseUrl+'/rest/v1/'+table+'?select=*&limit='+(table==='jobs'?1000:500);
   const response=await within(fetch(url,{headers:{apikey:config.supabasePublishableKey,Authorization:'Bearer '+state.loginToken,Accept:'application/json'},signal:AbortSignal.timeout(12000)}),'Loading '+table,12000);
   if(!response.ok)throw Error('Loading '+table+' HTTP '+response.status+': '+(await response.text()).slice(0,250));
   return await response.json();
 }));
 [state.accounts,state.profiles,state.assignments,state.jobs,state.apps,state.docs,state.submitted,state.runs,state.referenceResumes]=tables;
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
function openDialog(title,body){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=body;$('#dialog').classList.remove('hidden')}
function closeDialog(){$('#dialog').classList.add('hidden');$('#dialogBody').replaceChildren()}
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
const csvCell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
async function handleClick(target){
 const action=target.dataset.action;
 if(action==='reference-download'){const item=state.referenceResumes.find(x=>x.storage_path===target.dataset.path&&x.customer_id===state.me.id);if(!item)throw Error('Resume unavailable');await signedPdf(item.storage_path,'matchpath-profiles');return}
 if(action==='show-login'){renderAuth('login');return}
 if(action==='show-signup'){renderAuth('signup');return}
 if(action==='navigate'){state.page=target.dataset.page;if(target.dataset.app)window.location.hash=target.dataset.app;state.csvPreview=null;state.zipPreview=null;render();return}
 if(action==='decision'){
  if(!confirm('Record this job as '+target.dataset.decision+'?'))return;
  const {error}=await state.sb.rpc('customer_decide_job',{p_job:target.dataset.job,p_decision:target.dataset.decision});
  if(error)throw error;await loadData();notice('Your decision has been recorded.');return;
 }
 if(action==='save-job-status'){
  if(state.account?.role!=='admin')throw Error('Administrator access required.');
  const job=byId(state.jobs,target.dataset.job);if(!job||job.customer_id!==currentCustomer())throw Error('Job unavailable for this customer.');
  const select=$('#job-status-'+CSS.escape(job.id));if(!select)throw Error('Status control unavailable.');
  const next=select.value;
  const app=state.apps.find(a=>a.job_id===job.id&&a.status!=='closed')||state.apps.find(a=>a.job_id===job.id);
  const current=jobResultUiStatus(job);
  if(next===current){notice('No status change to save.');return;}
  if(current==='applied')throw Error('Applied records are immutable.');
  if(next==='applied'){
   if(!app||app.status==='closed')throw Error('Approve the job first so an application exists.');
   if(!canPrepare(app))throw Error('Resume and cover letter must be uploaded before marking Applied.');
   if(!['ready','in_progress'].includes(app.status)){
    const {error:readyError}=await state.sb.rpc('staff_set_application_status',{p_application:app.id,p_status:'ready',p_reference:null,p_note:'Prepared for Admin-confirmed submission.'});
    if(readyError)throw readyError;
   }
   openDialog('Confirm actual job application','<p class="warning">Use Applied only after the employer application was genuinely submitted. Record a confirmation/reference or verifiable acknowledgment.</p><form id="submitForm" data-app="'+esc(app.id)+'" data-return-page="queue-submitted">'+field('submissionReference','Employer confirmation / reference','','text','required minlength="3"')+area('submissionNotes','Submission notes (optional)')+'<button class="btn" type="submit">Confirm Applied</button></form>');
   return;
  }
  const {error}=await state.sb.rpc('admin_set_job_review_status',{p_job:job.id,p_status:next});
  if(error)throw error;
  await loadData(state.me);
  state.page=next==='new'?'queue-new':next==='approved'?'queue-approved':next==='skipped'?'queue-skipped':'queue-all';
  render();
  notice('Job status saved as '+(next==='new'?'To be reviewed':next[0].toUpperCase()+next.slice(1))+'.');
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
  state.csvPreview=null;await loadData();notice(data?.new_rows+' new jobs imported, '+data?.duplicate_rows+' duplicates skipped. Run '+runId+'.');return;
 }
 if(action==='status'){
  const {error}=await state.sb.rpc('staff_set_application_status',{p_application:target.dataset.app,p_status:target.dataset.status,p_reference:null,p_note:''});
  if(error)throw error;await loadData();notice('Application status updated.');return;
 }
 if(action==='submit'){
  const a=byId(state.apps,target.dataset.app);if(!a)throw Error('Application not found');
  openDialog('Confirm actual job application','<p class="warning">Only mark as submitted after completing the employer application. Record a confirmation/reference or verifiable submission acknowledgment.</p><form id="submitForm" data-app="'+esc(a.id)+'">'+field('submissionReference','Employer confirmation / reference','','text','required minlength="3"')+area('submissionNotes','Submission notes (optional)')+'<button class="btn" type="submit">Confirm submitted</button></form>');return;
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
 if(type==='resultFilterForm'){
  state.resultSearch=$('#resultSearch')?.value||'';
  if($('#resultStatusFilter'))state.resultStatusFilter=$('#resultStatusFilter').value||'all';
  state.resultQualificationFilter=$('#resultQualificationFilter')?.value||'all';
  render();
  return;
 }
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
 if(type==='profileForm'){
  const score=Number($('#min_fit_score').value);
  if(!Number.isInteger(score)||score<0||score>100)throw Error('Fit score must be between 0 and 100');
  const linked=$('#linkedin_url').value.trim();
  if(linked&&!/^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%.-]+\/?(?:\?.*)?$/.test(linked))throw Error('Enter a valid public LinkedIn profile URL (linkedin.com/in/...).');
  const selected=[...document.querySelectorAll('input[name="career_objective"]:checked')].map(x=>'• '+x.value);
  const goals=[...selected,$('#career_goals_detail').value.trim()].filter(Boolean).join('\n');
  const target=$('#salary_target').value.trim();
  const extra=[linked?'LinkedIn profile: '+linked:'',target?'Aspirational compensation target ('+$('#salary_currency').value+'): '+target:'',$('#search_instructions').value.trim()].filter(Boolean).join('\n');
  // Save using existing deployed profile columns; expanded intake columns are added only after migration.
  const values={target_roles:$('#target_roles').value,career_goals:goals,preferred_locations:$('#preferred_locations').value,salary_min:$('#salary_min').value||null,work_preference:$('#work_preference').value,exclusions:$('#exclusions').value,search_instructions:$('#search_instructions').value,linkedin_url:linked,salary_target:target||null,service_tier:$('#service_tier').value,salary_currency:$('#salary_currency').value,transferable_roles:$('#transferable_roles').value,employment_types:$('#employment_types').value,industries:$('#industries').value,relocation_preferences:$('#relocation_preferences').value,pension_preferences:$('#pension_preferences').value,min_fit_score:score,updated_at:new Date().toISOString()};
  const {data:updated,error}=await state.sb.from('customer_profiles').update(values).eq('customer_id',state.me.id).select('customer_id');
  if(error)throw error;
  const files=[...($('#referenceFiles').files||[])];
  if(files.length>10)throw Error('Upload up to 10 reference resumes at a time.');
  let uploaded=0;
  for(const file of files){
   await validatePdf(file);
   const path=state.me.id+'/reference-resumes/'+crypto.randomUUID()+'.pdf';
   const {error:e}=await state.sb.storage.from('matchpath-profiles').upload(path,file,{contentType:'application/pdf',upsert:false});
   if(e)throw Error('Saved preferences, but resume upload '+(uploaded+1)+' failed: '+errorMsg(e));
   const {error:metadataError}=await state.sb.from('reference_resumes').insert({customer_id:state.me.id,storage_path:path,original_filename:file.name.slice(0,240),size_bytes:file.size});
   if(metadataError)throw Error('File stored, but library registration failed: '+errorMsg(metadataError));
   uploaded++;
  }
  await loadData();notice('Onboarding saved.'+(uploaded?' '+uploaded+' original reference resume(s) uploaded privately.':'')+' AI career profiling has not started.');return;
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
 const top=await file.slice(0,5).text();
 if(top!=='%PDF-')throw Error('File is not a valid PDF header');
}
async function uploadDocument(appId,kind,file){
 const app=byId(state.apps,appId);if(!app||app.customer_id!==currentCustomer()||!['approved','preparing','ready','blocked'].includes(app.status))throw Error('Application cannot receive documents');
 if(!['resume','cover_letter'].includes(kind))throw Error('Invalid document type');
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
document.addEventListener('change',async e=>{
 try{
  if(e.target.id==='workspaceSwitch'&&state.account?.role==='admin'){
   state.workspaceView=e.target.value==='staff'?'staff':'admin';state.page='overview';state.selectedCustomer=null;render();return;
  }
  if(e.target.id==='previewStaffSelect'&&state.account?.role==='admin'){
   state.previewStaffId=e.target.value||null;state.selectedCustomer=null;render();return;
  }
  if(e.target.id==='customerSelect'){state.selectedCustomer=e.target.value;state.csvPreview=null;state.zipPreview=null;render();return}
  if(e.target.id==='searchCsv'){await validateCsvFile(e.target.files?.[0]);return}
  if(e.target.id==='batchZip'){await validateZip(e.target.files?.[0]);return}
  if(e.target.dataset.change==='assign'){
   const b=e.target;const {error}=await state.sb.rpc('admin_assign_staff',{p_customer:b.dataset.customer,p_staff:b.dataset.staff,p_assign:b.checked});
   if(error)throw error;await loadData(state.me);notice('Staff assignment updated.');return;
  }
 }catch(err){notice(errorMsg(err),true)}
});
$('#logoutBtn').addEventListener('click',async()=>{if(state.sb)await state.sb.auth.signOut();state.me=null;state.account=null;state.page='overview';renderAuth('login');notice('Signed out.')});
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
