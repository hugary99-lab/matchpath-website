alter table public.customer_profiles
  add column if not exists ai_search_prompt text,
  add column if not exists ai_prompt_updated_at timestamptz,
  add column if not exists ai_prompt_profile_updated_at timestamptz;

create or replace function public.save_ai_search_prompt(
  p_customer uuid,
  p_prompt text,
  p_profile_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_role text;
  v_current_updated_at timestamptz;
begin
  select role into v_role
  from public.accounts
  where id=(select auth.uid());

  if v_role='admin' then
    null;
  elsif v_role='staff' then
    if not public.can_work_customer(p_customer) then
      raise exception 'Not authorized for this customer';
    end if;
  elsif v_role='customer' then
    if (select auth.uid()) <> p_customer then
      raise exception 'Not authorized for this customer';
    end if;
  else
    raise exception 'Not authorized';
  end if;

  select updated_at into v_current_updated_at
  from public.customer_profiles
  where customer_id=p_customer
  for update;

  if not found then
    raise exception 'Customer profile unavailable';
  end if;

  if p_profile_updated_at is distinct from v_current_updated_at then
    raise exception 'Profile changed while AI prompt was being reviewed. Generate the prompt again.';
  end if;

  if length(trim(coalesce(p_prompt,''))) < 40 then
    raise exception 'AI search prompt is too short';
  end if;

  update public.customer_profiles
  set ai_search_prompt=left(trim(p_prompt),20000),
      ai_prompt_updated_at=now(),
      ai_prompt_profile_updated_at=v_current_updated_at
  where customer_id=p_customer;

  insert into public.audit_events(actor_id,customer_id,action,details)
  values(
    (select auth.uid()),
    p_customer,
    'ai_search_prompt_updated',
    jsonb_build_object(
      'profile_updated_at',v_current_updated_at,
      'prompt_length',length(trim(p_prompt))
    )
  );

  return jsonb_build_object(
    'ok',true,
    'customer_id',p_customer,
    'profile_updated_at',v_current_updated_at,
    'prompt_updated_at',now()
  );
end;
$$;

revoke execute on function public.save_ai_search_prompt(uuid,text,timestamptz) from public,anon;
grant execute on function public.save_ai_search_prompt(uuid,text,timestamptz) to authenticated;
