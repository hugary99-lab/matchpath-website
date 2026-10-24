create or replace function public.admin_bulk_set_job_review_status(p_jobs uuid[], p_status text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_job uuid;
  v_count integer:=0;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if p_status not in ('approved','skipped') then
    raise exception 'Bulk status must be Approved or Skipped';
  end if;

  if p_jobs is null or cardinality(p_jobs)<1 or cardinality(p_jobs)>100 then
    raise exception 'Select between 1 and 100 jobs';
  end if;

  if (select count(distinct x) from unnest(p_jobs) x) <> cardinality(p_jobs) then
    raise exception 'Duplicate job IDs are not allowed';
  end if;

  foreach v_job in array p_jobs loop
    if not exists(select 1 from public.jobs where id=v_job and review_status='pending') then
      raise exception 'Every selected job must still be To be reviewed';
    end if;

    v_result:=public.admin_set_job_review_status(v_job,p_status);
    v_count:=v_count+1;
  end loop;

  return jsonb_build_object('updated',v_count,'status',p_status);
end;
$$;

revoke execute on function public.admin_bulk_set_job_review_status(uuid[],text) from public,anon;
grant execute on function public.admin_bulk_set_job_review_status(uuid[],text) to authenticated;
