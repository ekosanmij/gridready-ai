-- Allow INSERT ... RETURNING for customer-created assessments. The previous
-- SELECT policy called can_access_assessment(id), which re-read
-- site_assessments while the new row was still being inserted. Evaluate access
-- from the row's project_id instead, avoiding a same-table visibility cycle.

create or replace function public.can_access_assessment_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select auth.uid() is not null and (
    public.is_internal_user()
    or exists (
      select 1
      from public.projects p
      where p.id = p_project_id
        and public.is_organisation_member(p.organisation_id)
    )
  );
$$;

drop policy if exists assessments_scoped_read on public.site_assessments;
create policy assessments_scoped_read on public.site_assessments
  for select to authenticated
  using (public.can_access_assessment_project(project_id));

revoke all on function public.can_access_assessment_project(uuid) from public, anon;
grant execute on function public.can_access_assessment_project(uuid) to authenticated;

notify pgrst, 'reload schema';
