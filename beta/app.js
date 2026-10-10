import config from './config.js';

const SCHEMA = ['schema_version','customer_id','search_run_id','searched_at','job_title','company','location','work_arrangement','salary_min','salary_max','currency','job_url','source','fit_score','qualification_status','fit_reason','concerns'];
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
const state={sb:null,me:null,account:null,accounts:[],profiles:[],assignments:[],jobs:[],apps:[],docs:[],submitted:[],runs:[],selectedCustomer:null,page:'overview',csvPreview:null,zipPreview:null,editingRole:null,loading:false};
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
function navItems(){const r=state.account.role;return r==='customer'?[['overview','Overview'],['matches','Review job matches'],['applications','My applications'],['profile','Search profile']]:r==='staff'?[['overview','Overview'],['import','Import search CSV'],['workbench','Approved applications'],['documents','Document uploads']]:[['overview','Overview'],['import','Import search CSV'],['workbench','Approved applications'],['documents','Document uploads'],['admin','Accounts & access']];}
function buildNav(){
 $('#sidebar').classList.remove('hidden');$('#logoutBtn').classList.remove('hidden');
 const r=state.account.role;
 $('#modeLabel').textContent=(r==='admin'?'Admin':r==='staff'?'Staff':'Customer')+' workspace';
 $('#signedInAs').innerHTML='<strong>'+esc(state.account.full_name||state.me.email)+'</strong><span>'+esc(state.me.email)+'</span><span>'+esc(r.toUpperCase())+'</span>';
 $('#mainNav').innerHTML=navItems().map(([id,n])=>'<button type="button" class="nav-button '+(state.page===id?'active':'')+'" data-action="navigate" data-page="'+id+'">'+esc(n)+'</button>').join('');
}
function customerPicker(){
 if(state.account.role==='customer')return '';
 const customers=state.accounts.filter(x=>x.role==='customer');
 return '<div class="field" style="min-width:min(300px,100%);margin:0"><label for="customerSelect">Working on customer</label><select id="customerSelect">'+customers.map(x=>'<option value="'+esc(x.id)+'" '+(currentCustomer()===x.id?'selected':'')+'>'+esc(x.full_name||x.email)+'</option>').join('')+'</select></div>';
}
function currentProfile(){return state.profiles.find(p=>p.customer_id===currentCustomer())}
function filteredQualifiedJobs(){const id=currentCustomer(),p=currentProfile();return matchingJobs(id).filter(j=>j.qualification_status==='Qualified'&&j.fit_score!=null&&j.fit_score>=(p?.min_fit_score??90))}
function dashboard(){
 const role=state.account.role, id=currentCustomer();
 const j=matchingJobs(id),a=matchingApps(id);
 const ready=a.filter(x=>x.status==='ready').length,submitted=a.filter(x=>x.status==='submitted').length;
 const matches=filteredQualifiedJobs();
 const pending=matches.filter(x=>x.review_status==='pending').length;
 const metrics=role==='customer'?[['Jobs screened',j.length],['To review',pending],['Applications submitted',submitted],['Qualified matches',matches.length]]:[['Jobs evaluated',j.length],['Approved queue',a.filter(x=>!['submitted','closed'].includes(x.status)).length],['Documents ready',ready],['Submitted',submitted]];
 let html=head(role==='customer'?'My career search':role==='staff'?'Staff operations':'Administration','Good '+(new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening')+', '+(state.account.full_name?.split(' ')[0]||'there'),role==='customer'?'Your job matches and application activity, in one place.':'Select a customer, import a search batch, and process only jobs they approve.',role==='customer'?'':customerPicker());
 html+='<div class="grid">'+metrics.map(([n,v])=>'<div class="card stat"><div class="name">'+n+'</div><div class="value">'+v+'</div></div>').join('')+'</div>';
 if(!id&&role!=='customer')return html+'<div class="card section empty"><strong>No assigned customers yet</strong>Admin can assign customers in Accounts & access.</div>';
 html+='<div class="section grid two"><div class="card"><h2>'+(role==='customer'?'What happens next':'Daily workflow')+'</h2><ul class="checklist">'+(role==='customer'?'<li>Review your verified job matches</li><li>Approve the jobs you want pursued</li><li>Access documents and submission updates</li>':'<li>Choose a customer and import a search CSV</li><li>Wait for their explicit job approvals</li><li>Upload job-specific resume and cover letter PDFs</li><li>Apply on employer site and record confirmation</li>')+'</ul><button class="btn" data-action="navigate" data-page="'+(role==='customer'?'matches':'import')+'">'+(role==='customer'?'Review matches':'Import search results')+'</button></div><div class="card"><h2>Recent applications</h2>'+(a.length?a.slice(0,4).map(x=>{const j=byId(state.jobs,x.job_id);return '<div class="detail space"><div><div class="title">'+esc(j?.job_title||x.application_code)+'</div><div class="sub">'+esc(j?.company||'')+'</div></div>'+statusBadge(x.status)+'</div>'}).join(''):'<div class="empty"><strong>No applications yet</strong>Approved jobs will appear here.</div>')+'</div></div>';
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
 return head('Customer portal','My search profile','These preferences guide the job search and determine what qualifies for your review.')+'<section class="card"><form id="profileForm">'+area('target_roles','Target job titles or career tracks',p.target_roles,'Include direct matches and approved transferable roles.')+area('career_goals','Career goals and priorities',p.career_goals)+area('preferred_locations','Locations and relocation preferences',p.preferred_locations)+'<div class="form-row">'+field('salary_min','Minimum salary (CAD)',p.salary_min||'','number','min="0"')+'<div class="field"><label for="work_preference">Work arrangement</label><select id="work_preference">'+['Any','Remote','Hybrid','Onsite'].map(x=>'<option '+(p.work_preference===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div></div>'+area('exclusions','Hard exclusions (employers, requirements)',p.exclusions)+area('search_instructions','Additional search instructions',p.search_instructions)+'<div class="form-row">'+field('min_fit_score','Minimum match score (0–100)',p.min_fit_score??90,'number','min="0" max="100" required')+'<div class="field"><label>Baseline resume (PDF)</label><input id="baselineFile" type="file" accept=".pdf,application/pdf"><span class="hint">Stored privately in Supabase, not GitHub.</span></div></div><div class="stack"><button class="btn" type="submit">Save search profile</button>'+(p.baseline_resume_path?'<button type="button" class="btn outline" data-action="baseline-download">Download baseline resume</button>':'')+'</div></form></section>';
}
function importPage(){
 const id=currentCustomer();let html=head('Step 1 · Staff operations','Import a job-search batch','Download the standard CSV from ChatGPT, choose its customer, validate the file, and import once. The backend prevents duplicate job records.',customerPicker());
 if(!id)return html+'<div class="card empty">No customer assigned.</div>';
 html+='<div class="warning">The CSV must contain this customer’s UUID (<code>'+esc(id)+'</code>) and a unique search_run_id. Only genuine evaluated postings should be included.</div>';
 html+='<section class="card section"><h2>1. Choose the CSV</h2><div class="file-box"><strong>Standard MatchPath search export (v1.0)</strong><p class="hint">UTF-8 CSV · exact 17 columns · up to 250 jobs per batch</p><input id="searchCsv" type="file" accept=".csv,text/csv"></div><p class="hint" style="margin-top:12px"><a href="../job_search_template.csv" target="_blank">Download standard CSV example ↗</a></p></section>';
 if(state.csvPreview){const v=state.csvPreview;html+='<section class="card section"><h2>2. Validate and commit</h2><div class="stack"><span class="badge">'+v.rows.length+' evaluated</span><span class="badge neutral">'+v.rows.filter(x=>x.qualification_status==='Qualified').length+' qualified</span><span class="pill">Run '+esc(v.runId)+'</span></div><div class="table-wrap section"><table><thead><tr><th>Employer / role</th><th>Fit score</th><th>Classification</th></tr></thead><tbody>'+v.rows.slice(0,12).map(x=>'<tr><td><strong>'+esc(x.job_title)+'</strong><small>'+esc(x.company)+'</small></td><td>'+esc(x.fit_score||'—')+'</td><td>'+esc(x.qualification_status)+'</td></tr>').join('')+'</tbody></table></div><button class="btn section" data-action="commit-csv">Import validated batch</button></section>'}
 return html;
}
function workbenchPage(){
 const id=currentCustomer(),a=matchingApps(id).filter(x=>x.status!=='closed').sort((x,y)=>x.status==='submitted'?1:y.status==='submitted'?-1:0);
 let html=head('Step 2 · Staff operations','Approved applications','Work directly from each approved job. Upload the right documents, open the original posting, submit manually, then record the confirmation.',customerPicker());
 if(!id)return html+'<div class="card empty">No customer assigned.</div>';
 if(!a.length)return html+'<div class="card empty"><strong>No approved jobs yet</strong>Wait for customer review before preparing documents.</div>';
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
 const all=state.accounts,staff=all.filter(a=>a.role==='staff'),customers=all.filter(a=>a.role==='customer');
 let html=head('Super admin','Accounts & staff assignments','Grant staff access only to designated customer accounts. The pilot can assign all ten customers to one staff member.');
 html+='<div class="grid"><div class="card stat"><div class="name">Customers</div><div class="value">'+customers.length+'</div></div><div class="card stat"><div class="name">Staff</div><div class="value">'+staff.length+'</div></div><div class="card stat"><div class="name">Assignments</div><div class="value">'+state.assignments.length+'</div></div></div>';
 html+='<section class="card section"><h2>Account roles</h2><div class="table-wrap"><table><thead><tr><th>Account</th><th>Current role</th><th>Change role</th></tr></thead><tbody>'+all.map(a=>'<tr><td><strong>'+esc(a.full_name||'Name not set')+'</strong><small>'+esc(a.email)+'</small></td><td>'+statusBadge(a.role)+'</td><td><div class="stack"><select id="role-'+esc(a.id)+'" class="form-control" style="max-width:145px" '+(a.id===state.account.id?'disabled':'')+'>'+['customer','staff','admin'].map(r=>'<option value="'+r+'" '+(a.role===r?'selected':'')+'>'+r+'</option>').join('')+'</select><button class="btn small" data-action="set-role" data-user="'+esc(a.id)+'" '+(a.id===state.account.id?'disabled':'')+'>Save role</button></div></td></tr>').join('')+'</tbody></table></div></section>';
 html+='<section class="card section"><h2>Assign staff to customers</h2><div class="table-wrap"><table><thead><tr><th>Customer</th>'+staff.map(s=>'<th>'+esc(s.full_name||s.email)+'</th>').join('')+'</tr></thead><tbody>'+customers.map(c=>'<tr><td><strong>'+esc(c.full_name||c.email)+'</strong></td>'+staff.map(s=>'<td><label><input type="checkbox" data-change="assign" data-customer="'+esc(c.id)+'" data-staff="'+esc(s.id)+'" '+(state.assignments.some(x=>x.staff_id===s.id&&x.customer_id===c.id)?'checked':'')+'> Assigned</label></td>').join('')+'</tr>').join('')+'</tbody></table></div>'+(staff.length===0?'<p class="hint">Promote an account to staff before assigning customers.</p>':'')+'</section>';
 return html;
}
function render(){
 if(!state.account)return renderAuth();
 buildNav();
 const r=state.account.role;
 if(r==='customer'&&!['overview','matches','applications','profile'].includes(state.page))state.page='overview';
 if(r!=='customer'&&!['overview','import','workbench','documents',...(r==='admin'?['admin']:[])].includes(state.page))state.page='overview';
 $('#mainNav').querySelectorAll('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page));
 const pageMap={overview:dashboard,matches:matchesPage,applications:applicationsPage,profile:profilePage,import:importPage,workbench:workbenchPage,documents:documentsPage,admin:adminPage};
 $('#page').innerHTML=pageMap[state.page]();
}
async function loadData(){
 const sb=state.sb,session=await sb.auth.getUser();
 if(session.error||!session.data.user){state.me=null;state.account=null;renderAuth();return;}
 state.me=session.data.user;
 let {data:account,error:e}=await sb.from('accounts').select('*').eq('id',state.me.id).single();
 if(e)throw e;
 state.account=account;
 const keys=['accounts','customer_profiles','staff_assignments','jobs','applications','document_versions','submitted_documents','search_runs'];
 const tables=await Promise.all(keys.map(async table=>{
   const {data,error}=await sb.from(table).select('*').limit(table==='jobs'?1000:500);
   if(error)throw error;return data||[];
 }));
 [state.accounts,state.profiles,state.assignments,state.jobs,state.apps,state.docs,state.submitted,state.runs]=tables;
 state.jobs.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 state.apps.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 state.runs.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 const cs=state.accounts.filter(a=>a.role==='customer');
 if(account.role==='customer')state.selectedCustomer=account.id;
 else if(!cs.some(x=>x.id===state.selectedCustomer))state.selectedCustomer=cs[0]?.id||null;
 render();
}
const refresh=async()=>{try{await loadData();}catch(e){notice(errorMsg(e),true)}};
function errorMsg(e){return e?.message || String(e || 'Unknown error')}
function openDialog(title,body){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=body;$('#dialog').classList.remove('hidden')}
function closeDialog(){$('#dialog').classList.add('hidden');$('#dialogBody').replaceChildren()}
async function signedPdf(path,bucket){const {data,error}=await state.sb.storage.from(bucket).createSignedUrl(path,120);if(error)throw error;window.open(data.signedUrl,'_blank','noopener,noreferrer')}
async function handleClick(target){
 const action=target.dataset.action;
 if(action==='show-login'){renderAuth('login');return}
 if(action==='show-signup'){renderAuth('signup');return}
 if(action==='navigate'){state.page=target.dataset.page;if(target.dataset.app)window.location.hash=target.dataset.app;state.csvPreview=null;state.zipPreview=null;render();return}
 if(action==='decision'){
  if(!confirm('Record this job as '+target.dataset.decision+'?'))return;
  const {error}=await state.sb.rpc('customer_decide_job',{p_job:target.dataset.job,p_decision:target.dataset.decision});
  if(error)throw error;await loadData();notice('Your decision has been recorded.');return;
 }
 if(action==='commit-csv'){
  if(!state.csvPreview)throw Error('No validated CSV selected');
  const {data,error}=await state.sb.rpc('import_search_results',{p_customer:currentCustomer(),p_run_id:state.csvPreview.runId,p_rows:state.csvPreview.rows});
  if(error)throw error;state.csvPreview=null;await loadData();notice(data?.already_imported?'Search run was already imported; nothing duplicated.':data?.new_rows+' new jobs imported, '+data?.duplicate_rows+' duplicates skipped.');return;
 }
 if(action==='status'){
  const {error}=await state.sb.rpc('staff_set_application_status',{p_application:target.dataset.app,p_status:target.dataset.status,p_reference:null,p_note:''});
  if(error)throw error;await loadData();notice('Application status updated.');return;
 }
 if(action==='submit'){
  const a=byId(state.apps,target.dataset.app);if(!a)throw Error('Application not found');
  openDialog('Confirm actual job application','<p class="warning">Only mark as submitted after completing the employer application. Record a confirmation/reference or verifiable submission acknowledgment.</p><form id="submitForm" data-app="'+esc(a.id)+'">'+field('submissionReference','Employer confirmation / reference','','text','required minlength="3"')+area('submissionNotes','Submission notes (optional)')+'<button class="btn" type="submit">Confirm submitted</button></form>');return;
 }
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
 if(type==='authForm'){
  const email=$('#authEmail').value.trim(),password=$('#authPassword').value,name=$('#authName')?.value.trim()||'';
  if(form.dataset.mode==='signup'){
   const {data,error}=await state.sb.auth.signUp({email,password,options:{data:{full_name:name}}});
   if(error)throw error;
   if(!data.session){renderAuth('login');notice('Account created. Check your email to confirm your address before signing in.');return}
  }else{
   const {error}=await state.sb.auth.signInWithPassword({email,password});if(error)throw error;
  }
  state.page='overview';await loadData();notice('Signed in securely.');return;
 }
 if(type==='profileForm'){
  const score=Number($('#min_fit_score').value);
  if(!Number.isInteger(score)||score<0||score>100)throw Error('Fit score must be between 0 and 100');
  const values={target_roles:$('#target_roles').value,career_goals:$('#career_goals').value,preferred_locations:$('#preferred_locations').value,salary_min:$('#salary_min').value||null,work_preference:$('#work_preference').value,exclusions:$('#exclusions').value,search_instructions:$('#search_instructions').value,min_fit_score:score,updated_at:new Date().toISOString()};
  const {error}=await state.sb.from('customer_profiles').update(values).eq('customer_id',state.me.id);
  if(error)throw error;
  const file=$('#baselineFile').files?.[0];
  if(file){await validatePdf(file);const path=state.me.id+'/baseline_resume.pdf';const {error:e}=await state.sb.storage.from('matchpath-profiles').upload(path,file,{contentType:'application/pdf',upsert:true});if(e)throw e;
   const {error:ee}=await state.sb.from('customer_profiles').update({baseline_resume_path:path}).eq('customer_id',state.me.id);if(ee)throw ee;}
  await loadData();notice('Search profile saved.');return;
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
  if(error)throw error;closeDialog();await loadData();notice('Application marked submitted, with exact document versions preserved.');return;
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
 if(!exactColumns(keys,SCHEMA))throw Error('CSV header does not match MatchPath Standard v1.0 (17 exact columns).');
 if(!rows.length||rows.length>250)throw Error('CSV batch must contain 1–250 rows');
 const id=currentCustomer(),run=rows[0].search_run_id;
 rows.forEach((r,i)=>{
  if(r.schema_version!=='1.0'||r.customer_id!==id||r.search_run_id!==run)throw Error('Row '+(i+2)+': customer, schema or run ID mismatch');
  if(!r.job_title.trim()||!r.company.trim()||!safeUrl(r.job_url))throw Error('Row '+(i+2)+': missing employer/title or invalid HTTPS job URL');
  if(!['Qualified','Not Qualified','Needs Verification'].includes(r.qualification_status))throw Error('Row '+(i+2)+': invalid qualification status');
  if(r.fit_score!==''&&(!/^\d+$/.test(r.fit_score)||Number(r.fit_score)>100))throw Error('Row '+(i+2)+': invalid score');
  if(r.searched_at&&!Number.isFinite(Date.parse(r.searched_at)))throw Error('Row '+(i+2)+': invalid search timestamp');
 });
 if(!run||run.length<3)throw Error('A unique search_run_id is required');
 state.csvPreview={runId:run,rows};render();notice('CSV passed format checks. Review and click Import validated batch.');
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
  if(e.target.id==='customerSelect'){state.selectedCustomer=e.target.value;state.csvPreview=null;state.zipPreview=null;render();return}
  if(e.target.id==='searchCsv'){await validateCsvFile(e.target.files?.[0]);return}
  if(e.target.id==='batchZip'){await validateZip(e.target.files?.[0]);return}
  if(e.target.dataset.change==='assign'){
   const b=e.target;const {error}=await state.sb.rpc('admin_assign_staff',{p_customer:b.dataset.customer,p_staff:b.dataset.staff,p_assign:b.checked});
   if(error)throw error;await loadData();notice('Staff assignment updated.');return;
  }
 }catch(err){notice(errorMsg(err),true)}
});
$('#logoutBtn').addEventListener('click',async()=>{if(state.sb)await state.sb.auth.signOut();state.me=null;state.account=null;state.page='overview';renderAuth('login');notice('Signed out.')});
$('#dialogClose').addEventListener('click',closeDialog);
$('#dialog').addEventListener('click',e=>{if(e.target.id==='dialog')closeDialog()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDialog()});
async function boot(){
 if(!config.supabaseUrl||!config.supabasePublishableKey){renderSetup();return;}
 try{
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.0');
  state.sb=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
  await loadData();
  state.sb.auth.onAuthStateChange((_event,session)=>{if(!session){state.me=null;state.account=null;renderAuth()}});  
 }catch(e){renderSetup();notice('Backend connection error: '+errorMsg(e),true)}
}
boot();
