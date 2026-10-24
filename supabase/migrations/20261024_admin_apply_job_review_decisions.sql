create or replace function public.admin_apply_job_review_decisions(p_updates jsonb)
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
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if jsonb_typeof(p_updates)<>'array' or jsonb_array_length(p_updates)<1 or jsonb_array_length(p_updates)>100 then
    raise exception 'Submit between 1 and 100 job decisions';
  end if;

  for v_item in select value from jsonb_array_elements(p_updates) loop
    begin
      v_job:=(v_item->>'job_id')::uuid;
    exception when others then
      raise exception 'Invalid job ID';
    end;

    v_status:=v_item->>'status';
    if v_status not in ('approved','skipped') then
      raise exception 'Each decision must be Approved or Skipped';
    end if;

    if v_job=any(v_seen) then
      raise exception 'Duplicate job IDs are not allowed';
    end if;
    v_seen:=array_append(v_seen,v_job);

    if not exists(select 1 from public.jobs where id=v_job and review_status='pending') then
      raise exception 'Every selected job must still be To be reviewed';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_updates) loop
    v_job:=(v_item->>'job_id')::uuid;
    v_status:=v_item->>'status';
    perform public.admin_set_job_review_status(v_job,v_status);
    v_count:=v_count+1;
  end loop;

  return jsonb_build_object('updated',v_count);
end;
$$;

revoke execute on function public.admin_apply_job_review_decisions(jsonb) from public,anon;
grant execute on function public.admin_apply_job_review_decisions(jsonb) to authenticated;
