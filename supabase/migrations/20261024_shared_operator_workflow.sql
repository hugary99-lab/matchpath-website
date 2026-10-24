create or replace function public.can_operate_customer(p_customer uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select
    public.can_work_customer(p_customer)
    or (
      (select auth.uid())=p_customer
      and exists(
        select 1
        from public.accounts a
        join public.customer_profiles p on p.customer_id=a.id
        where a.id=p_customer
          and a.role='customer'
          and p.service_tier='diy'
      )
    );
$$;

create or replace function public.can_access_document_path(p_name text, p_write boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_customer uuid;
  v_application uuid;
begin
  if p_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9_-]+[.]pdf$' then return false; end if;
  v_customer:=split_part(p_name,'/',1)::uuid;
  v_application:=split_part(p_name,'/',2)::uuid;
  if not exists(select 1 from public.applications where id=v_application and customer_id=v_customer) then return false; end if;
  if p_write then return public.can_operate_customer(v_customer); end if;
  return public.can_access_customer(v_customer);
end;
$$;

create or replace function public.operator_set_job_review_status(p_job uuid,p_status text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_job public.jobs%rowtype;
  v_app public.applications%rowtype;
  v_db_status text;
  v_old_status text;
  v_actor_role text;
begin
  if p_status not in ('new','skipped','approved','rejected') then raise exception 'Invalid job status'; end if;
  select * into v_job from public.jobs where id=p_job for update;
  if not found or not public.can_operate_customer(v_job.customer_id) then raise exception 'Job unavailable'; end if;
  select role into v_actor_role from public.accounts where id=(select auth.uid());
  select * into v_app from public.applications where job_id=p_job for update;
  if v_app.id is not null and v_app.status in ('in_progress','submitted') and p_status <> 'approved' then
    raise exception 'Application is already in progress or submitted; job status cannot be changed away from Approved';
  end if;
  v_old_status:=v_job.review_status;
  v_db_status:=case when p_status='new' then 'pending' else p_status end;
  update public.jobs set review_status=v_db_status,decided_at=case when v_db_status='pending' then null else now() end where id=p_job;
  if v_db_status='approved' then
    insert into public.applications(customer_id,job_id,status)
    values(v_job.customer_id,p_job,'approved')
    on conflict(job_id) do update
      set status=case when public.applications.status='closed' then 'approved' else public.applications.status end,
          updated_at=now()
    returning * into v_app;
    insert into public.application_events(application_id,actor_id,event_type,event_note)
    values(v_app.id,(select auth.uid()),'authorized','Job authorized for application by '||coalesce(v_actor_role,'operator')||'.');
  elsif v_app.id is not null and v_app.status not in ('in_progress','submitted') then
    update public.applications set status='closed',updated_at=now() where id=v_app.id;
    insert into public.application_events(application_id,actor_id,event_type,event_note)
    values(v_app.id,(select auth.uid()),'review_changed','Application closed because job review status changed to '||p_status||'.');
  end if;
  insert into public.audit_events(actor_id,customer_id,action,details)
  values((select auth.uid()),v_job.customer_id,'operator_set_job_review_status',
    jsonb_build_object('job',p_job,'from',v_old_status,'to',v_db_status,'ui_status',p_status,'application_id',v_app.id,'actor_role',v_actor_role));
  return jsonb_build_object('job_id',p_job,'review_status',v_db_status,'application_id',v_app.id);
end;
$$;

create or replace function public.operator_apply_job_review_decisions(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_item jsonb;
  v_job uuid;
  v_status text;
  v_count integer:=0;
  v_seen uuid[]:=array[]::uuid[];
  v_customer uuid;
begin
  if jsonb_typeof(p_updates)<>'array' or jsonb_array_length(p_updates)<1 or jsonb_array_length(p_updates)>100 then raise exception 'Submit between 1 and 100 job decisions'; end if;
  for v_item in select value from jsonb_array_elements(p_updates) loop
    begin v_job:=(v_item->>'job_id')::uuid; exception when others then raise exception 'Invalid job ID'; end;
    v_status:=v_item->>'status';
    if v_status not in ('approved','skipped') then raise exception 'Each decision must be Approved or Skipped'; end if;
    if v_job=any(v_seen) then raise exception 'Duplicate job IDs are not allowed'; end if;
    v_seen:=array_append(v_seen,v_job);
    select customer_id into v_customer from public.jobs where id=v_job and review_status='pending';
    if v_customer is null or not public.can_operate_customer(v_customer) then raise exception 'Every selected job must still be To be reviewed and accessible'; end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_updates) loop
    perform public.operator_set_job_review_status((v_item->>'job_id')::uuid,v_item->>'status');
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('updated',v_count);
end;
$$;

create or replace function public.operator_bulk_set_job_statuses(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_item jsonb;
  v_job uuid;
  v_status text;
  v_count integer:=0;
  v_seen uuid[]:=array[]::uuid[];
  v_customer uuid;
begin
  if jsonb_typeof(p_updates)<>'array' or jsonb_array_length(p_updates)<1 or jsonb_array_length(p_updates)>100 then raise exception 'Submit between 1 and 100 job status updates'; end if;
  for v_item in select value from jsonb_array_elements(p_updates) loop
    begin v_job:=(v_item->>'job_id')::uuid; exception when others then raise exception 'Invalid job ID'; end;
    v_status:=v_item->>'status';
    if v_status not in ('new','approved','skipped','rejected') then raise exception 'Invalid job status'; end if;
    if v_job=any(v_seen) then raise exception 'Duplicate job IDs are not allowed'; end if;
    v_seen:=array_append(v_seen,v_job);
    select customer_id into v_customer from public.jobs where id=v_job;
    if v_customer is null or not public.can_operate_customer(v_customer) then raise exception 'Job unavailable'; end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_updates) loop
    perform public.operator_set_job_review_status((v_item->>'job_id')::uuid,v_item->>'status');
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('updated',v_count);
end;
$$;

create or replace function public.register_document(p_application uuid,p_kind text,p_storage_path text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_customer uuid; v_version integer; v_id uuid;
begin
 select customer_id into v_customer from public.applications where id=p_application and status in ('approved','preparing','ready','blocked');
 if not found or not public.can_operate_customer(v_customer) then raise exception 'Application unavailable'; end if;
 if p_kind not in ('resume','cover_letter') then raise exception 'Invalid document kind'; end if;
 if not public.can_access_document_path(p_storage_path,true) or p_storage_path not like (v_customer::text||'/'||p_application::text||'/%') then raise exception 'Invalid document path'; end if;
 if not exists(select 1 from storage.objects where bucket_id='matchpath-documents' and name=p_storage_path) then raise exception 'Uploaded object not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_application::text||p_kind,0));
 select coalesce(max(version),0)+1 into v_version from public.document_versions where application_id=p_application and kind=p_kind;
 insert into public.document_versions(application_id,customer_id,kind,version,storage_path,uploaded_by)
 values(p_application,v_customer,p_kind,v_version,p_storage_path,(select auth.uid())) returning id into v_id;
 update public.applications set status='preparing',updated_at=now() where id=p_application and status='approved';
 insert into public.audit_events(actor_id,customer_id,action,details)
 values((select auth.uid()),v_customer,'document_registered',jsonb_build_object('application',p_application,'kind',p_kind,'version',v_version));
 return jsonb_build_object('id',v_id,'version',v_version);
end;
$$;

create or replace function public.staff_set_application_status(p_application uuid,p_status text,p_reference text default null,p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_app public.applications%rowtype; v_resume uuid; v_letter uuid;
begin
 select * into v_app from public.applications where id=p_application for update;
 if not found or not public.can_operate_customer(v_app.customer_id) then raise exception 'Application unavailable'; end if;
 if (select review_status from public.jobs where id=v_app.job_id)<>'approved' then raise exception 'Application authorization revoked'; end if;
 if v_app.status='submitted' then raise exception 'Submitted applications are immutable'; end if;
 if p_status not in ('preparing','ready','in_progress','submitted','blocked','closed') then raise exception 'Invalid status'; end if;
 if p_status in ('ready','in_progress','submitted') then
   select id into v_resume from public.document_versions where application_id=p_application and kind='resume' order by version desc limit 1;
   select id into v_letter from public.document_versions where application_id=p_application and kind='cover_letter' order by version desc limit 1;
   if v_resume is null or v_letter is null then raise exception 'Both documents required'; end if;
 end if;
 if p_status='submitted' and (v_app.status not in ('ready','in_progress') or length(trim(coalesce(p_reference,'')))<3) then raise exception 'Ready/in-progress status and submission confirmation reference required'; end if;
 update public.applications set status=p_status,
   submission_reference=case when p_status='submitted' then trim(p_reference) else submission_reference end,
   submission_notes=case when p_note<>'' then left(p_note,2000) else submission_notes end,
   submitted_at=case when p_status='submitted' then now() else submitted_at end,updated_at=now()
 where id=p_application;
 if p_status='submitted' then
   insert into public.submitted_documents(application_id,kind,document_version_id)
   values(p_application,'resume',v_resume),(p_application,'cover_letter',v_letter)
   on conflict(application_id,kind) do nothing;
 end if;
 insert into public.application_events(application_id,actor_id,event_type,event_note)
 values(p_application,(select auth.uid()),p_status,left(coalesce(p_note,''),2000));
 insert into public.audit_events(actor_id,customer_id,action,details)
 values((select auth.uid()),v_app.customer_id,'application_status',jsonb_build_object('application',p_application,'status',p_status));
 return jsonb_build_object('status',p_status);
end;
$$;

create or replace function public.operator_bulk_mark_submitted(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_item jsonb;
  v_application uuid;
  v_reference text;
  v_note text;
  v_app public.applications%rowtype;
  v_count integer:=0;
  v_seen uuid[]:=array[]::uuid[];
begin
  if jsonb_typeof(p_updates)<>'array' or jsonb_array_length(p_updates)<1 or jsonb_array_length(p_updates)>50 then raise exception 'Submit between 1 and 50 applications'; end if;
  for v_item in select value from jsonb_array_elements(p_updates) loop
    begin v_application:=(v_item->>'application_id')::uuid; exception when others then raise exception 'Invalid application ID'; end;
    v_reference:=trim(coalesce(v_item->>'reference',''));
    if length(v_reference)<3 then raise exception 'Each submitted application requires a confirmation/reference'; end if;
    if v_application=any(v_seen) then raise exception 'Duplicate application IDs are not allowed'; end if;
    v_seen:=array_append(v_seen,v_application);
    select * into v_app from public.applications where id=v_application;
    if not found or not public.can_operate_customer(v_app.customer_id) then raise exception 'Application unavailable'; end if;
    if v_app.status='submitted' then raise exception 'Application already submitted'; end if;
    if not exists(select 1 from public.document_versions where application_id=v_application and kind='resume')
       or not exists(select 1 from public.document_versions where application_id=v_application and kind='cover_letter') then
      raise exception 'Resume and cover letter are required for every selected application';
    end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_updates) loop
    v_application:=(v_item->>'application_id')::uuid;
    v_reference:=trim(v_item->>'reference');
    v_note:=left(coalesce(v_item->>'note',''),2000);
    select * into v_app from public.applications where id=v_application for update;
    if v_app.status not in ('ready','in_progress') then
      perform public.staff_set_application_status(v_application,'ready',null,'Prepared for confirmed bulk submission.');
    end if;
    perform public.staff_set_application_status(v_application,'submitted',v_reference,v_note);
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('submitted',v_count);
end;
$$;

revoke execute on function public.can_operate_customer(uuid) from public,anon;
revoke execute on function public.operator_set_job_review_status(uuid,text) from public,anon;
revoke execute on function public.operator_apply_job_review_decisions(jsonb) from public,anon;
revoke execute on function public.operator_bulk_set_job_statuses(jsonb) from public,anon;
revoke execute on function public.operator_bulk_mark_submitted(jsonb) from public,anon;

grant execute on function public.operator_set_job_review_status(uuid,text) to authenticated;
grant execute on function public.operator_apply_job_review_decisions(jsonb) to authenticated;
grant execute on function public.operator_bulk_set_job_statuses(jsonb) to authenticated;
grant execute on function public.operator_bulk_mark_submitted(jsonb) to authenticated;
