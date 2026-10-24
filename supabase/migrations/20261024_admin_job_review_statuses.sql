alter table public.jobs
  drop constraint if exists jobs_review_status_check;

alter table public.jobs
  add constraint jobs_review_status_check
  check (review_status in ('pending','approved','rejected','skipped'));

create or replace function public.admin_set_job_review_status(p_job uuid,p_status text)
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
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if p_status not in ('new','skipped','approved','rejected') then
    raise exception 'Invalid job status';
  end if;

  select * into v_job
  from public.jobs
  where id=p_job
  for update;

  if not found then
    raise exception 'Job unavailable';
  end if;

  select * into v_app
  from public.applications
  where job_id=p_job
  for update;

  if v_app.id is not null
     and v_app.status in ('in_progress','submitted')
     and p_status <> 'approved' then
    raise exception 'Application is already in progress or submitted; job status cannot be changed away from Approved';
  end if;

  v_old_status:=v_job.review_status;
  v_db_status:=case when p_status='new' then 'pending' else p_status end;

  update public.jobs
  set review_status=v_db_status,
      decided_at=case when v_db_status='pending' then null else now() end
  where id=p_job;

  if v_db_status='approved' then
    insert into public.applications(customer_id,job_id,status)
    values(v_job.customer_id,p_job,'approved')
    on conflict(job_id) do update
      set status=case
        when public.applications.status='closed' then 'approved'
        else public.applications.status
      end,
      updated_at=now()
    returning * into v_app;

    insert into public.application_events(application_id,actor_id,event_type,event_note)
    values(v_app.id,auth.uid(),'admin_authorized','Job authorized for application by administrator.');
  elsif v_app.id is not null and v_app.status not in ('in_progress','submitted') then
    update public.applications
    set status='closed',updated_at=now()
    where id=v_app.id;

    insert into public.application_events(application_id,actor_id,event_type,event_note)
    values(v_app.id,auth.uid(),'admin_review_changed','Application closed because administrator changed the job review status to '||p_status||'.');
  end if;

  insert into public.audit_events(actor_id,customer_id,action,details)
  values(
    auth.uid(),
    v_job.customer_id,
    'admin_set_job_review_status',
    jsonb_build_object(
      'job',p_job,
      'from',v_old_status,
      'to',v_db_status,
      'ui_status',p_status,
      'application_id',v_app.id
    )
  );

  return jsonb_build_object(
    'job_id',p_job,
    'review_status',v_db_status,
    'application_id',v_app.id
  );
end;
$$;

revoke execute on function public.admin_set_job_review_status(uuid,text) from public,anon;
grant execute on function public.admin_set_job_review_status(uuid,text) to authenticated;
