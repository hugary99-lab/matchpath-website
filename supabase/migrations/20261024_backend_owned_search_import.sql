-- MatchPath search import v2
-- System-owned metadata: schema version, customer binding, and search-run identity.
-- Search CSV contains job-search facts only, including optional verified requisition_id.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.jobs
  add column if not exists requisition_id text;

create or replace function private.extract_requisition_id(p_explicit text, p_url text)
returns text
language plpgsql
immutable
security invoker
set search_path=''
as $$
declare
  v_explicit text := nullif(btrim(coalesce(p_explicit,'')), '');
  v_url text := coalesce(p_url,'');
  v_match text[];
  v_value text;
begin
  if v_explicit is not null then
    v_value := upper(regexp_replace(v_explicit, '[[:space:]]+', '', 'g'));
    if length(v_value) between 2 and 120 then return v_value; end if;
  end if;

  v_match := regexp_match(
    v_url,
    '[?&](?:requisition(?:_?id)?|req(?:_?id)?|job(?:_?id)?|gh_jid)=([^&#]+)',
    'i'
  );
  if v_match is not null then
    v_value := upper(btrim(v_match[1]));
    if length(v_value) between 2 and 120 then return v_value; end if;
  end if;

  v_match := regexp_match(
    v_url,
    '(?:^|[/_\\-])((?:JR|REQ|REQUISITION)[_\\-]?[0-9]{3,})(?:$|[/_.?&#\\-])',
    'i'
  );
  if v_match is not null then
    v_value := upper(regexp_replace(v_match[1], '[[:space:]]+', '', 'g'));
    if length(v_value) between 2 and 120 then return v_value; end if;
  end if;

  return null;
end;
$$;

drop index if exists public.jobs_customer_company_requisition_uidx;
create unique index jobs_customer_company_requisition_uidx
on public.jobs (
  customer_id,
  lower(regexp_replace(btrim(company), '[[:space:]]+', ' ', 'g')),
  upper(regexp_replace(btrim(requisition_id), '[[:space:]]+', '', 'g'))
)
where requisition_id is not null and btrim(requisition_id) <> '';

create or replace function public.import_search_results_v2(p_customer uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_run uuid;
  v_external_id text;
  v_record jsonb;
  v_created integer := 0;
  v_dupes integer := 0;
  v_total integer := 0;
  v_company text;
  v_url text;
  v_title text;
  v_key text;
  v_req text;
  v_score integer;
  v_qual text;
  v_timestamp timestamptz;
begin
  if not public.can_work_customer(p_customer) then
    raise exception 'Unauthorized customer';
  end if;

  if jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) < 1
     or jsonb_array_length(p_rows) > 250 then
    raise exception 'Batch must contain 1-250 records';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer::text, 0));

  v_external_id :=
    'MP-' ||
    to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDD"T"HH24MISSMS"Z"') ||
    '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.search_runs(customer_id, external_id, created_by)
  values(p_customer, v_external_id, auth.uid())
  returning id into v_run;

  for v_record in select value from jsonb_array_elements(p_rows)
  loop
    v_total := v_total + 1;

    v_company := trim(coalesce(v_record->>'company', ''));
    v_title := trim(coalesce(v_record->>'job_title', ''));
    v_url := trim(coalesce(v_record->>'job_url', ''));
    v_qual := coalesce(v_record->>'qualification_status', '');
    v_req := private.extract_requisition_id(v_record->>'requisition_id', v_url);

    if v_company = ''
       or v_title = ''
       or length(v_company) > 220
       or length(v_title) > 240
       or v_url !~* '^https://[^[:space:]]+$'
       or length(v_url) > 2000
       or v_qual not in ('Qualified', 'Not Qualified', 'Needs Verification') then
      raise exception 'Row %: invalid required field or URL', v_total;
    end if;

    if nullif(v_record->>'fit_score', '') is null then
      v_score := null;
    elsif (v_record->>'fit_score') ~ '^([0-9]|[1-9][0-9]|100)$' then
      v_score := (v_record->>'fit_score')::integer;
    else
      raise exception 'Row %: invalid fit score', v_total;
    end if;

    if nullif(v_record->>'searched_at', '') is null then
      v_timestamp := now();
    else
      begin
        v_timestamp := (v_record->>'searched_at')::timestamptz;
      exception when others then
        raise exception 'Row %: invalid search timestamp', v_total;
      end;
    end if;

    v_key :=
      lower(regexp_replace(v_company, '[[:space:]]+', ' ', 'g')) || '|' ||
      lower(regexp_replace(split_part(split_part(v_url, '?', 1), '#', 1), '/$', ''));

    insert into public.jobs(
      customer_id, search_run_id, canonical_key, requisition_id,
      job_title, company, location, work_arrangement, salary_min, salary_max,
      currency, job_url, source, fit_score, qualification_status, fit_reason,
      concerns, searched_at
    )
    values(
      p_customer,
      v_run,
      v_key,
      v_req,
      v_title,
      v_company,
      left(coalesce(v_record->>'location', ''), 240),
      case
        when v_record->>'work_arrangement' in ('Remote', 'Hybrid', 'Onsite', 'Unknown')
          then v_record->>'work_arrangement'
        else 'Unknown'
      end,
      case
        when coalesce(v_record->>'salary_min', '') ~ '^[0-9]+([.][0-9]+)?$'
          then (v_record->>'salary_min')::numeric
        else null
      end,
      case
        when coalesce(v_record->>'salary_max', '') ~ '^[0-9]+([.][0-9]+)?$'
          then (v_record->>'salary_max')::numeric
        else null
      end,
      left(coalesce(v_record->>'currency', ''), 8),
      v_url,
      left(coalesce(v_record->>'source', ''), 120),
      v_score,
      v_qual,
      left(coalesce(v_record->>'fit_reason', ''), 3000),
      left(coalesce(v_record->>'concerns', ''), 3000),
      v_timestamp
    )
    on conflict do nothing;

    if found then v_created := v_created + 1;
    else v_dupes := v_dupes + 1;
    end if;
  end loop;

  update public.search_runs
  set total_rows = v_total,
      new_rows = v_created,
      duplicate_rows = v_dupes
  where id = v_run;

  insert into public.audit_events(actor_id, customer_id, action, details)
  values(
    auth.uid(),
    p_customer,
    'import_jobs',
    jsonb_build_object(
      'schema_version', '1.0',
      'external_run_id', v_external_id,
      'internal_run_id', v_run,
      'new', v_created,
      'duplicates', v_dupes,
      'requisition_dedupe', true
    )
  );

  return jsonb_build_object(
    'schema_version', '1.0',
    'customer_id', p_customer,
    'search_run_id', v_external_id,
    'internal_run_id', v_run,
    'new_rows', v_created,
    'duplicate_rows', v_dupes,
    'total_rows', v_total
  );
end;
$$;

revoke execute on function public.import_search_results_v2(uuid,jsonb) from public, anon;
grant execute on function public.import_search_results_v2(uuid,jsonb) to authenticated;
