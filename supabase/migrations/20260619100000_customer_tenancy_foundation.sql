-- AUTH-001 / AUTH-002: explicit organisation membership, idempotent customer
-- provisioning, and customer-owned intake record creation.

create table if not exists public.organisation_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  role public.app_role not null default 'customer',
  is_active boolean not null default true,
  is_default boolean not null default false,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organisation_memberships_user_organisation_key unique (user_id, organisation_id)
);

-- The deployed project may already contain an earlier membership table.
-- CREATE TABLE IF NOT EXISTS does not add columns to that table, so upgrade it
-- before creating indexes or running the profile backfill.
alter table public.organisation_memberships
  add column if not exists role public.app_role not null default 'customer',
  add column if not exists is_active boolean not null default true,
  add column if not exists is_default boolean not null default false,
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists accepted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists organisation_memberships_user_organisation_idx
  on public.organisation_memberships (user_id, organisation_id);

create unique index if not exists organisation_memberships_one_default_idx
  on public.organisation_memberships (user_id)
  where is_active and is_default;
create index if not exists organisation_memberships_organisation_user_idx
  on public.organisation_memberships (organisation_id, user_id)
  where is_active;

create table if not exists public.identity_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  subject_user_id uuid references auth.users(id) on delete set null,
  organisation_id uuid references public.organisations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists identity_events_subject_created_idx
  on public.identity_events (subject_user_id, created_at desc);
create index if not exists identity_events_organisation_created_idx
  on public.identity_events (organisation_id, created_at desc);

-- Legacy profiles used organisation_id directly. Preserve that context while
-- moving authorisation to explicit memberships.
insert into public.organisation_memberships
  (user_id, organisation_id, role, is_active, is_default, accepted_at)
select
  p.id,
  p.organisation_id,
  case lower(p.role::text)
    when 'admin' then 'admin'::public.app_role
    when 'analyst' then 'analyst'::public.app_role
    when 'reviewer' then 'reviewer'::public.app_role
    else 'customer'::public.app_role
  end,
  p.is_active,
  true,
  p.created_at
from public.profiles p
where p.organisation_id is not null
on conflict (user_id, organisation_id) do update
set role = excluded.role,
    is_active = excluded.is_active,
    is_default = true,
    accepted_at = coalesce(public.organisation_memberships.accepted_at, excluded.accepted_at),
    updated_at = now();

create or replace function public.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with active_memberships as (
    select m.organisation_id, m.is_default
    from public.organisation_memberships m
    where m.user_id = auth.uid()
      and m.is_active
  ), membership_summary as (
    select
      count(*) as membership_count,
      min(organisation_id::text)::uuid as sole_organisation_id,
      (min(organisation_id::text) filter (where is_default))::uuid as default_organisation_id
    from active_memberships
  )
  select case
    when s.default_organisation_id is not null then s.default_organisation_id
    when s.membership_count = 1 then s.sole_organisation_id
    when s.membership_count > 1 then null
    else (
      select p.organisation_id
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active
    )
  end
  from membership_summary s;
$$;

create or replace function public.is_organisation_member(organisation_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.organisation_memberships m
    where m.user_id = auth.uid()
      and m.organisation_id = organisation_uuid
      and m.is_active
  );
$$;

