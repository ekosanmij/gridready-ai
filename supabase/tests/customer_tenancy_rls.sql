-- Run against an isolated Supabase test database after all migrations.
-- The transaction is always rolled back; failures raise and fail the command.

begin;

insert into public.organisations (id, name, organisation_type)
values
  ('f0000000-0000-0000-0000-000000000001', 'RLS fixture organisation A', 'developer'),
  ('f0000000-0000-0000-0000-000000000002', 'RLS fixture organisation B', 'developer');

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'f1000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'rls-a@example.test',
    crypt('test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"],"organisation_id":"f0000000-0000-0000-0000-000000000001"}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f1000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'rls-b@example.test',
    crypt('test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"],"organisation_id":"f0000000-0000-0000-0000-000000000002"}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);

do $$
declare
  context_organisation uuid;
begin
  select organisation_id into context_organisation
  from public.current_account_context();

  if context_organisation is distinct from 'f0000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'Customer A did not receive its default organisation context.';
  end if;
end;
$$;

insert into public.customer_intake_drafts (
  id,
  user_id,
  organisation_id,
  request_type,
  form_data,
  field_states
)
values (
  'f7000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'single-site-screen',
  '{"siteName":"RLS fixture site A"}'::jsonb,
  '{}'::jsonb
);

insert into public.customer_intake_files (
  id,
  draft_id,
  uploaded_by,
  storage_path,
  original_filename,
  mime_type,
  size_bytes,
  checksum_sha256
)
values (
  'f8000000-0000-0000-0000-000000000001',
  'f7000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000001',
  'drafts/f1000000-0000-0000-0000-000000000001/f7000000-0000-0000-0000-000000000001/evidence.pdf',
  'evidence.pdf',
  'application/pdf',
  1024,
  repeat('a', 64)
);

insert into public.contacts (id, organisation_id, name, email, is_primary)
values (
  'f2000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'RLS fixture contact A',
  'rls-a@example.test',
  true
);

insert into public.projects (
  id,
  organisation_id,
  name,
  project_type,
  status,
  lead_contact_id
)
values (
  'f3000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'RLS fixture project A',
  'single_site',
  'active',
  'f2000000-0000-0000-0000-000000000001'
);

insert into public.sites (
  id,
  organisation_id,
  site_name,
  state,
  country
)
values (
  'f4000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'RLS fixture site A',
  'TX',
  'USA'
);

insert into public.site_assessments (
  id,
  project_id,
  site_id,
  assessment_name,
  customer_intake_draft_id,
  market_region,
  status
)
values (
  'f5000000-0000-0000-0000-000000000001',
  'f3000000-0000-0000-0000-000000000001',
  'f4000000-0000-0000-0000-000000000001',
  'RLS fixture assessment A',
  'f7000000-0000-0000-0000-000000000001',
  'ERCOT',
  'draft'
);

update public.customer_intake_drafts
set status = 'submitted',
    submitted_assessment_id = 'f5000000-0000-0000-0000-000000000001'
where id = 'f7000000-0000-0000-0000-000000000001';

insert into public.uploaded_files (
  site_assessment_id,
  file_name,
  document_category,
  storage_path,
  uploaded_by,
  original_filename,
  mime_type,
  size_bytes,
  checksum_sha256,
  customer_intake_file_id
)
values (
  'f5000000-0000-0000-0000-000000000001',
  'evidence.pdf',
  'customer_evidence',
  'drafts/f1000000-0000-0000-0000-000000000001/f7000000-0000-0000-0000-000000000001/evidence.pdf',
  'f1000000-0000-0000-0000-000000000001',
  'evidence.pdf',
  'application/pdf',
  1024,
  repeat('a', 64),
  'f8000000-0000-0000-0000-000000000001'
);

insert into public.status_history (
  id,
  site_assessment_id,
  from_status,
  to_status,
  reason
)
values (
  'f6000000-0000-0000-0000-000000000001',
  'f5000000-0000-0000-0000-000000000001',
  null,
  'draft',
  'RLS fixture creation'
);

-- Seed analyst work product outside the customer role, then prove that the
-- customer can still access the request without seeing internal analysis.
reset role;

insert into public.evidence_sources (
  id,
  site_assessment_id,
  title,
  source_type,
  confidence_level
)
values (
  'f9000000-0000-0000-0000-000000000001',
  'f5000000-0000-0000-0000-000000000001',
  'Internal RLS fixture evidence',
  'analyst_derived',
  'medium'
);

insert into public.assessment_findings (
  id,
  site_assessment_id,
  module_key,
  title,
  finding_type,
  risk_level,
  confidence_level,
  statement,
  status
)
values (
  'fa000000-0000-0000-0000-000000000001',
  'f5000000-0000-0000-0000-000000000001',
  'power_feasibility',
  'Internal RLS fixture finding',
  'finding',
  'high',
  'medium',
  'Customer must not see this analyst finding before delivery.',
  'open'
);

set local role authenticated;

insert into public.customer_intake_drafts (
  id, user_id, organisation_id, request_type, form_data, field_states
) values (
  'fb000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'single-site-screen',
  '{
    "organisationName":"RLS fixture organisation A",
    "organisationType":"developer",
    "contactEmail":"rls-a@example.test",
    "projectName":"Atomic fixture project",
    "siteName":"Atomic fixture site",
    "address":"1 Atomic Way",
    "state":"TX",
    "targetLoadMw":"25",
    "desiredEnergizationDate":"2029-01-01"
  }'::jsonb,
  '{"siteName":"provided"}'::jsonb
);

insert into public.customer_intake_files (
  id, draft_id, uploaded_by, storage_path, original_filename,
  mime_type, size_bytes, checksum_sha256
) values (
  'fc000000-0000-0000-0000-000000000001',
  'fb000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000001',
  'drafts/f1000000-0000-0000-0000-000000000001/fb000000-0000-0000-0000-000000000001/evidence.pdf',
  'atomic-evidence.pdf',
  'application/pdf',
  2048,
  repeat('c', 64)
);

insert into public.customer_intake_drafts (
  id, user_id, organisation_id, request_type, form_data, field_states
) values (
  'fb000000-0000-0000-0000-000000000002',
  'f1000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'single-site-screen',
  '{}'::jsonb,
  '{}'::jsonb
);

do $$
declare
  first_assessment_id uuid;
  retry_assessment_id uuid;
  failed boolean := false;
  visible_count integer;
begin
  select public.submit_customer_intake_draft(
    'fb000000-0000-0000-0000-000000000001',
    'single-site-screen',
    '{
      "organisationName":"RLS fixture organisation A",
      "organisationType":"developer",
      "contactEmail":"rls-a@example.test",
      "projectName":"Atomic fixture project",
      "siteName":"Atomic fixture site",
      "address":"1 Atomic Way",
      "state":"TX",
      "targetLoadMw":"25",
      "desiredEnergizationDate":"2029-01-01"
    }'::jsonb,
    '{"siteName":"provided"}'::jsonb,
    1
  ) into first_assessment_id;

  select public.submit_customer_intake_draft(
    'fb000000-0000-0000-0000-000000000001',
    'single-site-screen',
    '{}'::jsonb,
    '{}'::jsonb,
    1
  ) into retry_assessment_id;

  if first_assessment_id is null or retry_assessment_id is distinct from first_assessment_id then
    raise exception 'Atomic intake retry did not return the original assessment.';
  end if;

  select count(*) into visible_count
  from public.site_assessments
  where customer_intake_draft_id = 'fb000000-0000-0000-0000-000000000001';
  if visible_count <> 1 then
    raise exception 'Atomic intake retry created duplicate assessments.';
  end if;

  if not exists (
    select 1 from public.customer_intake_drafts d
    where d.id = 'fb000000-0000-0000-0000-000000000001'
      and d.status = 'submitted'
      and d.submitted_assessment_id = first_assessment_id
  ) then
    raise exception 'Atomic intake did not mark the draft submitted.';
  end if;

  if not exists (
    select 1 from public.uploaded_files f
    where f.customer_intake_file_id = 'fc000000-0000-0000-0000-000000000001'
      and f.site_assessment_id = first_assessment_id
      and f.malware_scan_status = 'pending'
  ) then
    raise exception 'Atomic intake did not link the pending upload.';
  end if;

  begin
    perform public.submit_customer_intake_draft(
      'fb000000-0000-0000-0000-000000000002',
      'single-site-screen',
      '{
        "organisationName":"RLS fixture organisation A",
        "contactEmail":"rls-a@example.test",
        "projectName":"Invalid atomic fixture",
        "siteName":"Invalid atomic site",
        "targetLoadMw":"not-a-number",
        "desiredEnergizationDate":"2029-01-01"
      }'::jsonb,
      '{}'::jsonb,
      1
    );
  exception when others then
    failed := true;
  end;

  if not failed then
    raise exception 'Invalid atomic intake unexpectedly succeeded.';
  end if;
  if not exists (
    select 1 from public.customer_intake_drafts d
    where d.id = 'fb000000-0000-0000-0000-000000000002'
      and d.status = 'active'
      and d.submitted_assessment_id is null
  ) or exists (
    select 1 from public.site_assessments a
    where a.customer_intake_draft_id = 'fb000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'Failed atomic intake left partial submission state.';
  end if;
end;
$$;

do $$
declare
  denied boolean := false;
  visible_count integer;
begin
  select count(*) into visible_count
  from public.organisations
  where id = 'f0000000-0000-0000-0000-000000000002';

  if visible_count <> 0 then
    raise exception 'Customer A can read organisation B.';
  end if;

  select count(*) into visible_count
  from public.evidence_sources
  where site_assessment_id = 'f5000000-0000-0000-0000-000000000001';

  if visible_count <> 0 then
    raise exception 'Customer A can read internal evidence before delivery.';
  end if;

  select count(*) into visible_count
  from public.assessment_findings
  where site_assessment_id = 'f5000000-0000-0000-0000-000000000001';

  if visible_count <> 0 then
    raise exception 'Customer A can read internal findings before delivery.';
  end if;

  update public.customer_intake_files
  set malware_scan_status = 'clean',
      processing_status = 'ready',
      checksum_sha256 = repeat('b', 64)
  where id = 'f8000000-0000-0000-0000-000000000001';

  if exists (
    select 1 from public.customer_intake_files
    where id = 'f8000000-0000-0000-0000-000000000001'
      and (malware_scan_status <> 'pending' or checksum_sha256 <> repeat('a', 64))
  ) then
    raise exception 'Customer A changed intake-file security metadata.';
  end if;

  update public.uploaded_files
  set malware_scan_status = 'clean',
      processing_status = 'ready',
      checksum_sha256 = repeat('b', 64)
  where customer_intake_file_id = 'f8000000-0000-0000-0000-000000000001';

  if exists (
    select 1 from public.uploaded_files
    where customer_intake_file_id = 'f8000000-0000-0000-0000-000000000001'
      and (malware_scan_status <> 'pending' or checksum_sha256 <> repeat('a', 64))
  ) then
    raise exception 'Customer A changed linked-file security metadata.';
  end if;

  denied := false;
  begin
    insert into public.customer_intake_drafts (
      user_id,
      organisation_id,
      request_type
    )
    values (
      'f1000000-0000-0000-0000-000000000001',
      'f0000000-0000-0000-0000-000000000002',
      'single-site-screen'
    );
  exception when others then
    denied := true;
  end;

  if not denied then
    raise exception 'Customer A created a draft in organisation B.';
  end if;

  denied := false;
  begin
    insert into public.projects (organisation_id, name, project_type, status)
    values (
      'f0000000-0000-0000-0000-000000000002',
      'Forbidden cross-tenant project',
      'single_site',
      'active'
    );
  exception when others then
    denied := true;
  end;

  if not denied then
    raise exception 'Customer A created a project in organisation B.';
  end if;
end;
$$;

rollback;
