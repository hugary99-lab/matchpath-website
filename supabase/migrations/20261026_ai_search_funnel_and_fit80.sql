alter table public.customer_profiles
  alter column min_fit_score set default 80;

update public.customer_profiles
set min_fit_score = 80
where customer_id = '090ffc38-a4c8-4f01-9a6b-8def26ab8a8d'
  and min_fit_score = 90;

alter table public.search_runs
  add column if not exists run_type text not null default 'import',
  add column if not exists ai_reviewed_count integer not null default 0,
  add column if not exists rejected_mandatory_count integer not null default 0,
  add column if not exists below_threshold_count integer not null default 0,
  add column if not exists needs_verification_count integer not null default 0,
  add column if not exists qualified_count integer not null default 0,
  add column if not exists suppressed_existing_count integer not null default 0,
  add column if not exists returned_count integer not null default 0,
  add column if not exists ai_model text,
  add column if not exists ai_response_id text;

alter table public.search_runs drop constraint if exists search_runs_run_type_check;
alter table public.search_runs
  add constraint search_runs_run_type_check check (run_type in ('import','ai_search'));

alter table public.search_runs drop constraint if exists search_runs_ai_reviewed_count_check;
alter table public.search_runs
  add constraint search_runs_ai_reviewed_count_check check (
    ai_reviewed_count >= 0 and rejected_mandatory_count >= 0 and below_threshold_count >= 0
    and needs_verification_count >= 0 and qualified_count >= 0
    and suppressed_existing_count >= 0 and returned_count >= 0
  );

create or replace function public.import_ai_search_results_v3(
  p_customer uuid,
  p_rows jsonb,
  p_metrics jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_result jsonb;
  v_run uuid;
  v_external_id text;
  v_returned integer := 0;
  v_qualified integer := 0;
  v_needs integer := 0;
  v_rejected integer := 0;
  v_below integer := 0;
  v_suppressed integer := 0;
  v_reviewed integer := 0;
  v_model text := null;
  v_response_id text := null;
begin
  if not public.can_operate_customer(p_customer) then
    raise exception 'Unauthorized customer';
  end if;

  if jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) > 250 then
    raise exception 'AI search rows must be an array with at most 250 records';
  end if;

  if jsonb_typeof(p_metrics) <> 'object' then
    raise exception 'AI search metrics must be an object';
  end if;

  v_returned := jsonb_array_length(p_rows);

  if v_returned > 0 then
    v_result := public.import_search_results_v2(p_customer, p_rows);
    v_run := (v_result->>'internal_run_id')::uuid;
  else
    perform pg_advisory_xact_lock(hashtextextended(p_customer::text, 0));
    v_external_id :=
      'MP-' ||
      to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDD"T"HH24MISSMS"Z"') ||
      '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    insert into public.search_runs(
      customer_id, external_id, created_by, total_rows, new_rows, duplicate_rows
    )
    values(p_customer, v_external_id, auth.uid(), 0, 0, 0)
    returning id into v_run;

    v_result := jsonb_build_object(
      'schema_version', '1.0',
      'customer_id', p_customer,
      'search_run_id', v_external_id,
      'internal_run_id', v_run,
      'new_rows', 0,
      'duplicate_rows', 0,
      'total_rows', 0
    );
  end if;

  select
    count(*) filter (where value->>'qualification_status' = 'Qualified'),
    count(*) filter (where value->>'qualification_status' = 'Needs Verification')
  into v_qualified, v_needs
  from jsonb_array_elements(p_rows);

  if coalesce(p_metrics->>'rejected_mandatory_count','') ~ '^[0-9]+$' then
    v_rejected := least((p_metrics->>'rejected_mandatory_count')::integer, 100000);
  end if;
  if coalesce(p_metrics->>'below_threshold_count','') ~ '^[0-9]+$' then
    v_below := least((p_metrics->>'below_threshold_count')::integer, 100000);
  end if;
  if coalesce(p_metrics->>'suppressed_existing_count','') ~ '^[0-9]+$' then
    v_suppressed := least((p_metrics->>'suppressed_existing_count')::integer, 100000);
  end if;
  if coalesce(p_metrics->>'reviewed_count','') ~ '^[0-9]+$' then
    v_reviewed := least((p_metrics->>'reviewed_count')::integer, 100000);
  end if;

  v_reviewed := greatest(
    v_reviewed,
    v_rejected + v_below + v_suppressed + v_qualified + v_needs
  );

  v_model := nullif(left(coalesce(p_metrics->>'model',''), 160), '');
  v_response_id := nullif(left(coalesce(p_metrics->>'response_id',''), 240), '');

  update public.search_runs
  set run_type = 'ai_search',
      ai_reviewed_count = v_reviewed,
      rejected_mandatory_count = v_rejected,
      below_threshold_count = v_below,
      needs_verification_count = v_needs,
      qualified_count = v_qualified,
      suppressed_existing_count = v_suppressed,
      returned_count = v_returned,
      ai_model = v_model,
      ai_response_id = v_response_id
  where id = v_run
    and customer_id = p_customer;

  insert into public.audit_events(actor_id, customer_id, action, details)
  values(
    auth.uid(), p_customer, 'ai_search_metrics',
    jsonb_build_object(
      'external_run_id', v_result->>'search_run_id',
      'internal_run_id', v_run,
      'reviewed', v_reviewed,
      'rejected_mandatory', v_rejected,
      'below_threshold', v_below,
      'needs_verification', v_needs,
      'qualified', v_qualified,
      'suppressed_existing', v_suppressed,
      'returned', v_returned,
      'new', coalesce((v_result->>'new_rows')::integer,0),
      'duplicates', coalesce((v_result->>'duplicate_rows')::integer,0),
      'model', v_model,
      'response_id', v_response_id
    )
  );

  return v_result || jsonb_build_object(
    'run_type', 'ai_search',
    'ai_reviewed_count', v_reviewed,
    'rejected_mandatory_count', v_rejected,
    'below_threshold_count', v_below,
    'needs_verification_count', v_needs,
    'qualified_count', v_qualified,
    'suppressed_existing_count', v_suppressed,
    'returned_count', v_returned
  );
end;
$function$;

revoke all on function public.import_ai_search_results_v3(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.import_ai_search_results_v3(uuid,jsonb,jsonb) to authenticated;