create or replace function public.current_account_context()
returns table (
  user_id uuid,
  app_role public.app_role,
  organisation_id uuid,
  organisation_name text,
  organisation_count integer,
  needs_organisation_selection boolean
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with membership_count as (
    select count(*)::integer as value
    from public.organisation_memberships m
    where m.user_id = auth.uid()
      and m.is_active
  ), context as (
    select public.current_organisation_id() as organisation_id
  )
  select
    auth.uid(),
    public.current_app_role(),
    context.organisation_id,
    o.name,
    membership_count.value,
    membership_count.value > 1 and context.organisation_id is null
  from membership_count
  cross join context
  left join public.organisations o on o.id = context.organisation_id
  where auth.uid() is not null;
$$;

create or replace function public.provision_customer_account(
  p_organisation_name text,
  p_organisation_type text default 'developer'
)
returns table (
  organisation_id uuid,
  organisation_name text,
  created boolean
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_organisation_id uuid;
  v_membership_count integer;
  v_membership_was_active boolean := false;
  v_created boolean := false;
  v_organisation_type text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  insert into public.profiles (id, full_name, role)
  select u.id, nullif(u.raw_user_meta_data ->> 'full_name', ''), 'customer'
  from auth.users u
  where u.id = v_user_id
  on conflict (id) do nothing;

  perform 1 from public.profiles p where p.id = v_user_id for update;

  select public.current_organisation_id() into v_organisation_id;
  if v_organisation_id is not null then
    select exists (
      select 1
      from public.organisation_memberships m
      where m.user_id = v_user_id
        and m.organisation_id = v_organisation_id
        and m.is_active
    ) into v_membership_was_active;

    insert into public.organisation_memberships
      (user_id, organisation_id, role, is_active, is_default, accepted_at)
    values (v_user_id, v_organisation_id, public.current_app_role(), true, true, now())
    on conflict (user_id, organisation_id) do update
    set role = excluded.role,
        is_active = true,
        is_default = true,
        accepted_at = coalesce(public.organisation_memberships.accepted_at, excluded.accepted_at),
        updated_at = now();

    select count(*)::integer into v_membership_count
    from public.organisation_memberships m
    where m.user_id = v_user_id
      and m.is_active;

    if v_membership_count = 1 then
      update public.organisation_memberships m
      set is_default = true, updated_at = now()
      where m.user_id = v_user_id
        and m.organisation_id = v_organisation_id;
    end if;

    if not v_membership_was_active then
      insert into public.identity_events
        (event_type, subject_user_id, organisation_id, actor_id, details)
      values (
        'legacy_profile_membership_repaired',
        v_user_id,
        v_organisation_id,
        v_user_id,
        jsonb_build_object('source', 'profile_organisation_id')
      );
    end if;

    return query
      select o.id, o.name, false
      from public.organisations o
      where o.id = v_organisation_id;
    return;
  end if;

  select count(*)::integer into v_membership_count
  from public.organisation_memberships m
  where m.user_id = v_user_id
    and m.is_active;

  if v_membership_count > 1 then
    raise exception 'Select an organisation before continuing.' using errcode = 'P0001';
  elsif v_membership_count = 1 then
    select m.organisation_id into v_organisation_id
    from public.organisation_memberships m
    where m.user_id = v_user_id
      and m.is_active
    limit 1;

    update public.organisation_memberships m
    set is_default = true, updated_at = now()
    where m.user_id = v_user_id and m.organisation_id = v_organisation_id;
  else
    if public.current_app_role() <> 'customer' then
      raise exception 'Internal accounts must be assigned by an administrator.' using errcode = '42501';
    end if;

    if nullif(btrim(p_organisation_name), '') is null then
      raise exception 'Organisation name is required.' using errcode = '22023';
    end if;

    v_organisation_type := case
      when p_organisation_type in ('developer', 'investor', 'energy_developer', 'landowner', 'consultant', 'gridready', 'other')
        then p_organisation_type
      else 'other'
    end;

    insert into public.organisations (name, organisation_type)
    values (btrim(p_organisation_name), v_organisation_type)
    returning id into v_organisation_id;

    insert into public.organisation_memberships
      (user_id, organisation_id, role, is_active, is_default, accepted_at)
    values (v_user_id, v_organisation_id, 'customer', true, true, now());

    insert into public.identity_events
      (event_type, subject_user_id, organisation_id, actor_id, details)
    values (
      'customer_organisation_provisioned',
      v_user_id,
      v_organisation_id,
      v_user_id,
      jsonb_build_object('source', 'self_service', 'organisation_type', v_organisation_type)
    );

    v_created := true;
  end if;

  update public.profiles
  set organisation_id = v_organisation_id, updated_at = now()
  where id = v_user_id;

  return query
    select o.id, o.name, v_created
    from public.organisations o
    where o.id = v_organisation_id;
end;
$$;

create or replace function public.set_active_organisation(p_organisation_id uuid)
returns table (
  user_id uuid,
  app_role public.app_role,
  organisation_id uuid,
  organisation_name text,
  organisation_count integer,
  needs_organisation_selection boolean
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships m
    where m.user_id = v_user_id
      and m.organisation_id = p_organisation_id
      and m.is_active
  ) then
    raise exception 'Organisation is not available to this account.' using errcode = '42501';
  end if;

  update public.organisation_memberships m
  set is_default = false,
      updated_at = now()
  where m.user_id = v_user_id
    and m.is_active
    and m.is_default;

  update public.organisation_memberships m
  set is_default = true,
      updated_at = now()
  where m.user_id = v_user_id
    and m.organisation_id = p_organisation_id
    and m.is_active;

  update public.profiles
  set organisation_id = p_organisation_id,
      updated_at = now()
  where id = v_user_id;

  insert into public.identity_events
    (event_type, subject_user_id, organisation_id, actor_id, details)
  values (
    'active_organisation_selected',
    v_user_id,
    p_organisation_id,
    v_user_id,
    jsonb_build_object('source', 'account_context')
  );

  return query select * from public.current_account_context();
end;
$$;

-- An administrator may place organisation_id and role in app_metadata when
-- inviting a user. Self-service metadata is deliberately not trusted for
-- tenant association or role elevation.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organisation_id uuid;
  v_role public.app_role := 'customer';
  v_role_text text;
begin
  v_role_text := lower(coalesce(new.raw_app_meta_data ->> 'role', 'customer'));
  if v_role_text in ('admin', 'analyst', 'reviewer', 'customer') then
    v_role := v_role_text::public.app_role;
  end if;

  begin
    v_organisation_id := nullif(
      coalesce(
        new.raw_app_meta_data ->> 'organisation_id',
        new.raw_app_meta_data ->> 'organization_id'
      ),
      ''
    )::uuid;
  exception when invalid_text_representation then
    v_organisation_id := null;
  end;

  if v_organisation_id is not null
     and not exists (select 1 from public.organisations o where o.id = v_organisation_id) then
    v_organisation_id := null;
  end if;

  insert into public.profiles (id, organisation_id, full_name, role)
  values (new.id, v_organisation_id, nullif(new.raw_user_meta_data ->> 'full_name', ''), v_role)
  on conflict (id) do update
  set organisation_id = coalesce(public.profiles.organisation_id, excluded.organisation_id),
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();

  if v_organisation_id is not null then
    insert into public.organisation_memberships
      (user_id, organisation_id, role, is_active, is_default, invited_by, accepted_at)
    values (new.id, v_organisation_id, v_role, true, true, null, now())
    on conflict (user_id, organisation_id) do update
    set role = excluded.role,
        is_active = true,
        is_default = true,
        accepted_at = coalesce(public.organisation_memberships.accepted_at, excluded.accepted_at),
        updated_at = now();

    insert into public.identity_events
      (event_type, subject_user_id, organisation_id, actor_id, details)
    values (
      'invited_membership_provisioned',
      new.id,
      v_organisation_id,
      null,
      jsonb_build_object('source', 'auth_app_metadata', 'role', v_role::text)
    );
  end if;

  return new;
end;
$$;

-- Sites need an organisation owner at creation time; without it, an RLS
-- policy cannot distinguish a customer's new site from another tenant's site.
alter table public.sites
  add column if not exists organisation_id uuid references public.organisations(id) on delete cascade;

with unambiguous_site_owners as (
  select
    a.site_id,
    (array_agg(distinct p.organisation_id))[1] as organisation_id
  from public.site_assessments a
  join public.projects p on p.id = a.project_id
  where a.site_id is not null and p.organisation_id is not null
  group by a.site_id
  having count(distinct p.organisation_id) = 1
)
update public.sites s
set organisation_id = owners.organisation_id
from unambiguous_site_owners owners
where s.id = owners.site_id
  and s.organisation_id is null;

create index if not exists sites_organisation_idx
  on public.sites (organisation_id);

create or replace function public.can_access_assessment(assessment_uuid uuid)
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
      from public.site_assessments a
      join public.projects p on p.id = a.project_id
      where a.id = assessment_uuid
        and public.is_organisation_member(p.organisation_id)
    )
  );
