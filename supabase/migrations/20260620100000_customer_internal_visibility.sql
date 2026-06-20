-- SEC-004: keep analyst work product private until an issued report version is
-- explicitly delivered. Customer access remains available for their intake,
-- their own uploaded files, shared activity events and delivered artifacts.

drop policy if exists assignments_read on public.assessment_assignments;
create policy assignments_internal_read on public.assessment_assignments
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists suggestions_read on public.assessment_suggestions;
create policy suggestions_internal_read on public.assessment_suggestions
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists portal_search_read on public.portal_search_documents;
create policy portal_search_internal_read on public.portal_search_documents
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists history_scoped_read on public.status_history;
create policy history_internal_read on public.status_history
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists files_scoped_read on public.uploaded_files;
create policy files_scoped_read on public.uploaded_files
  for select to authenticated
  using (
    public.is_internal_user() and public.can_access_assessment(site_assessment_id)
    or uploaded_by = auth.uid() and public.can_access_assessment(site_assessment_id)
  );

drop policy if exists grid_assets_scoped_read on public.assessment_grid_assets;
create policy grid_assets_internal_read on public.assessment_grid_assets
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists evidence_scoped_read on public.evidence_sources;
create policy evidence_internal_read on public.evidence_sources
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists findings_scoped_read on public.assessment_findings;
create policy findings_internal_read on public.assessment_findings
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists finding_links_scoped_read on public.finding_evidence_links;
create policy finding_links_internal_read on public.finding_evidence_links
  for select to authenticated
  using (
    public.is_internal_user() and exists (
      select 1 from public.assessment_findings f
      where f.id = finding_id and public.can_access_assessment(f.site_assessment_id)
    )
  );

drop policy if exists scores_scoped_read on public.assessment_scores;
create policy scores_internal_read on public.assessment_scores
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists score_calculations_read on public.assessment_score_calculations;
create policy score_calculations_internal_read on public.assessment_score_calculations
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists verdicts_scoped_read on public.assessment_verdicts;
create policy verdicts_internal_read on public.assessment_verdicts
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists reviews_scoped_read on public.expert_reviews;
create policy reviews_internal_read on public.expert_reviews
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists expert_review_checklist_items_scoped_read on public.expert_review_checklist_items;
create policy expert_review_checklist_items_internal_read on public.expert_review_checklist_items
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists expert_review_decisions_scoped_read on public.expert_review_decisions;
create policy expert_review_decisions_internal_read on public.expert_review_decisions
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists checklist_responses_scoped_read on public.assessment_checklist_responses;
create policy checklist_responses_internal_read on public.assessment_checklist_responses
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists report_sections_scoped_read on public.assessment_report_sections;
create policy report_sections_internal_read on public.assessment_report_sections
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists report_exports_scoped_read on public.assessment_report_exports;
create policy report_exports_internal_read on public.assessment_report_exports
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists evidence_gaps_scoped_read on public.evidence_gaps;
create policy evidence_gaps_internal_read on public.evidence_gaps
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists report_claims_scoped_read on public.report_claims;
create policy report_claims_internal_read on public.report_claims
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

drop policy if exists report_claim_evidence_links_scoped_read on public.report_claim_evidence_links;
create policy report_claim_evidence_links_internal_read on public.report_claim_evidence_links
  for select to authenticated
  using (
    public.is_internal_user() and exists (
      select 1 from public.report_claims c
      where c.id = report_claim_id and public.can_access_assessment(c.site_assessment_id)
    )
  );

drop policy if exists report_section_finding_links_scoped_read on public.report_section_finding_links;
create policy report_section_finding_links_internal_read on public.report_section_finding_links
  for select to authenticated
  using (
    public.is_internal_user() and exists (
      select 1 from public.assessment_report_sections s
      where s.id = report_section_id and public.can_access_assessment(s.site_assessment_id)
    )
  );

-- The broad assessment-evidence policy previously let any customer member read
-- analyst-curated files. Internal users retain assessment-wide access; customers
-- can only read their own assessment-path uploads. Draft-path access remains
-- governed by customer_intake_storage_read.
drop policy if exists assessment_evidence_read on storage.objects;
create policy assessment_evidence_internal_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and public.is_internal_user()
    and public.can_access_assessment(public.storage_assessment_id(name))
  );

drop policy if exists customer_assessment_storage_read on storage.objects;
create policy customer_assessment_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and public.current_app_role() = 'customer'
    and public.storage_customer_uploader_id(name) = auth.uid()
    and public.can_access_assessment(public.storage_assessment_id(name))
  );

-- Analyst-uploaded filenames and processing metadata are internal work product.
-- Customer-upload events remain shared with the submitting organisation.
create or replace function public.record_uploaded_file_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visibility text := 'shared';
begin
  if exists (
    select 1 from public.profiles p
    where p.id = new.uploaded_by
      and p.is_active
      and lower(p.role::text) in ('admin', 'analyst', 'reviewer')
  ) then
    v_visibility := 'internal';
  end if;

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, metadata, created_at
  ) values (
    new.site_assessment_id, 'file_uploaded', new.uploaded_by, public.current_app_role(), v_visibility,
    'uploaded_files', new.id::text,
    jsonb_build_object(
      'file_name', new.file_name,
      'document_category', new.document_category,
      'processing_status', new.processing_status,
      'malware_scan_status', new.malware_scan_status
    ), new.created_at
  ) on conflict do nothing;
  return new;
end;
$$;

update public.assessment_events e
set visibility = 'internal'
from public.uploaded_files f
join public.profiles p on p.id = f.uploaded_by and p.is_active
where e.event_type = 'file_uploaded'
  and e.source_table = 'uploaded_files'
  and e.source_record_id = f.id::text
  and lower(p.role::text) in ('admin', 'analyst', 'reviewer');

revoke all on function public.record_uploaded_file_event() from public, anon, authenticated;

notify pgrst, 'reload schema';
