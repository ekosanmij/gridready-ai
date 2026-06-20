-- REP-012 / REV-004: reopen a finalized report through a controlled revision
-- workflow without mutating the immutable snapshot or issued artifacts.

create or replace function public.start_report_revision(
  p_assessment_id uuid,
  p_export_id uuid,
  p_reason text
)
returns public.assessment_report_exports
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role public.app_role := public.current_app_role();
  v_export public.assessment_report_exports;
  v_review public.expert_reviews;
  v_assessment_status text;
  v_prior_export_status text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null
     or v_role not in ('admin', 'analyst')
     or not public.can_access_assessment(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;

  if length(v_reason) < 10 then
    raise exception 'A substantive revision reason is required.' using errcode = '22023';
  end if;

  select * into v_export
  from public.assessment_report_exports e
  where e.id = p_export_id and e.site_assessment_id = p_assessment_id
  for update;

  if v_export.id is null
     or v_export.status not in ('ready_for_review', 'exported')
     or v_export.finalized_at is null
     or v_export.version_number <= 0 then
    raise exception 'Only a finalized report version can enter revision.' using errcode = '22023';
  end if;
  v_prior_export_status := v_export.status;

  select * into v_review
  from public.expert_reviews r
  where r.site_assessment_id = p_assessment_id
    and r.report_export_id = v_export.id
    and r.report_export_version = v_export.version_number
  order by r.updated_at desc
  limit 1;

  if v_role = 'analyst'
     and (v_review.id is null or v_review.status not in ('changes_requested', 'rejected')) then
    raise exception 'An analyst can start a revision only after changes are requested or the version is rejected.' using errcode = '42501';
  end if;

  select a.status::text into v_assessment_status
  from public.site_assessments a
  where a.id = p_assessment_id
  for update;

  if v_assessment_status = 'delivered' then
    raise exception 'Delivered assessments require a separately governed amendment workflow.' using errcode = '22023';
  end if;

  perform set_config('app.report_finalization_authorized', 'true', true);
  update public.assessment_report_sections
  set status = 'draft', updated_at = now()
  where site_assessment_id = p_assessment_id
    and status = 'final';

  update public.assessment_report_exports
  set status = 'analyst_edited',
      ready_for_review_at = null,
      finalized_at = null,
      finalization_snapshot = '{}'::jsonb,
      notes = concat_ws(E'\n', nullif(notes, ''), 'Revision: ' || v_reason),
      updated_at = now()
  where id = v_export.id
  returning * into v_export;
  perform set_config('app.report_finalization_authorized', '', true);

  if v_assessment_status in ('final_review', 'in_expert_review') then
    perform public.transition_assessment_status(
      p_assessment_id,
      'report_drafting',
      v_reason,
      'report_revision'
    );
  end if;

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, from_state, to_state, reason, metadata
  ) values (
    p_assessment_id, 'report_revision_started', auth.uid(), v_role, 'internal',
    'assessment_report_exports', v_export.id::text || ':v' || v_export.version_number::text,
    v_prior_export_status, 'analyst_edited',
    v_reason,
    jsonb_build_object(
      'prior_version_number', v_export.version_number,
      'expert_review_id', v_review.id,
      'expert_review_status', v_review.status
    )
  );

  return v_export;
end;
$$;

revoke all on function public.start_report_revision(uuid, uuid, text) from public, anon;
grant execute on function public.start_report_revision(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
