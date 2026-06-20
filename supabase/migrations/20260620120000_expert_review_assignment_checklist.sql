-- REV-003 / SEC-006: enforce the canonical expert-review checklist and bind
-- reviewer decisions to the assigned reviewer (with an audited admin override).

create table if not exists public.expert_review_checklist_definitions (
  item_key text primary key,
  label text not null,
  sort_order integer not null unique,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  constraint expert_review_checklist_definitions_key_check check (length(btrim(item_key)) > 0),
  constraint expert_review_checklist_definitions_label_check check (length(btrim(label)) > 0)
);

insert into public.expert_review_checklist_definitions (item_key, label, sort_order, is_required)
values
  ('scope_and_methodology', 'Scope and methodology', 10, true),
  ('evidence_and_claims', 'Evidence and material claims', 20, true),
  ('score_and_verdict', 'Scorecard and verdict', 30, true),
  ('risks_and_mitigations', 'Risks and mitigations', 40, true),
  ('assumptions_and_limitations', 'Assumptions and limitations', 50, true),
  ('delivery_package', 'Delivery package completeness', 60, true)
on conflict (item_key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    is_required = excluded.is_required;

alter table public.expert_review_checklist_definitions enable row level security;

create policy expert_review_checklist_definitions_internal_read
  on public.expert_review_checklist_definitions
  for select to authenticated
  using (public.is_internal_user());

grant select on public.expert_review_checklist_definitions to authenticated;

alter function public.save_expert_review_packet(uuid, jsonb, jsonb)
  rename to save_expert_review_packet_unchecked;

revoke all on function public.save_expert_review_packet_unchecked(uuid, jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.save_expert_review_packet(
  p_assessment_id uuid,
  p_review jsonb,
  p_checklist jsonb default '[]'::jsonb
)
returns public.expert_reviews
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role public.app_role := public.current_app_role();
  v_status text := coalesce(nullif(p_review ->> 'status', ''), 'not_started');
  v_review_id uuid := nullif(p_review ->> 'id', '')::uuid;
  v_requested_reviewer_id uuid := nullif(p_review ->> 'reviewer_id', '')::uuid;
  v_target_reviewer_id uuid;
  v_existing public.expert_reviews;
  v_reviewer_name text;
  v_canonical_review jsonb := coalesce(p_review, '{}'::jsonb);
  v_canonical_checklist jsonb;
  v_result public.expert_reviews;
begin
  if auth.uid() is null or not public.can_author_report(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_checklist, '[]'::jsonb)) <> 'array' then
    raise exception 'Expert review checklist must be an array.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) item(value)
    where coalesce(item.value ->> 'item_key', item.value ->> 'key', '') not in (
      select d.item_key from public.expert_review_checklist_definitions d
    )
  ) then
    raise exception 'Expert review checklist contains an unknown item.' using errcode = '22023';
  end if;

  if exists (
    select coalesce(item.value ->> 'item_key', item.value ->> 'key')
    from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) item(value)
    group by coalesce(item.value ->> 'item_key', item.value ->> 'key')
    having count(*) > 1
  ) then
    raise exception 'Expert review checklist contains duplicate items.' using errcode = '22023';
  end if;

  if v_review_id is not null then
    select * into v_existing
    from public.expert_reviews r
    where r.id = v_review_id and r.site_assessment_id = p_assessment_id
    for update;
  end if;

  if v_existing.id is null then
    select * into v_existing
    from public.expert_reviews r
    where r.site_assessment_id = p_assessment_id and r.review_type = 'final_report'
    order by r.created_at desc
    limit 1
    for update;
  end if;

  if v_status in ('requested', 'in_review') then
    v_target_reviewer_id := coalesce(v_requested_reviewer_id, v_existing.reviewer_id);
    if v_target_reviewer_id is null then
      raise exception 'Assign an active reviewer before requesting review.' using errcode = '22023';
    end if;

    if v_role = 'reviewer' then
      if v_status <> 'in_review' or v_existing.id is null or v_existing.reviewer_id is distinct from auth.uid() then
        raise exception 'Only the assigned reviewer can begin this review.' using errcode = '42501';
      end if;
      v_target_reviewer_id := auth.uid();
    elsif v_role not in ('admin', 'analyst') then
      raise exception 'Only an administrator or analyst can assign a reviewer.' using errcode = '42501';
    end if;
  elsif v_status in ('changes_requested', 'approved', 'rejected') then
    if v_existing.id is null or v_existing.reviewer_id is null then
      raise exception 'A review decision requires an assigned reviewer.' using errcode = '22023';
    end if;
    if v_requested_reviewer_id is not null and v_requested_reviewer_id is distinct from v_existing.reviewer_id then
      raise exception 'Reviewer assignment cannot change while recording a decision.' using errcode = '42501';
    end if;
    if v_role = 'reviewer' and v_existing.reviewer_id is distinct from auth.uid() then
      raise exception 'Only the assigned reviewer can record this decision.' using errcode = '42501';
    elsif v_role not in ('admin', 'reviewer') then
      raise exception 'Only an administrator or the assigned reviewer can record a decision.' using errcode = '42501';
    end if;
    v_target_reviewer_id := v_existing.reviewer_id;
  else
    if v_role not in ('admin', 'analyst') then
      raise exception 'Only an administrator or analyst can change review setup.' using errcode = '42501';
    end if;
    v_target_reviewer_id := coalesce(v_requested_reviewer_id, v_existing.reviewer_id);
  end if;

  if v_target_reviewer_id is not null then
    select p.full_name into v_reviewer_name
    from public.profiles p
    where p.id = v_target_reviewer_id
      and p.is_active
      and lower(p.role::text) in ('admin', 'reviewer');

    if not found then
      raise exception 'The assigned reviewer must be an active reviewer or administrator.' using errcode = '22023';
    end if;

    v_canonical_review := jsonb_set(v_canonical_review, '{reviewer_id}', to_jsonb(v_target_reviewer_id::text), true);
    v_canonical_review := jsonb_set(
      v_canonical_review,
      '{reviewer_name}',
      to_jsonb(coalesce(nullif(btrim(v_reviewer_name), ''), 'Assigned reviewer')),
      true
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'item_key', d.item_key,
      'label', d.label,
      'sort_order', d.sort_order,
      'status', coalesce(nullif(item.value ->> 'status', ''), 'not_checked'),
      'reviewer_comment', nullif(btrim(coalesce(item.value ->> 'reviewer_comment', item.value ->> 'comment', '')), ''),
      'required_change', nullif(btrim(coalesce(item.value ->> 'required_change', '')), '')
    ) order by d.sort_order
  ), '[]'::jsonb)
  into v_canonical_checklist
  from public.expert_review_checklist_definitions d
  left join lateral (
    select supplied.value
    from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) supplied(value)
    where coalesce(supplied.value ->> 'item_key', supplied.value ->> 'key') = d.item_key
    limit 1
  ) item on true;

  if v_status = 'approved' and exists (
    select 1
    from public.expert_review_checklist_definitions d
    left join lateral (
      select supplied.value
      from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) supplied(value)
      where coalesce(supplied.value ->> 'item_key', supplied.value ->> 'key') = d.item_key
      limit 1
    ) item on true
    where d.is_required
      and coalesce(nullif(item.value ->> 'status', ''), 'not_checked') in ('fail', 'not_checked')
  ) then
    raise exception 'Approval requires every canonical checklist item to be completed without failures.' using errcode = '22023';
  end if;

  select public.save_expert_review_packet_unchecked(
    p_assessment_id,
    v_canonical_review,
    v_canonical_checklist
  ) into v_result;

  if v_status in ('changes_requested', 'approved', 'rejected') and v_role = 'admin'
     and v_result.reviewer_id is distinct from auth.uid() then
    insert into public.assessment_events (
      site_assessment_id, event_type, actor_id, actor_role, visibility,
      source_table, source_record_id, to_state, metadata
    ) values (
      p_assessment_id, 'expert_review_admin_override', auth.uid(), v_role, 'internal',
      'expert_reviews', v_result.id::text, v_status,
      jsonb_build_object('assigned_reviewer_id', v_result.reviewer_id)
    ) on conflict do nothing;
  end if;

  return v_result;
