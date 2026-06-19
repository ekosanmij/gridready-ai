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
