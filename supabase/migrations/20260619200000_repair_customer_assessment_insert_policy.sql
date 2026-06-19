-- Repair customer assessment creation. The previous policy evaluated its
-- project/site join inline under row-level security, which could reject a
-- valid newly-created ownership chain even when every record belonged to the
-- customer's active organisation.

create or replace function public.can_submit_customer_intake_assessment(
  p_project_id uuid,
  p_site_id uuid,
  p_draft_id uuid,
  p_status text
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select auth.uid() is not null
    and public.current_app_role() = 'customer'
    and p_status in ('draft', 'intake_incomplete', 'intake_complete')
    and exists (
      select 1
      from public.customer_intake_drafts d
      join public.projects p on p.id = p_project_id
      join public.sites s on s.id = p_site_id
      where d.id = p_draft_id
        and d.user_id = auth.uid()
        and d.status = 'active'
        and public.is_organisation_member(p.organisation_id)
        and s.organisation_id = p.organisation_id
        and (d.organisation_id is null or d.organisation_id = p.organisation_id)
    );
$$;

drop policy if exists assessments_customer_create on public.site_assessments;
create policy assessments_customer_create on public.site_assessments
  for insert to authenticated
  with check (
    public.can_submit_customer_intake_assessment(
      project_id,
      site_id,
      customer_intake_draft_id,
      status::text
    )
  );

revoke all on function public.can_submit_customer_intake_assessment(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.can_submit_customer_intake_assessment(uuid, uuid, uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