$$;

alter table public.organisation_memberships enable row level security;
alter table public.identity_events enable row level security;

drop policy if exists organisation_memberships_read on public.organisation_memberships;
create policy organisation_memberships_read on public.organisation_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.current_app_role() = 'admin');

drop policy if exists organisation_memberships_admin_manage on public.organisation_memberships;
create policy organisation_memberships_admin_manage on public.organisation_memberships
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

drop policy if exists identity_events_read on public.identity_events;
create policy identity_events_read on public.identity_events
  for select to authenticated
  using (subject_user_id = auth.uid() or public.current_app_role() = 'admin');

drop policy if exists identity_events_admin_manage on public.identity_events;
create policy identity_events_admin_manage on public.identity_events
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

drop policy if exists organisations_scoped_read on public.organisations;
create policy organisations_scoped_read on public.organisations
  for select to authenticated
  using (public.is_internal_user() or public.is_organisation_member(id));

drop policy if exists projects_scoped_read on public.projects;
drop policy if exists projects_customer_create on public.projects;
drop policy if exists projects_customer_update on public.projects;
create policy projects_scoped_read on public.projects
  for select to authenticated
  using (public.is_internal_user() or public.is_organisation_member(organisation_id));
create policy projects_customer_create on public.projects
  for insert to authenticated
  with check (
    public.current_app_role() = 'customer'
    and public.is_organisation_member(organisation_id)
  );
