create or replace function public.operator_update_customer_profile(p_customer uuid, p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor_role text;
  v_score integer;
  v_work text;
  v_currency text;
  v_service text;
  v_linkedin text;
  v_salary_min numeric;
  v_salary_target numeric;
begin
  if not public.can_work_customer(p_customer) then
    raise exception 'Not authorized for this customer';
  end if;

  select role into v_actor_role
  from public.accounts
  where id=(select auth.uid());

  if v_actor_role not in ('admin','staff') then
    raise exception 'Operator access required';
  end if;

  begin
    v_score := coalesce(nullif(p_values->>'min_fit_score',''),'90')::integer;
  exception when others then
    raise exception 'Invalid minimum fit score';
  end;
  if v_score < 0 or v_score > 100 then
    raise exception 'Minimum fit score must be between 0 and 100';
  end if;

  v_work := coalesce(nullif(p_values->>'work_preference',''),'Any');
  if v_work not in ('Any','Remote','Hybrid','Onsite') then
    raise exception 'Invalid work preference';
  end if;

  v_currency := coalesce(nullif(p_values->>'salary_currency',''),'CAD');
  if v_currency not in ('CAD','USD') then
    raise exception 'Invalid salary currency';
  end if;

  v_linkedin := trim(coalesce(p_values->>'linkedin_url',''));
  if v_linkedin <> ''
     and v_linkedin !~* '^https://(www[.])?linkedin[.]com/in/[A-Za-z0-9_%.-]+/?([?].*)?$' then
    raise exception 'Invalid LinkedIn public profile URL';
  end if;

  if nullif(trim(coalesce(p_values->>'salary_min','')),'') is null then
    v_salary_min := null;
  elsif (p_values->>'salary_min') ~ '^[0-9]+([.][0-9]+)?$' then
    v_salary_min := (p_values->>'salary_min')::numeric;
  else
    raise exception 'Invalid minimum salary';
  end if;

  if nullif(trim(coalesce(p_values->>'salary_target','')),'') is null then
    v_salary_target := null;
  elsif (p_values->>'salary_target') ~ '^[0-9]+([.][0-9]+)?$' then
    v_salary_target := (p_values->>'salary_target')::numeric;
  else
    raise exception 'Invalid target salary';
  end if;

  select service_tier into v_service
  from public.customer_profiles
  where customer_id=p_customer
  for update;

  if not found then
    raise exception 'Customer profile unavailable';
  end if;

  if v_actor_role='admin' and p_values ? 'service_tier' then
    v_service := p_values->>'service_tier';
    if v_service not in ('diy','full_service') then
      raise exception 'Invalid service tier';
    end if;
  end if;

  update public.customer_profiles
  set
    target_roles = left(coalesce(p_values->>'target_roles',''),10000),
    preferred_locations = left(coalesce(p_values->>'preferred_locations',''),5000),
    salary_min = v_salary_min,
    work_preference = v_work,
    career_goals = left(coalesce(p_values->>'career_goals',''),10000),
    search_instructions = left(coalesce(p_values->>'search_instructions',''),15000),
    exclusions = left(coalesce(p_values->>'exclusions',''),10000),
    min_fit_score = v_score,
    linkedin_url = v_linkedin,
    salary_target = v_salary_target,
    salary_currency = v_currency,
    service_tier = v_service,
    transferable_roles = left(coalesce(p_values->>'transferable_roles',''),10000),
    industries = left(coalesce(p_values->>'industries',''),8000),
    employment_types = left(coalesce(p_values->>'employment_types',''),5000),
    relocation_preferences = left(coalesce(p_values->>'relocation_preferences',''),8000),
    pension_preferences = left(coalesce(p_values->>'pension_preferences',''),8000),
    updated_at = now()
  where customer_id=p_customer;

  insert into public.audit_events(actor_id,customer_id,action,details)
  values(
    (select auth.uid()),
    p_customer,
    'operator_updated_customer_profile',
    jsonb_build_object(
      'actor_role',v_actor_role,
      'min_fit_score',v_score,
      'service_tier',v_service
    )
  );

  return jsonb_build_object(
    'ok',true,
    'customer_id',p_customer,
    'service_tier',v_service,
    'min_fit_score',v_score
  );
end;
$$;

revoke execute on function public.operator_update_customer_profile(uuid,jsonb) from public,anon;
grant execute on function public.operator_update_customer_profile(uuid,jsonb) to authenticated;
