drop policy if exists "resume owner read" on public.reference_resumes;
drop policy if exists "authorized resume read" on public.reference_resumes;
create policy "authorized resume read"
on public.reference_resumes
for select
to authenticated
using (public.can_access_customer(customer_id));

drop policy if exists "resume owner insert" on public.reference_resumes;
drop policy if exists "resume owner or admin insert" on public.reference_resumes;
create policy "resume owner or admin insert"
on public.reference_resumes
for insert
to authenticated
with check (
  (
    customer_id = (select auth.uid())
    or public.is_admin()
  )
  and exists (
    select 1
    from storage.objects o
    where o.bucket_id='matchpath-profiles'
      and o.name=reference_resumes.storage_path
  )
);

drop policy if exists "admin upload customer reference resume" on storage.objects;
create policy "admin upload customer reference resume"
on storage.objects
for insert
to authenticated
with check (
  bucket_id='matchpath-profiles'
  and public.is_admin()
  and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_access_customer((split_part(name,'/',1))::uuid)
);
