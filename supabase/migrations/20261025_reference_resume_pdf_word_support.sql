create or replace function public.register_reference_resume(
  p_customer uuid,
  p_storage_path text,
  p_original_filename text,
  p_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_role text;
  v_count integer;
  v_ext text;
begin
  select role into v_role
  from public.accounts
  where id=(select auth.uid());

  if v_role='admin' then
    if not public.can_access_customer(p_customer) then
      raise exception 'Not authorized for this customer';
    end if;
  elsif v_role='customer' then
    if (select auth.uid()) <> p_customer then
      raise exception 'Not authorized for this customer';
    end if;
  else
    raise exception 'Only Admin or the customer can add original/reference resumes';
  end if;

  v_ext := lower(regexp_replace(p_storage_path, '^.*[.]', ''));

  if p_storage_path is null
     or split_part(p_storage_path,'/',1) <> p_customer::text
     or p_storage_path !~ '/reference-resumes/'
     or v_ext not in ('pdf','doc','docx') then
    raise exception 'Reference resume must be PDF, DOC, or DOCX';
  end if;

  if p_size_bytes is null or p_size_bytes < 10 or p_size_bytes > 6291456 then
    raise exception 'Reference resume must be 10 bytes to 6 MB';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id='matchpath-profiles'
      and o.name=p_storage_path
  ) then
    raise exception 'Reference resume file was not found in private storage';
  end if;

  perform pg_advisory_xact_lock(hashtext('reference-resumes:'||p_customer::text));

  select count(*)::integer into v_count
  from public.reference_resumes
  where customer_id=p_customer;

  if v_count >= 5 then
    raise exception 'A customer can have at most 5 original/reference resumes';
  end if;

  insert into public.reference_resumes(customer_id,storage_path,original_filename,size_bytes)
  values(
    p_customer,
    left(p_storage_path,1000),
    left(coalesce(nullif(trim(p_original_filename),''),'resume.'||v_ext),240),
    p_size_bytes
  );

  update public.customer_profiles
  set updated_at=now()
  where customer_id=p_customer;

  insert into public.audit_events(actor_id,customer_id,action,details)
  values(
    (select auth.uid()),
    p_customer,
    'reference_resume_added',
    jsonb_build_object(
      'actor_role',v_role,
      'filename',left(coalesce(nullif(trim(p_original_filename),''),'resume.'||v_ext),240),
      'extension',v_ext,
      'resume_count',v_count+1
    )
  );

  return jsonb_build_object(
    'ok',true,
    'customer_id',p_customer,
    'resume_count',v_count+1,
    'remaining',greatest(0,4-v_count),
    'extension',v_ext
  );
end;
$$;

revoke execute on function public.register_reference_resume(uuid,text,text,bigint) from public,anon;
grant execute on function public.register_reference_resume(uuid,text,text,bigint) to authenticated;
