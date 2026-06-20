-- INT-006: submit a customer intake as one idempotent transaction. The RPC
-- persists the latest draft payload, provisions its tenant records, creates the
-- assessment, marks the draft submitted, and links every file. Any exception
-- rolls the entire statement back.

create or replace function public.submit_customer_intake_draft(
  p_draft_id uuid,
  p_request_type text,
  p_form_data jsonb,
  p_field_states jsonb default '{}'::jsonb,
  p_schema_version integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_assessment_id uuid;
  v_assessment_name text;
  v_assessment_status text;
  v_contact_id uuid;
  v_draft public.customer_intake_drafts;
  v_email text;
  v_field_summary text;
  v_form jsonb := coalesce(p_form_data, '{}'::jsonb);
  v_full_buildout_load numeric;
  v_initial_load numeric;
  v_latitude numeric;
  v_longitude numeric;
  v_organisation_id uuid;
  v_project_description text;
  v_project_id uuid;
  v_project_name text;
  v_project_type text;
  v_request_title text;
  v_required_key text;
  v_required_keys text[];
  v_score integer := 0;
  v_site_id uuid;
  v_site_name text;
  v_target_load numeric;
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then
    raise exception 'Customer authentication is required.' using errcode = '42501';
  end if;
  if p_draft_id is null then
    raise exception 'A draft identifier is required.' using errcode = '22023';
  end if;
  if p_schema_version <> 1 then
    raise exception 'This intake draft schema is not supported.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(v_form), 'null') <> 'object'
     or coalesce(jsonb_typeof(coalesce(p_field_states, '{}'::jsonb)), 'null') <> 'object' then
    raise exception 'Draft form data and field states must be JSON objects.' using errcode = '22023';
  end if;

  v_project_type := case p_request_type
    when 'portfolio-triage' then 'multi_site'
    when 'investor-underwriting' then 'investor_underwriting'
    when 'single-site-screen' then 'single_site'
    when 'existing-assessment-update' then 'single_site'
    when 'evidence-upload' then 'single_site'
    when 'report-package' then 'single_site'
    else null
  end;
  v_request_title := case p_request_type
    when 'portfolio-triage' then 'Portfolio / multi-site triage'
    when 'investor-underwriting' then 'Investor underwriting review'
    when 'single-site-screen' then 'Single-site power feasibility screen'
    when 'existing-assessment-update' then 'Update an existing assessment'
    when 'evidence-upload' then 'Evidence / data-room upload'
    when 'report-package' then 'Report package request'
    else null
  end;
  if v_project_type is null then
    raise exception 'The intake request type is not supported.' using errcode = '22023';
  end if;

  -- Serialise concurrent clicks and network retries before reading the draft.
  perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text, 0));

  select * into v_draft
  from public.customer_intake_drafts d
  where d.id = p_draft_id
  for update;

  if v_draft.id is null then
    insert into public.customer_intake_drafts (
      id, user_id, request_type, form_data, field_states, schema_version, status
    ) values (
      p_draft_id, auth.uid(), p_request_type, v_form,
      coalesce(p_field_states, '{}'::jsonb), p_schema_version, 'active'
    )
    returning * into v_draft;
  elsif v_draft.user_id is distinct from auth.uid() then
    raise exception 'The intake draft is not available.' using errcode = '42501';
  elsif v_draft.status = 'submitted' then
    if v_draft.submitted_assessment_id is null or not exists (
      select 1 from public.site_assessments a
      where a.id = v_draft.submitted_assessment_id
        and a.customer_intake_draft_id = v_draft.id
    ) then
      raise exception 'The submitted draft has an invalid assessment link.' using errcode = '23514';
    end if;
    perform public.link_customer_intake_files(v_draft.id, v_draft.submitted_assessment_id);
    return v_draft.submitted_assessment_id;
  elsif v_draft.status <> 'active' then
    raise exception 'Only an active intake draft can be submitted.' using errcode = '22023';
  elsif v_draft.request_type is distinct from p_request_type then
    raise exception 'The intake request type cannot change during submission.' using errcode = '22023';
  end if;

  update public.customer_intake_drafts
  set form_data = v_form,
      field_states = coalesce(p_field_states, '{}'::jsonb),
      schema_version = p_schema_version,
      updated_at = now()
  where id = p_draft_id;

  -- Recover safely from a partial submission created before this migration.
  select a.id into v_assessment_id
  from public.site_assessments a
  where a.customer_intake_draft_id = p_draft_id
  limit 1;

  if v_assessment_id is not null then
    update public.customer_intake_drafts
    set status = 'submitted',
        submitted_assessment_id = v_assessment_id,
        updated_at = now()
    where id = p_draft_id;
    perform public.link_customer_intake_files(p_draft_id, v_assessment_id);
    return v_assessment_id;
  end if;

  v_required_keys := case p_request_type
    when 'single-site-screen' then array['organisationName', 'contactEmail', 'projectName', 'targetLoadMw', 'desiredEnergizationDate']
    when 'portfolio-triage' then array['organisationName', 'contactEmail', 'projectName', 'projectDescription']
    when 'investor-underwriting' then array['organisationName', 'contactEmail', 'projectName', 'projectDeadline']
    when 'existing-assessment-update' then array['organisationName', 'contactEmail', 'assessmentName', 'projectDescription']
    when 'evidence-upload' then array['organisationName', 'contactEmail', 'assessmentName']
    when 'report-package' then array['organisationName', 'contactEmail', 'assessmentName']
  end;

  foreach v_required_key in array v_required_keys loop
    if nullif(btrim(coalesce(v_form ->> v_required_key, '')), '') is null then
      raise exception 'Required intake field % is missing.', v_required_key using errcode = '22023';
    end if;
  end loop;
  if p_request_type = 'single-site-screen'
     and nullif(btrim(coalesce(v_form ->> 'siteName', '')), '') is null
     and nullif(btrim(coalesce(v_form ->> 'address', '')), '') is null then
    raise exception 'A site name or address is required.' using errcode = '22023';
  end if;

  v_email := lower(btrim(coalesce(v_form ->> 'contactEmail', '')));
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid contact email is required.' using errcode = '22023';
  end if;

  -- Invalid numeric or date values raise here, before any durable submission.
  v_target_load := nullif(btrim(coalesce(v_form ->> 'targetLoadMw', '')), '')::numeric;
  v_initial_load := nullif(btrim(coalesce(v_form ->> 'initialLoadMw', '')), '')::numeric;
  v_full_buildout_load := nullif(btrim(coalesce(v_form ->> 'fullBuildoutLoadMw', '')), '')::numeric;
  v_latitude := nullif(btrim(coalesce(v_form ->> 'latitude', '')), '')::numeric;
  v_longitude := nullif(btrim(coalesce(v_form ->> 'longitude', '')), '')::numeric;
  perform nullif(btrim(coalesce(v_form ->> 'desiredEnergizationDate', '')), '')::date;
  perform nullif(btrim(coalesce(v_form ->> 'projectDeadline', '')), '')::date;

  if v_target_load is not null and v_target_load < 0.01 then
    raise exception 'Target load MW must be at least 0.01.' using errcode = '22023';
  end if;
  if coalesce(v_initial_load, 0) < 0 or coalesce(v_full_buildout_load, 0) < 0 then
    raise exception 'Load values cannot be negative.' using errcode = '22023';
  end if;
  if (v_latitude is null) <> (v_longitude is null) then
    raise exception 'Latitude and longitude must be supplied together.' using errcode = '22023';
  end if;
  if v_latitude is not null and (v_latitude < -90 or v_latitude > 90) then
    raise exception 'Latitude must be between -90 and 90.' using errcode = '22023';
  end if;
  if v_longitude is not null and (v_longitude < -180 or v_longitude > 180) then
    raise exception 'Longitude must be between -180 and 180.' using errcode = '22023';
  end if;

  v_score :=
    case when nullif(btrim(coalesce(v_form ->> 'organisationName', '')), '') is not null then 10 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'contactEmail', '')), '') is not null then 8 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'projectName', '')), '') is not null then 8 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'siteName', '')), '') is not null then 10 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'targetLoadMw', '')), '') is not null then 12 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'desiredEnergizationDate', '')), '') is not null then 12 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'address', '')), '') is not null or (v_latitude is not null and v_longitude is not null) then 10 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'assessmentName', '')), '') is not null then 5 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'address', '')), '') is not null then 5 else 0 end +
    case when v_latitude is not null then 4 else 0 end +
    case when v_longitude is not null then 4 else 0 end +
    case when v_initial_load is not null then 4 else 0 end +
    case when v_full_buildout_load is not null then 4 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'projectStage', '')), '') is not null then 4 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'landControlStatus', '')), '') is not null then 4 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'knownUtility', '')), '') is not null then 4 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'knownTsp', '')), '') is not null then 3 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'backupGenerationAssumptions', '')), '') is not null then 3 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'batteryStorageAssumptions', '')), '') is not null then 3 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'curtailmentWillingness', '')), '') is not null then 3 else 0 end +
    case when nullif(btrim(coalesce(v_form ->> 'waterCoolingNotes', '')), '') is not null then 2 else 0 end;
  v_score := least(100, v_score);

  v_project_name := coalesce(
    nullif(btrim(coalesce(v_form ->> 'projectName', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'assessmentName', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'siteName', '')), ''),
    v_request_title
  );
  v_site_name := coalesce(
    nullif(btrim(coalesce(v_form ->> 'siteName', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'address', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'assessmentName', '')), ''),
    v_project_name
  );
  v_assessment_name := coalesce(
    nullif(btrim(coalesce(v_form ->> 'assessmentName', '')), ''),
    v_site_name || ' assessment'
  );

  if nullif(btrim(coalesce(v_form ->> 'assessmentName', '')), '') is null
     and nullif(btrim(coalesce(v_form ->> 'siteName', '')), '') is null then
    v_assessment_status := 'draft';
  elsif nullif(btrim(coalesce(v_form ->> 'organisationName', '')), '') is not null
     and nullif(btrim(coalesce(v_form ->> 'contactEmail', '')), '') is not null
     and nullif(btrim(coalesce(v_form ->> 'projectName', '')), '') is not null
     and nullif(btrim(coalesce(v_form ->> 'siteName', '')), '') is not null
     and v_target_load is not null
     and nullif(btrim(coalesce(v_form ->> 'desiredEnergizationDate', '')), '') is not null
     and (nullif(btrim(coalesce(v_form ->> 'address', '')), '') is not null or (v_latitude is not null and v_longitude is not null)) then
    v_assessment_status := 'intake_complete';
  else
    v_assessment_status := 'intake_incomplete';
  end if;

  select provisioned.organisation_id into v_organisation_id
  from public.provision_customer_account(
    btrim(v_form ->> 'organisationName'),
    coalesce(nullif(btrim(coalesce(v_form ->> 'organisationType', '')), ''), 'developer')
  ) provisioned
  limit 1;

  if v_organisation_id is null then
    raise exception 'The customer organisation could not be provisioned.' using errcode = 'P0001';
  end if;

  select c.id into v_contact_id
  from public.contacts c
  where c.organisation_id = v_organisation_id
    and lower(coalesce(c.email, '')) = v_email
  order by c.is_primary desc, c.id
  limit 1;

  if v_contact_id is null then
    insert into public.contacts (
      organisation_id, name, email, phone, role_title, is_primary
    ) values (
      v_organisation_id,
      coalesce(nullif(btrim(coalesce(v_form ->> 'contactName', '')), ''), v_email),
      v_email,
      nullif(btrim(coalesce(v_form ->> 'contactPhone', '')), ''),
      nullif(btrim(coalesce(v_form ->> 'contactRoleTitle', '')), ''),
      true
    ) returning id into v_contact_id;
  end if;

  select string_agg('- ' || item.key || ': ' || item.value, E'\n' order by item.key)
  into v_field_summary
  from jsonb_each_text(coalesce(p_field_states, '{}'::jsonb)) item
  where item.value <> 'provided';

  v_project_description := concat_ws(
    E'\n\n',
    nullif(btrim(coalesce(v_form ->> 'projectDescription', '')), ''),
    'Request type: ' || v_request_title,
    case when v_field_summary is not null then 'Field states:' || E'\n' || v_field_summary end
  );

  insert into public.projects (
    organisation_id, name, project_type, status, lead_contact_id, deadline, description
  ) values (
    v_organisation_id, v_project_name, v_project_type, 'active', v_contact_id,
    nullif(btrim(coalesce(v_form ->> 'projectDeadline', '')), '')::date,
    v_project_description
  ) returning id into v_project_id;

  insert into public.sites (
    organisation_id, site_name, address, city, county, state, country,
    latitude, longitude, parcel_id
  ) values (
    v_organisation_id, v_site_name,
    nullif(btrim(coalesce(v_form ->> 'address', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'city', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'county', '')), ''),
    coalesce(nullif(btrim(coalesce(v_form ->> 'state', '')), ''), 'TX'),
    'USA', v_latitude, v_longitude,
    nullif(btrim(coalesce(v_form ->> 'parcelId', '')), '')
  ) returning id into v_site_id;

  v_assessment_id := gen_random_uuid();
  insert into public.site_assessments (
    id, project_id, site_id, assessment_name, customer_intake_draft_id,
    backup_generation_assumptions, battery_storage_assumptions,
    confidentiality_status, curtailment_willingness, desired_energization_date,
    existing_power_quote_summary, existing_studies_summary, full_buildout_load_mw,
    initial_load_mw, intake_completeness_score, known_substation_or_poi,
    known_tsp, known_utility, land_control_status, market_region, project_stage,
    status, target_load_mw, water_cooling_notes, workload_flexibility_assumptions
  ) values (
    v_assessment_id, v_project_id, v_site_id, v_assessment_name, p_draft_id,
    nullif(btrim(coalesce(v_form ->> 'backupGenerationAssumptions', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'batteryStorageAssumptions', '')), ''),
    coalesce(nullif(btrim(coalesce(v_form ->> 'confidentialityStatus', '')), ''), 'confidential'),
    nullif(btrim(coalesce(v_form ->> 'curtailmentWillingness', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'desiredEnergizationDate', '')), '')::date,
    nullif(btrim(coalesce(v_form ->> 'existingPowerQuoteSummary', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'existingStudiesSummary', '')), ''),
    v_full_buildout_load, v_initial_load, v_score,
    nullif(btrim(coalesce(v_form ->> 'knownSubstationOrPoi', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'knownTsp', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'knownUtility', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'landControlStatus', '')), ''),
    coalesce(nullif(btrim(coalesce(v_form ->> 'marketRegion', '')), ''), 'ERCOT'),
    nullif(btrim(coalesce(v_form ->> 'projectStage', '')), ''),
    v_assessment_status, v_target_load,
    nullif(btrim(coalesce(v_form ->> 'waterCoolingNotes', '')), ''),
    nullif(btrim(coalesce(v_form ->> 'workloadFlexibilityAssumptions', '')), '')
  );

  update public.customer_intake_drafts
  set organisation_id = v_organisation_id,
      status = 'submitted',
      submitted_assessment_id = v_assessment_id,
      updated_at = now()
  where id = p_draft_id;

  perform public.link_customer_intake_files(p_draft_id, v_assessment_id);

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, to_state, metadata
  ) values (
    v_assessment_id, 'customer_intake_submitted', auth.uid(), 'customer', 'shared',
    'customer_intake_drafts', p_draft_id::text, v_assessment_status,
    jsonb_build_object('request_type', p_request_type, 'intake_completeness_score', v_score)
  ) on conflict do nothing;

  return v_assessment_id;
end;
$$;

-- Customers can save active drafts, but submission and assessment creation are
-- only available through the transaction above.
drop policy if exists customer_intake_drafts_create on public.customer_intake_drafts;
create policy customer_intake_drafts_create on public.customer_intake_drafts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'active'
    and submitted_assessment_id is null
    and (organisation_id is null or public.is_organisation_member(organisation_id))
  );

drop policy if exists customer_intake_drafts_update on public.customer_intake_drafts;
create policy customer_intake_drafts_update on public.customer_intake_drafts
  for update to authenticated
  using (user_id = auth.uid() and status = 'active')
  with check (
    user_id = auth.uid()
    and status = 'active'
    and submitted_assessment_id is null
    and (organisation_id is null or public.is_organisation_member(organisation_id))
  );

drop policy if exists assessments_customer_create on public.site_assessments;

revoke all on function public.link_customer_intake_files(uuid, uuid) from authenticated;
revoke all on function public.submit_customer_intake_draft(uuid, text, jsonb, jsonb, integer)
  from public, anon;
grant execute on function public.submit_customer_intake_draft(uuid, text, jsonb, jsonb, integer)
  to authenticated;

notify pgrst, 'reload schema';