end;
$$;

revoke all on function public.save_expert_review_packet(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_expert_review_packet(uuid, jsonb, jsonb) to authenticated;

-- Report authorship and expert approval are separate duties. Reviewers retain
-- read access and the controlled review RPC above, but cannot edit or finalize
-- report content directly.
drop policy if exists report_sections_author_manage on public.assessment_report_sections;
create policy report_sections_author_manage on public.assessment_report_sections
  for all to authenticated
  using (
    public.current_app_role() in ('admin', 'analyst')
    and public.can_access_assessment(site_assessment_id)
  )
  with check (
    public.current_app_role() in ('admin', 'analyst')
    and public.can_access_assessment(site_assessment_id)
  );

drop policy if exists report_exports_author_manage on public.assessment_report_exports;
create policy report_exports_author_manage on public.assessment_report_exports
  for all to authenticated
  using (
    public.current_app_role() in ('admin', 'analyst')
    and public.can_access_assessment(site_assessment_id)
  )
  with check (
    public.current_app_role() in ('admin', 'analyst')
    and public.can_access_assessment(site_assessment_id)
  );

drop policy if exists report_claims_author_manage on public.report_claims;
create policy report_claims_author_manage on public.report_claims
  for all to authenticated
  using (
    public.current_app_role() in ('admin', 'analyst')
    and public.can_access_assessment(site_assessment_id)
  )
  with check (
    public.current_app_role() in ('admin', 'analyst')
    and public.can_access_assessment(site_assessment_id)
  );

drop policy if exists report_claim_evidence_links_author_manage on public.report_claim_evidence_links;
create policy report_claim_evidence_links_author_manage on public.report_claim_evidence_links
  for all to authenticated
  using (exists (
    select 1 from public.report_claims c
    where c.id = report_claim_id
      and public.current_app_role() in ('admin', 'analyst')
      and public.can_access_assessment(c.site_assessment_id)
  ))
  with check (exists (
    select 1 from public.report_claims c
    where c.id = report_claim_id
      and public.current_app_role() in ('admin', 'analyst')
      and public.can_access_assessment(c.site_assessment_id)
  ));

drop policy if exists report_section_finding_links_author_manage on public.report_section_finding_links;
create policy report_section_finding_links_author_manage on public.report_section_finding_links
  for all to authenticated
  using (exists (
    select 1 from public.assessment_report_sections s
    where s.id = report_section_id
      and public.current_app_role() in ('admin', 'analyst')
      and public.can_access_assessment(s.site_assessment_id)
  ))
  with check (exists (
    select 1 from public.assessment_report_sections s
    where s.id = report_section_id
      and public.current_app_role() in ('admin', 'analyst')
      and public.can_access_assessment(s.site_assessment_id)
  ));

alter function public.save_report_claim(uuid, jsonb, jsonb)
  rename to save_report_claim_unchecked;

revoke all on function public.save_report_claim_unchecked(uuid, jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.save_report_claim(
  p_assessment_id uuid,
  p_claim jsonb,
  p_links jsonb default '[]'::jsonb
)
returns public.report_claims
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_result public.report_claims;
begin
  if auth.uid() is null
     or public.current_app_role() not in ('admin', 'analyst')
     or not public.can_access_assessment(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;

  select public.save_report_claim_unchecked(p_assessment_id, p_claim, p_links)
  into v_result;
  return v_result;
end;
$$;

revoke all on function public.save_report_claim(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_report_claim(uuid, jsonb, jsonb) to authenticated;

alter function public.finalize_assessment_report(uuid, uuid)
  rename to finalize_assessment_report_unchecked;

revoke all on function public.finalize_assessment_report_unchecked(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.finalize_assessment_report(
  p_assessment_id uuid,
  p_export_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null
     or public.current_app_role() not in ('admin', 'analyst')
     or not public.can_access_assessment(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;

  select public.finalize_assessment_report_unchecked(p_assessment_id, p_export_id)
  into v_result;
  return v_result;
end;
$$;

revoke all on function public.finalize_assessment_report(uuid, uuid) from public, anon;
grant execute on function public.finalize_assessment_report(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
