/**
 * MatchPath C001 Google Sheets importer — Google Apps Script.
 * Paste into Extensions > Apps Script in the private pilot spreadsheet.
 * Run importMatchPathCsv() from the editor, or install a menu with onOpen().
 * CSV is read from a private Google Drive CSV file ID; never expose as a public web app.
 */
const MP_HEADERS = ['schema_version','searched_at','job_title','company','location','work_arrangement','salary_min','salary_max','currency','job_url','source','fit_score','qualification_status','fit_reason','concerns'];
const MP_JOB_HEADERS = ['job_key','search_run_id','discovered_at','employer','job_title','requisition_id','location','work_arrangement','salary_min','salary_max','currency','job_url','source','posting_verified_at','mandatory_status','fit_score','fit_evidence','concerns','status','approved_at','applied_at','application_confirmation','last_updated_at'];
const MP_ALLOWED = ['Qualified','Not Qualified','Needs Verification'];
function onOpen() {
  SpreadsheetApp.getUi().createMenu('MatchPath').addItem('Import search CSV','importMatchPathCsv').addToUi();
}
function importMatchPathCsv() {
  const ui=SpreadsheetApp.getUi();
  const prompt=ui.prompt('MatchPath CSV import','Enter the Google Drive file ID of the private UTF-8 CSV. This preserves all existing workflow statuses.',ui.ButtonSet.OK_CANCEL);
  if(prompt.getSelectedButton()!==ui.Button.OK)return;
  try {const csv=DriveApp.getFileById(prompt.getResponseText().trim()).getBlob().getDataAsString('UTF-8');const result=importMatchPathCsvText_(csv);ui.alert(JSON.stringify(result,null,2));}
  catch(e){ui.alert('Import rejected: '+e.message);throw e;}
}
function mpParseCsv_(input) {
  const text=String(input).replace(/^\uFEFF/,'').trim();
  const result=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"'){quoted=false;}else{field+=c;}}
    else if(c==='"'){if(field)throw Error('Invalid CSV quote');quoted=true;}
    else if(c===','){row.push(field);field='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);result.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  if(field||row.length){row.push(field);result.push(row);}
  return result;
}
function mpKey_(url) {
  let u;
  try{u=new URL(url);}catch(e){throw Error('Invalid URL: '+url);}
  if(!['https:','http:'].includes(u.protocol)||!u.hostname.includes('.'))throw Error('Invalid job URL');
  u.hash='';['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid'].forEach(k=>u.searchParams.delete(k));
  u.hostname=u.hostname.toLowerCase();return u.toString().replace(/\/$/,'');
}
function mpValidate_(text) {
  const rows=mpParseCsv_(text);
  if(!rows.length||rows[0].join('|')!==MP_HEADERS.join('|'))throw Error('CSV header mismatch');
  const seen=new Set();
  return rows.slice(1).map((cells,index)=>{
    if(cells.length!==15)throw Error('Row '+(index+2)+' has '+cells.length+' columns, expected 15');
    const r=Object.fromEntries(MP_HEADERS.map((h,i)=>[h,cells[i]]));
    if(r.schema_version!=='1.0')throw Error('Unexpected schema version on row '+(index+2));
    if(!MP_ALLOWED.includes(r.qualification_status))throw Error('Invalid qualification on row '+(index+2));
    if(!r.job_title||!r.company||!r.searched_at||isNaN(Date.parse(r.searched_at)))throw Error('Missing required field on row '+(index+2));
    if(r.fit_score!==''&&(!/^\d+$/.test(r.fit_score)||+r.fit_score>100))throw Error('Invalid score on row '+(index+2));
    const key=mpKey_(r.job_url);
    if(seen.has(key))throw Error('Duplicate job URL within incoming CSV: '+key);
    seen.add(key);r.key=key;return r;
  });
}
function mpRead_(sheet) {return sheet.getDataRange().getValues();}
function importMatchPathCsvText_(text) {
  const incoming=mpValidate_(text);\n  const runId='MP-C001-NONI-'+Utilities.formatDate(new Date(),'GMT',\"yyyyMMdd'T'HHmmss'Z'\")+'-'+Utilities.getUuid().slice(0,8);
  const lock=LockService.getDocumentLock();if(!lock.tryLock(30000))throw Error('Another import is running');
  try{
    const ss=SpreadsheetApp.getActiveSpreadsheet(),jobs=ss.getSheetByName('Jobs'),runs=ss.getSheetByName('Runs');
    if(!jobs||!runs)throw Error('Jobs/Runs tabs missing');
    const data=mpRead_(jobs),head=data[0].map(String);
    if(head.join('|')!==MP_JOB_HEADERS.join('|'))throw Error('Jobs header mismatch; refusing write');
    const existing=new Map();
    for(let i=1;i<data.length;i++){
      if(!data[i][0])continue;
      const key=mpKey_(String(data[i][11]||data[i][0]));
      if(existing.has(key))throw Error('Duplicate key already in sheet: '+key);
      existing.set(key,{row:i+1,values:data[i]});
    }
    
    const updates=[],additions=[];let duplicate=0,held=0,excluded=0;
    const now=new Date().toISOString();
    incoming.forEach(r=>{
      const old=existing.get(r.key);
      if(r.qualification_status==='Not Qualified'){excluded++;return;}
      const status=r.qualification_status==='Qualified'?'New':'Hold';
      if(status==='Hold')held++;
      const record=[r.key,runId,r.searched_at,r.company,r.job_title,'',r.location,r.work_arrangement,r.salary_min?Number(r.salary_min):'',r.salary_max?Number(r.salary_max):'',r.currency,r.job_url,r.source,'',r.qualification_status==='Qualified'?'Pass':'Hold',r.fit_score===''?'':Number(r.fit_score),r.fit_reason,r.concerns,status,'','','',now];
      if(old){
        duplicate++;
        // Preserve all existing workflow and application fields; only refresh non-status descriptive fields.
        const keep=old.values;
        [3,4,6,7,8,9,10,11,12,15,16,17].forEach(i=>{if(record[i]!==''&&record[i]!==keep[i])keep[i]=record[i];});
        keep[22]=now;updates.push({row:old.row,values:keep});
      }else additions.push(record);
    });
    // Write rows only after full CSV validation and duplicate checks.
    updates.forEach(x=>jobs.getRange(x.row,1,1,23).setValues([x.values]));
    if(additions.length)jobs.getRange(jobs.getLastRow()+1,1,additions.length,23).setValues(additions);
    runs.appendRow([runId,incoming[0]?.searched_at||now,now,incoming.length,'',incoming.filter(x=>x.qualification_status==='Qualified').length,'',duplicate,'','CSV import; customer C001-NONI and run identity assigned by MatchPath importer']);
    SpreadsheetApp.flush();
    return {received:incoming.length,inserted:additions.length,existing:duplicate,held,excluded,updated:updates.length,run_records_added:1,run_id:runId};
  }finally{lock.releaseLock();}
}
