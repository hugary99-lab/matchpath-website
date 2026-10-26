-- Standing, revocable, customer-granted authorization for AI-tailored application documents.
-- A customer consents ONCE; no per-resume or per-cover-letter sign-off.
-- Separate managed-submission authorization is required for staff/admin submission.
create table if not exists public.document_authorizations (
  customer_id uuid primary key references public.customer_profiles(customer_id) on delete cascade,
  granted_by uuid not null references public.accounts(id),
  accepted_at timestamptz not null,
  disclosure_version text not null,
  disclosure_text text not null,
  allow_managed_submission boolean not null default false,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.document_authorization_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(customer_id) on delete cascade,
  actor_id uuid not null references public.accounts(id),
  action text not null check(action in ('granted','revoked')),
  disclosure_version text not null,
  disclosure_text text not null,
  allow_managed_submission boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists document_authorization_events_customer_idx
  on public.document_authorization_events(customer_id,created_at desc);
alter table public.document_authorizations enable row level security;
alter table public.document_authorization_events enable row level security;
revoke all on public.document_authorizations,public.document_authorization_events from public,anon,authenticated;
grant select on public.document_authorizations,public.document_authorization_events to authenticated;
create policy "customer authorization visible to authorized users"
  on public.document_authorizations for select to authenticated
  using (public.can_access_customer(customer_id));
create policy "authorization history visible to authorized users"
  on public.document_authorization_events for select to authenticated
  using (public.can_access_customer(customer_id));

-- Do not allow a customer to upgrade their tier or rewrite AI strategy via direct PostgREST UPDATE.
-- Admin/staff existing SECURITY DEFINER RPCs retain their authorized write paths.
revoke update on public.customer_profiles from public,anon,authenticated;
grant update (
  target_roles,preferred_locations,salary_min,work_preference,career_goals,
  search_instructions,exclusions,linkedin_url,salary_target,salary_currency,
  transferable_roles,industries,employment_types,relocation_preferences,
  pension_preferences,min_fit_score,updated_at
) on public.customer_profiles to authenticated;

create or replace function public.customer_set_document_authorization(
  p_accept boolean,
  p_allow_staff_submit boolean default false
) returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=(select auth.uid());
  v_tier text;
  v_version constant text:='2026-10-26-v1';
  v_terms constant text:='I authorize MatchPath to process my career profile, provided resume files, and candidate evidence with AI providers to prepare truthful, ATS-friendly, job-tailored resumes and cover letters. MatchPath may use these documents for jobs I authorize without asking me to approve each document. I understand that ATS compatibility does not guarantee an interview and that I may revoke this authorization for future use.';
  v_managed_terms constant text:='For full-service jobs I authorize, I separately permit authorized MatchPath staff to submit AI-tailored application documents on my behalf following a human quality check. MatchPath will record actual employer submission confirmation.';
  v_existing public.document_authorizations%rowtype;
begin
  if v_user is null or not exists(select 1 from public.accounts where id=v_user and role='customer') then
    raise exception 'Only the customer can grant or revoke this authorization';
  end if;
  select service_tier into v_tier from public.customer_profiles where customer_id=v_user for update;
  if not found then raise exception 'Customer profile unavailable'; end if;
  if p_accept is null then raise exception 'Authorization decision is required'; end if;
  if p_accept and p_allow_staff_submit and v_tier<>'full_service' then
    raise exception 'Managed submission authorization requires full-service plan';
  end if;
  select * into v_existing from public.document_authorizations where customer_id=v_user for update;
  if p_accept then
    insert into public.document_authorizations
      (customer_id,granted_by,accepted_at,disclosure_version,disclosure_text,allow_managed_submission,revoked_at,updated_at)
    values
      (v_user,v_user,now(),v_version,v_terms||case when p_allow_staff_submit then ' '||v_managed_terms else '' end,p_allow_staff_submit,null,now())
    on conflict(customer_id) do update set
      granted_by=excluded.granted_by,accepted_at=excluded.accepted_at,
      disclosure_version=excluded.disclosure_version,disclosure_text=excluded.disclosure_text,
      allow_managed_submission=excluded.allow_managed_submission,revoked_at=null,updated_at=now();
  else
    if v_existing.customer_id is null then raise exception 'No existing authorization to revoke'; end if;
    update public.document_authorizations
      set revoked_at=now(),allow_managed_submission=false,updated_at=now()
      where customer_id=v_user;
  end if;
  insert into public.document_authorization_events
    (customer_id,actor_id,action,disclosure_version,disclosure_text,allow_managed_submission)
  values
    (v_user,v_user,case when p_accept then 'granted' else 'revoked' end,
     v_version,v_terms||case when p_accept and p_allow_staff_submit then ' '||v_managed_terms else '' end,
     p_accept and p_allow_staff_submit);
  insert into public.audit_events(actor_id,customer_id,action,details)
  values(v_user,v_user,'customer_document_authorization',
    jsonb_build_object('decision',case when p_accept then 'granted' else 'revoked' end,
      'disclosure_version',v_version,'managed_submission',p_accept and p_allow_staff_submit));
  return jsonb_build_object('authorized',p_accept,'managed_submission',p_accept and p_allow_staff_submit,
    'disclosure_version',v_version);
end;
$$;
revoke execute on function public.customer_set_document_authorization(boolean,boolean) from public,anon;
grant execute on function public.customer_set_document_authorization(boolean,boolean) to authenticated;

-- Enforce authorization at the database, regardless of which UI/bulk RPC is invoked.
create or replace function public.enforce_document_authorization()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_authorization public.document_authorizations%rowtype;
  v_actor_role text;
  v_tier text;
begin
  if tg_table_name='document_versions' then
    select * into v_authorization from public.document_authorizations where customer_id=new.customer_id;
    if v_authorization.customer_id is null or v_authorization.revoked_at is not null then
      raise exception 'Customer standing authorization is required before preparing application documents';
    end if;
    return new;
  end if;
  if tg_table_name='applications' and new.status is distinct from old.status
     and new.status in ('ready','in_progress','submitted') then
    select * into v_authorization from public.document_authorizations where customer_id=new.customer_id;
    if v_authorization.customer_id is null or v_authorization.revoked_at is not null then
      raise exception 'Customer standing document authorization is required';
    end if;
    if new.status='submitted' then
      select role into v_actor_role from public.accounts where id=(select auth.uid());
      select service_tier into v_tier from public.customer_profiles where customer_id=new.customer_id;
      if v_actor_role in ('staff','admin') then
        if not v_authorization.allow_managed_submission or v_tier<>'full_service' then
          raise exception 'Customer has not authorized managed application submission';
        end if;
      elsif v_actor_role='customer' then
        if (select auth.uid())<>new.customer_id or v_tier<>'diy' then
          raise exception 'Customer can confirm only their own DIY applications';
        end if;
      else
        raise exception 'Authorized user required for submission';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_document_authorization() from public,anon,authenticated;
create trigger require_customer_document_authorization
  before insert on public.document_versions
  for each row execute function public.enforce_document_authorization();
create trigger require_authorization_on_application_transition
  before update of status on public.applications
  for each row execute function public.enforce_document_authorization();
