-- MatchPath MVP: private, role-based Supabase schema
-- Execute only in a NEW dedicated MatchPath project. Do not run on Waytold/Pickleball projects.
create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  role text not null default 'customer' check (role in ('customer','staff','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.customer_profiles (
  customer_id uuid primary key references public.accounts(id) on delete cascade,
  target_roles text not null default '',
  preferred_locations text not null default '',
  salary_min numeric,
  work_preference text not null default 'Any',
  career_goals text not null default '',
  search_instructions text not null default '',
  exclusions text not null default '',
  baseline_resume_path text,
  min_fit_score integer not null default 90 check (min_fit_score between 0 and 100),
  updated_at timestamptz not null default now()
);
create table if not exists public.staff_assignments (
  staff_id uuid not null references public.accounts(id) on delete cascade,
  customer_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (staff_id,customer_id)
);
create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.accounts(id) on delete cascade,
  external_id text not null,
  created_by uuid references public.accounts(id),
  total_rows integer not null default 0,
  new_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  created_at timestamptz not null default now(),
  unique(customer_id,external_id)
);
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.accounts(id) on delete cascade,
  search_run_id uuid references public.search_runs(id),
  canonical_key text not null,
  job_title text not null,
  company text not null,
  location text not null default '',
  work_arrangement text not null default 'Unknown',
  salary_min numeric,
  salary_max numeric,
  currency text not null default '',
  job_url text not null,
  source text not null default '',
  fit_score integer check(fit_score between 0 and 100),
  qualification_status text not null check (qualification_status in ('Qualified','Not Qualified','Needs Verification')),
  fit_reason text not null default '',
  concerns text not null default '',
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  searched_at timestamptz,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique(customer_id,canonical_key)
);
create index if not exists jobs_customer_status_idx on public.jobs(customer_id,review_status,created_at desc);
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  application_code text not null unique default ('APP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  customer_id uuid not null references public.accounts(id) on delete cascade,
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  status text not null default 'approved' check (status in ('approved','preparing','ready','in_progress','submitted','blocked','closed')),
  submission_reference text,
  submission_notes text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_customer_status_idx on public.applications(customer_id,status,created_at desc);
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  customer_id uuid not null references public.accounts(id) on delete cascade,
  kind text not null check (kind in ('resume','cover_letter')),
  version integer not null check (version > 0),
  storage_path text not null unique,
  uploaded_by uuid not null references public.accounts(id),
  created_at timestamptz not null default now(),
  unique (application_id,kind,version)
);
create table if not exists public.submitted_documents (
  application_id uuid not null references public.applications(id) on delete cascade,
  kind text not null check(kind in ('resume','cover_letter')),
  document_version_id uuid not null references public.document_versions(id),
  primary key (application_id,kind)
);
create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  actor_id uuid not null references public.accounts(id),
  event_type text not null,
  event_note text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.accounts(id),
  customer_id uuid references public.accounts(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.on_new_auth_user()
returns trigger language plpgsql security definer set search_path = public,pg_temp as $$
begin
  insert into public.accounts(id,email,full_name,role)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',''),'customer')
  on conflict(id) do nothing;
  insert into public.customer_profiles(customer_id) values(new.id)
  on conflict(customer_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created_matchpath on auth.users;
create trigger on_auth_user_created_matchpath after insert on auth.users
for each row execute function public.on_new_auth_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.accounts where id=auth.uid() and role='admin');
$$;
create or replace function public.can_work_customer(p_customer uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.is_admin() or exists (
    select 1 from public.staff_assignments s join public.accounts a on a.id=s.staff_id
    where s.staff_id=auth.uid() and s.customer_id=p_customer and a.role='staff');
$$;
create or replace function public.can_access_customer(p_customer uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select p_customer=auth.uid() or public.can_work_customer(p_customer);
$$;
create or replace function public.can_access_document_path(p_name text, p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_customer uuid; v_application uuid;
begin
  if p_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9_-]+[.]pdf$' then
    return false;
  end if;
  v_customer:=split_part(p_name,'/',1)::uuid;
  v_application:=split_part(p_name,'/',2)::uuid;
  if not exists(select 1 from public.applications where id=v_application and customer_id=v_customer) then return false; end if;
  if p_write then return public.can_work_customer(v_customer); end if;
  return public.can_access_customer(v_customer);
end; $$;

alter table public.accounts enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.staff_assignments enable row level security;
alter table public.search_runs enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.document_versions enable row level security;
alter table public.submitted_documents enable row level security;
alter table public.application_events enable row level security;
alter table public.audit_events enable row level security;

create policy "accounts read authorized" on public.accounts for select to authenticated using
 (id=auth.uid() or public.is_admin() or public.can_work_customer(id));
create policy "profiles read authorized" on public.customer_profiles for select to authenticated using(public.can_access_customer(customer_id));
create policy "profiles update owner or admin" on public.customer_profiles for update to authenticated using(customer_id=auth.uid() or public.is_admin()) with check(customer_id=auth.uid() or public.is_admin());
create policy "assignments read authorized" on public.staff_assignments for select to authenticated using (staff_id=auth.uid() or customer_id=auth.uid() or public.is_admin());
create policy "runs read authorized" on public.search_runs for select to authenticated using(public.can_access_customer(customer_id));
create policy "jobs read authorized" on public.jobs for select to authenticated using(public.can_access_customer(customer_id));
create policy "applications read authorized" on public.applications for select to authenticated using(public.can_access_customer(customer_id));
create policy "documents read authorized" on public.document_versions for select to authenticated using(public.can_access_customer(customer_id));
create policy "submitted doc read authorized" on public.submitted_documents for select to authenticated using(
 exists(select 1 from public.applications a where a.id=application_id and public.can_access_customer(a.customer_id)));
create policy "events read authorized" on public.application_events for select to authenticated using(
 exists(select 1 from public.applications a where a.id=application_id and public.can_access_customer(a.customer_id)));
create policy "audit admin read" on public.audit_events for select to authenticated using(public.is_admin());

-- Restrict privileged writes to reviewed RPCs (not unrestricted table INSERT/UPDATE).
create or replace function public.admin_set_role(p_user uuid,p_role text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 if p_role not in ('customer','staff','admin') then raise exception 'Invalid role'; end if;
 if p_user=auth.uid() and p_role<>'admin' then raise exception 'Cannot remove your own admin role'; end if;
 update public.accounts set role=p_role where id=p_user;
 if not found then raise exception 'Account not found'; end if;
 if p_role<>'staff' then delete from public.staff_assignments where staff_id=p_user; end if;
 if p_role<>'customer' then delete from public.staff_assignments where customer_id=p_user; end if;
 insert into public.audit_events(actor_id,action,details) values(auth.uid(),'set_role',jsonb_build_object('user',p_user,'role',p_role));
end; $$;
create or replace function public.admin_assign_staff(p_customer uuid,p_staff uuid,p_assign boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.accounts where id=p_customer and role='customer') then raise exception 'Invalid customer'; end if;
 if not exists(select 1 from public.accounts where id=p_staff and role='staff') then raise exception 'Invalid staff'; end if;
 if p_assign then
  insert into public.staff_assignments(customer_id,staff_id) values(p_customer,p_staff) on conflict do nothing;
 else
  delete from public.staff_assignments where customer_id=p_customer and staff_id=p_staff;
 end if;
 insert into public.audit_events(actor_id,customer_id,action,details) values(auth.uid(),p_customer,'assign_staff',jsonb_build_object('staff',p_staff,'assigned',p_assign));
end; $$;

create or replace function public.customer_decide_job(p_job uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_job public.jobs%rowtype; v_application public.applications%rowtype;
begin
 if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 select * into v_job from public.jobs where id=p_job for update;
 if not found or v_job.customer_id<>auth.uid() then raise exception 'Job unavailable'; end if;
 if v_job.qualification_status<>'Qualified' or v_job.fit_score is null or
 v_job.fit_score < (select min_fit_score from public.customer_profiles where customer_id=v_job.customer_id)
 then raise exception 'Job is not qualified for review'; end if;
 select * into v_application from public.applications where job_id=p_job;
 if p_decision='rejected' and v_application.status in ('submitted','in_progress') then
    raise exception 'Application already in progress or submitted';
 end if;
 update public.jobs set review_status=p_decision,decided_at=now() where id=p_job;
 if p_decision='approved' then
   insert into public.applications(customer_id,job_id,status) values(v_job.customer_id,p_job,'approved')
   on conflict(job_id) do update set status=case when public.applications.status='closed' then 'approved' else public.applications.status end,updated_at=now()
   returning * into v_application;
 else
   if v_application.id is not null then
    update public.applications set status='closed',updated_at=now() where id=v_application.id;
   end if;
 end if;
 insert into public.audit_events(actor_id,customer_id,action,details)
 values(auth.uid(),v_job.customer_id,'job_decision',jsonb_build_object('job',p_job,'decision',p_decision));
 return jsonb_build_object('decision',p_decision,'application_id',v_application.id);
end; $$;

create or replace function public.import_search_results(p_customer uuid,p_run_id text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_run uuid; v_record jsonb; v_created integer:=0; v_dupes integer:=0; v_total integer:=0;
 v_company text; v_url text; v_title text; v_key text; v_score integer; v_qual text; v_timestamp timestamptz;
begin
 if not public.can_work_customer(p_customer) then raise exception 'Unauthorized customer'; end if;
 if p_run_id is null or length(trim(p_run_id))<3 or length(p_run_id)>120 then raise exception 'Invalid search run ID'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>250 then raise exception 'Batch must contain 1-250 records'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_customer::text||':'||p_run_id,0));
 select id into v_run from public.search_runs where customer_id=p_customer and external_id=p_run_id;
 if found then return jsonb_build_object('already_imported',true,'new_rows',0,'duplicate_rows',0,'total_rows',0); end if;
 insert into public.search_runs(customer_id,external_id,created_by) values(p_customer,p_run_id,auth.uid()) returning id into v_run;
 for v_record in select value from jsonb_array_elements(p_rows) loop
   v_total:=v_total+1;
   if (v_record->>'customer_id') is distinct from p_customer::text or (v_record->>'search_run_id') is distinct from p_run_id or (v_record->>'schema_version') is distinct from '1.0' then
      raise exception 'Row %: wrong schema, customer or run ID',v_total;
   end if;
   v_company:=trim(coalesce(v_record->>'company',''));
   v_title:=trim(coalesce(v_record->>'job_title',''));
   v_url:=trim(coalesce(v_record->>'job_url',''));
   v_qual:=coalesce(v_record->>'qualification_status','');
   if v_company='' or v_title='' or length(v_company)>220 or length(v_title)>240 or
      v_url !~* '^https://[^[:space:]]+$' or length(v_url)>2000 or
      v_qual not in ('Qualified','Not Qualified','Needs Verification') then
      raise exception 'Row %: invalid required field or URL',v_total;
   end if;
   if nullif(v_record->>'fit_score','') is null then v_score:=null;
   elsif (v_record->>'fit_score') ~ '^([0-9]|[1-9][0-9]|100)$' then v_score:=(v_record->>'fit_score')::integer;
   else raise exception 'Row %: invalid fit score',v_total; end if;
   if nullif(v_record->>'searched_at','') is null then v_timestamp:=now();
   else v_timestamp:=(v_record->>'searched_at')::timestamptz; end if;
   v_key:=lower(regexp_replace(v_company,'[[:space:]]+',' ','g'))||'|'||lower(regexp_replace(split_part(split_part(v_url,'?',1),'#',1),'/$',''));
   insert into public.jobs(customer_id,search_run_id,canonical_key,job_title,company,location,work_arrangement,
       salary_min,salary_max,currency,job_url,source,fit_score,qualification_status,fit_reason,concerns,searched_at)
   values(p_customer,v_run,v_key,v_title,v_company,left(coalesce(v_record->>'location',''),240),
       case when v_record->>'work_arrangement' in ('Remote','Hybrid','Onsite','Unknown') then v_record->>'work_arrangement' else 'Unknown' end,
       case when coalesce(v_record->>'salary_min','') ~ '^[0-9]+([.][0-9]+)?$' then (v_record->>'salary_min')::numeric else null end,
       case when coalesce(v_record->>'salary_max','') ~ '^[0-9]+([.][0-9]+)?$' then (v_record->>'salary_max')::numeric else null end,
       left(coalesce(v_record->>'currency',''),8),v_url,left(coalesce(v_record->>'source',''),120),
       v_score,v_qual,left(coalesce(v_record->>'fit_reason',''),3000),left(coalesce(v_record->>'concerns',''),3000),v_timestamp)
   on conflict(customer_id,canonical_key) do nothing;
   if found then v_created:=v_created+1; else v_dupes:=v_dupes+1; end if;
 end loop;
 update public.search_runs set total_rows=v_total,new_rows=v_created,duplicate_rows=v_dupes where id=v_run;
 insert into public.audit_events(actor_id,customer_id,action,details)
 values(auth.uid(),p_customer,'import_jobs',jsonb_build_object('run_id',p_run_id,'new',v_created,'duplicates',v_dupes));
 return jsonb_build_object('already_imported',false,'new_rows',v_created,'duplicate_rows',v_dupes,'total_rows',v_total);
end; $$;

create or replace function public.register_document(p_application uuid,p_kind text,p_storage_path text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_customer uuid; v_version integer; v_id uuid;
begin
 select customer_id into v_customer from public.applications where id=p_application and status in ('approved','preparing','ready','blocked');
 if not found or not public.can_work_customer(v_customer) then raise exception 'Application unavailable'; end if;
 if p_kind not in ('resume','cover_letter') then raise exception 'Invalid document kind'; end if;
 if not public.can_access_document_path(p_storage_path,true) or
 p_storage_path not like (v_customer::text||'/'||p_application::text||'/%') then raise exception 'Invalid document path'; end if;
 if not exists(select 1 from storage.objects where bucket_id='matchpath-documents' and name=p_storage_path) then
   raise exception 'Uploaded object not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_application::text||p_kind,0));
 select coalesce(max(version),0)+1 into v_version from public.document_versions
 where application_id=p_application and kind=p_kind;
 insert into public.document_versions(application_id,customer_id,kind,version,storage_path,uploaded_by)
 values(p_application,v_customer,p_kind,v_version,p_storage_path,auth.uid()) returning id into v_id;
 update public.applications set status='preparing',updated_at=now() where id=p_application and status='approved';
 insert into public.audit_events(actor_id,customer_id,action,details)
 values(auth.uid(),v_customer,'document_registered',jsonb_build_object('application',p_application,'kind',p_kind,'version',v_version));
 return jsonb_build_object('id',v_id,'version',v_version);
end; $$;

create or replace function public.staff_set_application_status(p_application uuid,p_status text,p_reference text default null,p_note text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_app public.applications%rowtype; v_resume uuid; v_letter uuid;
begin
 select * into v_app from public.applications where id=p_application for update;
 if not found or not public.can_work_customer(v_app.customer_id) then raise exception 'Application unavailable'; end if;
 if (select review_status from public.jobs where id=v_app.job_id)<>'approved' then raise exception 'Customer approval revoked'; end if;
 if v_app.status='submitted' then raise exception 'Submitted applications are immutable'; end if;
 if p_status not in ('preparing','ready','in_progress','submitted','blocked','closed') then raise exception 'Invalid status'; end if;
 if p_status in ('ready','in_progress','submitted') then
   select id into v_resume from public.document_versions where application_id=p_application and kind='resume' order by version desc limit 1;
   select id into v_letter from public.document_versions where application_id=p_application and kind='cover_letter' order by version desc limit 1;
   if v_resume is null or v_letter is null then raise exception 'Both documents required'; end if;
 end if;
 if p_status='submitted' and (v_app.status not in ('ready','in_progress') or length(trim(coalesce(p_reference,'')))<3) then
   raise exception 'Ready/in-progress status and submission confirmation reference required'; end if;
 update public.applications set status=p_status,submission_reference=case when p_status='submitted' then trim(p_reference) else submission_reference end,
   submission_notes=case when p_note<>'' then left(p_note,2000) else submission_notes end,
   submitted_at=case when p_status='submitted' then now() else submitted_at end,updated_at=now()
 where id=p_application;
 if p_status='submitted' then
   insert into public.submitted_documents(application_id,kind,document_version_id)
   values(p_application,'resume',v_resume),(p_application,'cover_letter',v_letter)
   on conflict(application_id,kind) do nothing;
 end if;
 insert into public.application_events(application_id,actor_id,event_type,event_note)
 values(p_application,auth.uid(),p_status,left(coalesce(p_note,''),2000));
 return jsonb_build_object('status',p_status);
end; $$;

-- Storage policies: user files are private and never served as public bucket URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('matchpath-documents','matchpath-documents',false,6291456,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('matchpath-profiles','matchpath-profiles',false,6291456,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "staff upload approved document" on storage.objects for insert to authenticated
with check(bucket_id='matchpath-documents' and public.can_access_document_path(name,true));
create policy "authorized view document" on storage.objects for select to authenticated
using(bucket_id='matchpath-documents' and public.can_access_document_path(name,false));
create policy "customer upload own baseline" on storage.objects for insert to authenticated
with check(bucket_id='matchpath-profiles' and split_part(name,'/',1)=auth.uid()::text);
create policy "customer replace own baseline" on storage.objects for update to authenticated
using(bucket_id='matchpath-profiles' and split_part(name,'/',1)=auth.uid()::text)
with check(bucket_id='matchpath-profiles' and split_part(name,'/',1)=auth.uid()::text);
create policy "authorized view baseline" on storage.objects for select to authenticated
using(bucket_id='matchpath-profiles' and
 case when split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then public.can_access_customer(split_part(name,'/',1)::uuid) else false end);

-- Explicit baseline privileges. RLS still determines visible rows; RPCs own all other writes.
grant usage on schema public to authenticated;
grant select on public.accounts,public.customer_profiles,public.staff_assignments,
  public.search_runs,public.jobs,public.applications,public.document_versions,
  public.submitted_documents,public.application_events,public.audit_events to authenticated;
grant update on public.customer_profiles to authenticated;
revoke all on public.accounts,public.customer_profiles,public.staff_assignments,
  public.search_runs,public.jobs,public.applications,public.document_versions,
  public.submitted_documents,public.application_events,public.audit_events from anon;

-- RPC execute privileges. All RPCs have their own server-side authorization.
revoke execute on function public.on_new_auth_user() from public,anon,authenticated;
revoke execute on function public.is_admin() from public,anon;
revoke execute on function public.can_work_customer(uuid) from public,anon;
revoke execute on function public.can_access_customer(uuid) from public,anon;
revoke execute on function public.can_access_document_path(text,boolean) from public,anon;
revoke execute on function public.admin_set_role(uuid,text) from public,anon;
revoke execute on function public.admin_assign_staff(uuid,uuid,boolean) from public,anon;
revoke execute on function public.customer_decide_job(uuid,text) from public,anon;
revoke execute on function public.import_search_results(uuid,text,jsonb) from public,anon;
revoke execute on function public.register_document(uuid,text,text) from public,anon;
revoke execute on function public.staff_set_application_status(uuid,text,text,text) from public,anon;
grant execute on function public.is_admin(),public.can_work_customer(uuid),public.can_access_customer(uuid),public.can_access_document_path(text,boolean),
 public.admin_set_role(uuid,text),public.admin_assign_staff(uuid,uuid,boolean),public.customer_decide_job(uuid,text),
 public.import_search_results(uuid,text,jsonb),public.register_document(uuid,text,text),
 public.staff_set_application_status(uuid,text,text,text) to authenticated;

-- For an existing Auth user created BEFORE this migration, run once in Supabase SQL editor:
-- insert into public.accounts(id,email,role) select id,email,'customer' from auth.users on conflict do nothing;
-- insert into public.customer_profiles(customer_id) select id from public.accounts on conflict do nothing;
-- After founder signs up, bootstrap admin in SQL editor once (replace email):
-- update public.accounts set role='admin' where email='YOUR-ADMIN-EMAIL';
