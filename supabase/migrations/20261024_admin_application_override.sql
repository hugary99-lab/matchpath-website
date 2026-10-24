create or replace function public.admin_start_application(p_job uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_job public.jobs%rowtype;
  v_application public.applications%rowtype;
  v_previous_review text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select * into v_job
  from public.jobs
  where id=p_job
  for update;

  if not found then
    raise exception 'Job unavailable';
  end if;

  v_previous_review:=v_job.review_status;

  update public.jobs
  set review_status='approved',
      decided_at=now()
  where id=p_job;

  insert into public.applications(customer_id,job_id,status)
  values(v_job.customer_id,p_job,'approved')
  on conflict(job_id) do update
    set status=case
      when public.applications.status='closed' then 'approved'
      else public.applications.status
    end,
    updated_at=now()
  returning * into v_application;

  insert into public.audit_events(actor_id,customer_id,action,details)
  values(
    auth.uid(),
    v_job.customer_id,
    'admin_start_application',
    jsonb_build_object(
      'job',p_job,
      'application_id',v_application.id,
      'previous_review_status',v_previous_review,
      'qualification_status',v_job.qualification_status,
      'fit_score',v_job.fit_score
    )
  );

  insert into public.application_events(application_id,actor_id,event_type,event_note)
  values(
    v_application.id,
    auth.uid(),
    'admin_started',
    'Application started by administrator without separate customer approval.'
  );

  return jsonb_build_object(
    'application_id',v_application.id,
    'application_code',v_application.application_code,
    'status',v_application.status,
    'admin_override',true
  );
end;
$$;

revoke execute on function public.admin_start_application(uuid) from public,anon;
grant execute on function public.admin_start_application(uuid) to authenticated;