create policy projects_customer_update on public.projects
  for update to authenticated
  using (
    public.current_app_role() = 'customer'
    and public.is_organisation_member(organisation_id)
  )
  with check (
    public.current_app_role() = 'customer'
    and public.is_organisation_member(organisation_id)
  );

drop policy if exists contacts_scoped_read on public.contacts;
drop policy if exists contacts_customer_create on public.contacts;
drop policy if exists contacts_customer_update on public.contacts;
create policy contacts_scoped_read on public.contacts
  for select to authenticated
  using (public.is_internal_user() or public.is_organisation_member(organisation_id));
create policy contacts_customer_create on public.contacts
  for insert to authenticated
  with check (
    public.current_app_role() = 'customer'
    and public.is_organisation_member(organisation_id)
  );
create policy contacts_customer_update on public.contacts
  for update to authenticated
  using (
    public.current_app_role() = 'customer'
    and public.is_organisation_member(organisation_id)
  )
  with check (
    public.current_app_role() = 'customer'
    and public.is_organisation_member(organisation_id)
  );

drop policy if exists sites_scoped_read on public.sites;
drop policy if exists sites_customer_create on public.sites;
drop policy if exists sites_customer_update on public.sites;
create policy sites_scoped_read on public.sites
  for select to authenticated
  using (public.is_internal_user() or public.is_organisation_member(organisation_id));
create policy sites_customer_create on public.sites
  for insert to authenticated
  with check (
    public.current_app_role() = 'customer'
    and public.is_organisation_member(organisation_id)
  );
create policy sites_customer_update on public.sites
  for update to authenticated
  using (
    public.current_app_role() = 'customer'
    and public.is_organisation_member(organisation_id)
  )
  with check (
    public.current_app_role() = 'customer'
    and public.is_organisation_member(organisation_id)
  );

drop policy if exists assessments_customer_create on public.site_assessments;
create policy assessments_customer_create on public.site_assessments
  for insert to authenticated
  with check (
    public.current_app_role() = 'customer'
    and exists (
      select 1
      from public.projects p
      join public.sites s on s.id = site_id
      where p.id = project_id
        and public.is_organisation_member(p.organisation_id)
        and s.organisation_id = p.organisation_id
    )
    and status in ('draft', 'intake_incomplete', 'intake_complete')
  );

drop policy if exists history_customer_create on public.status_history;
create policy history_customer_create on public.status_history
  for insert to authenticated
  with check (
    public.current_app_role() = 'customer'
    and public.can_access_assessment(site_assessment_id)
    and to_status in ('draft', 'intake_incomplete', 'intake_complete')
    and (from_status is null or from_status in ('draft', 'intake_incomplete', 'intake_complete'))
  );

grant select, insert, update, delete on public.organisation_memberships to authenticated;
grant select, insert, update, delete on public.identity_events to authenticated;

revoke all on function public.current_organisation_id() from public, anon;
revoke all on function public.is_organisation_member(uuid) from public, anon;
revoke all on function public.current_account_context() from public, anon;
revoke all on function public.provision_customer_account(text, text) from public, anon;
revoke all on function public.set_active_organisation(uuid) from public, anon;
grant execute on function public.current_organisation_id() to authenticated;
grant execute on function public.is_organisation_member(uuid) to authenticated;
grant execute on function public.current_account_context() to authenticated;
grant execute on function public.provision_customer_account(text, text) to authenticated;
grant execute on function public.set_active_organisation(uuid) to authenticated;

notify pgrst, 'reload schema';
