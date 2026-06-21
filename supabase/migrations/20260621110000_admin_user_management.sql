-- AUTH-005 / AUTH-006 / SEC-003: audited administrator workflows for role
-- changes, account suspension, organisation memberships, and reassignment.

-- A suspended profile must not retain customer access through an otherwise
-- active organisation membership.
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
    join public.profiles p on p.id = m.user_id and p.is_active
    where m.user_id = auth.uid()
      and m.organisation_id = organisation_uuid
      and m.is_active
  );
$$;

-- Service-role administration still needs assignment history to identify the
-- human administrator. Admin functions set this transaction-local value after
-- verifying the actor.
create or replace function public.record_assessment_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
begin
  if new.owner_id is distinct from old.owner_id
     or new.sla_due_at is distinct from old.sla_due_at
     or new.assignment_note is distinct from old.assignment_note then
    begin
      v_actor_id := coalesce(
        auth.uid(),
        nullif(current_setting('app.admin_actor_id', true), '')::uuid
      );
    exception when invalid_text_representation then
      v_actor_id := auth.uid();
    end;

    if v_actor_id is null then
      raise exception 'Assignment changes require an authenticated actor.' using errcode = '42501';
    end if;

    insert into public.assessment_assignments
      (site_assessment_id, owner_id, sla_due_at, note, assigned_by)
    values (new.id, new.owner_id, new.sla_due_at, new.assignment_note, v_actor_id);
  end if;
  return new;
end;
$$;

create or replace function public.assert_active_admin_actor(p_actor_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_actor_id is null or not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_id
      and p.is_active
      and lower(p.role::text) = 'admin'
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.require_admin_change_reason(p_reason text)
returns text
language plpgsql
immutable
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if length(v_reason) < 8 or length(v_reason) > 1000 then
    raise exception 'An audit reason between 8 and 1000 characters is required.' using errcode = '22023';
  end if;
  return v_reason;
end;
$$;

-- Preserve the exact active/default membership set across an account-level
-- suspension. Deactivating memberships closes policies that check membership
-- directly, while this snapshot avoids reviving intentionally inactive access.
create table if not exists public.account_suspension_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_id uuid not null references public.organisation_memberships(id) on delete cascade,
  was_default boolean not null default false,
  recorded_at timestamptz not null default now(),
  primary key (user_id, membership_id)
);

alter table public.account_suspension_memberships enable row level security;
grant select, insert, update, delete on public.account_suspension_memberships to service_role;

create or replace function public.admin_set_user_access(
  p_actor_id uuid,
  p_subject_user_id uuid,
  p_role public.app_role,
  p_is_active boolean,
  p_reason text,
  p_reassign_owner_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_previous public.profiles;
  v_result public.profiles;
  v_reason text := public.require_admin_change_reason(p_reason);
begin
  perform public.assert_active_admin_actor(p_actor_id);

  select * into v_previous
  from public.profiles p
  where p.id = p_subject_user_id
  for update;

  if v_previous.id is null then
    raise exception 'User profile was not found.' using errcode = 'P0002';
  end if;

  if p_subject_user_id = p_actor_id
     and (not p_is_active or p_role <> 'admin'::public.app_role) then
    raise exception 'Administrators cannot suspend or demote their own account.' using errcode = '22023';
  end if;

  if v_previous.is_active
     and lower(v_previous.role::text) = 'admin'
     and (not p_is_active or p_role <> 'admin'::public.app_role)
     and not exists (
       select 1 from public.profiles p
       where p.id <> p_subject_user_id
         and p.is_active
         and lower(p.role::text) = 'admin'
     ) then
    raise exception 'At least one active administrator must remain.' using errcode = '22023';
  end if;

  if not p_is_active and p_reassign_owner_id is not null then
    if p_reassign_owner_id = p_subject_user_id or not exists (
      select 1 from public.profiles p
      where p.id = p_reassign_owner_id
        and p.is_active
        and lower(p.role::text) in ('admin', 'analyst')
    ) then
      raise exception 'Reassignment owner must be an active administrator or analyst.' using errcode = '22023';
    end if;
  end if;

  if v_previous.is_active and not p_is_active then
    insert into public.account_suspension_memberships (user_id, membership_id, was_default)
    select m.user_id, m.id, m.is_default
    from public.organisation_memberships m
    where m.user_id = p_subject_user_id and m.is_active
    on conflict (user_id, membership_id) do update
    set was_default = excluded.was_default,
        recorded_at = now();

    update public.organisation_memberships
    set is_active = false,
        is_default = false,
        updated_at = now()
    where user_id = p_subject_user_id and is_active;
  elsif not v_previous.is_active and p_is_active then
    update public.organisation_memberships
    set is_default = false, updated_at = now()
    where user_id = p_subject_user_id and is_default;

    update public.organisation_memberships m
    set is_active = true,
        is_default = s.was_default,
        updated_at = now()
    from public.account_suspension_memberships s
    where s.user_id = p_subject_user_id
      and s.membership_id = m.id;

    delete from public.account_suspension_memberships
    where user_id = p_subject_user_id;
  end if;

  update public.profiles
  set role = p_role,
      is_active = p_is_active,
      updated_at = now()
  where id = p_subject_user_id
  returning * into v_result;

  -- The application currently resolves one global role from profiles. Keep all
  -- tenant memberships aligned until per-membership role switching is added.
  update public.organisation_memberships
  set role = p_role,
      updated_at = now()
  where user_id = p_subject_user_id;

  if not p_is_active then
    perform set_config('app.admin_actor_id', p_actor_id::text, true);
    update public.site_assessments
    set owner_id = p_reassign_owner_id,
        assignment_note = concat(
          'Administrative reassignment after account suspension. ',
          v_reason
        ),
        updated_at = now()
    where owner_id = p_subject_user_id
      and status not in ('delivered', 'archived');
    perform set_config('app.admin_actor_id', '', true);
  end if;

  insert into public.identity_events
    (event_type, subject_user_id, organisation_id, actor_id, details)
  values (
    case
      when v_previous.is_active and not p_is_active then 'account_suspended'
      when not v_previous.is_active and p_is_active then 'account_reactivated'
      else 'user_access_updated'
    end,
    p_subject_user_id,
    v_result.organisation_id,
    p_actor_id,
    jsonb_build_object(
      'previous_role', v_previous.role::text,
      'role', p_role::text,
      'previous_active', v_previous.is_active,
      'is_active', p_is_active,
      'reason', v_reason,
      'reassigned_to', p_reassign_owner_id
    )
  );

  return v_result;
end;
$$;

create or replace function public.admin_add_user_membership(
  p_actor_id uuid,
  p_subject_user_id uuid,
  p_organisation_id uuid,
  p_make_default boolean,
  p_reason text
)
returns public.organisation_memberships
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_profile public.profiles;
  v_membership public.organisation_memberships;
  v_reason text := public.require_admin_change_reason(p_reason);
begin
  perform public.assert_active_admin_actor(p_actor_id);

  select * into v_profile
  from public.profiles p
  where p.id = p_subject_user_id
  for update;

  if v_profile.id is null then
    raise exception 'User profile was not found.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.organisations o where o.id = p_organisation_id) then
    raise exception 'Organisation was not found.' using errcode = 'P0002';
  end if;

  if p_make_default then
    update public.organisation_memberships
    set is_default = false, updated_at = now()
    where user_id = p_subject_user_id and is_default;
  end if;

  insert into public.organisation_memberships
    (user_id, organisation_id, role, is_active, is_default, invited_by, accepted_at)
  values (
    p_subject_user_id,
    p_organisation_id,
    v_profile.role,
    v_profile.is_active,
    p_make_default and v_profile.is_active,
    p_actor_id,
    null
  )
  on conflict (user_id, organisation_id) do update
  set role = excluded.role,
      is_active = excluded.is_active,
      is_default = excluded.is_default or public.organisation_memberships.is_default,
      invited_by = p_actor_id,
      updated_at = now()
  returning * into v_membership;

  if not v_profile.is_active then
    insert into public.account_suspension_memberships (user_id, membership_id, was_default)
    values (p_subject_user_id, v_membership.id, p_make_default)
    on conflict (user_id, membership_id) do update
    set was_default = excluded.was_default,
        recorded_at = now();
  end if;

  if p_make_default or v_profile.organisation_id is null then
    update public.profiles
    set organisation_id = p_organisation_id, updated_at = now()
    where id = p_subject_user_id;
  end if;

  insert into public.identity_events
    (event_type, subject_user_id, organisation_id, actor_id, details)
  values (
    'membership_added', p_subject_user_id, p_organisation_id, p_actor_id,
    jsonb_build_object(
      'membership_id', v_membership.id,
      'role', v_profile.role::text,
      'is_default', v_membership.is_default,
      'reason', v_reason
    )
  );

  return v_membership;
end;
$$;

create or replace function public.admin_set_membership_state(
  p_actor_id uuid,
  p_membership_id uuid,
  p_is_active boolean,
  p_make_default boolean,
  p_reason text
)
returns public.organisation_memberships
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_previous public.organisation_memberships;
  v_result public.organisation_memberships;
  v_reason text := public.require_admin_change_reason(p_reason);
  v_fallback_organisation_id uuid;
begin
  perform public.assert_active_admin_actor(p_actor_id);

  select * into v_previous
  from public.organisation_memberships m
  where m.id = p_membership_id
  for update;

  if v_previous.id is null then
    raise exception 'Organisation membership was not found.' using errcode = 'P0002';
  end if;
  if p_is_active and not exists (
    select 1 from public.profiles p
    where p.id = v_previous.user_id and p.is_active
  ) then
    raise exception 'Reactivate the account before activating a membership.' using errcode = '22023';
  end if;
  if p_make_default and not p_is_active then
    raise exception 'An inactive membership cannot be the default.' using errcode = '22023';
  end if;

  if p_make_default then
    update public.organisation_memberships
    set is_default = false, updated_at = now()
    where user_id = v_previous.user_id
      and id <> v_previous.id
      and is_default;
  end if;

  update public.organisation_memberships
  set is_active = p_is_active,
      is_default = p_is_active and (p_make_default or is_default),
      updated_at = now()
  where id = p_membership_id
  returning * into v_result;

  if not p_is_active then
    delete from public.account_suspension_memberships
    where user_id = v_previous.user_id
      and membership_id = v_previous.id;
  end if;

  if not p_is_active and v_previous.is_default then
    update public.organisation_memberships
    set is_default = false, updated_at = now()
    where id = p_membership_id;

    select m.organisation_id into v_fallback_organisation_id
    from public.organisation_memberships m
    where m.user_id = v_previous.user_id
      and m.is_active
      and m.id <> p_membership_id
    order by m.created_at
    limit 1;

    if v_fallback_organisation_id is not null then
      update public.organisation_memberships
      set is_default = true, updated_at = now()
      where user_id = v_previous.user_id
        and organisation_id = v_fallback_organisation_id;
    end if;
  elsif p_make_default then
    v_fallback_organisation_id := v_previous.organisation_id;
  end if;

  update public.profiles
  set organisation_id = v_fallback_organisation_id,
      updated_at = now()
  where id = v_previous.user_id
    and (
      p_make_default
      or (not p_is_active and v_previous.is_default)
    );

  select * into v_result
  from public.organisation_memberships m
  where m.id = p_membership_id;

  insert into public.identity_events
    (event_type, subject_user_id, organisation_id, actor_id, details)
  values (
    case when p_is_active then 'membership_activated' else 'membership_deactivated' end,
    v_previous.user_id,
    v_previous.organisation_id,
    p_actor_id,
    jsonb_build_object(
      'membership_id', v_previous.id,
      'previous_active', v_previous.is_active,
      'is_active', p_is_active,
      'previous_default', v_previous.is_default,
      'is_default', v_result.is_default,
      'reason', v_reason
    )
  );

  return v_result;
end;
$$;

revoke all on function public.assert_active_admin_actor(uuid) from public, anon, authenticated;
revoke all on function public.require_admin_change_reason(text) from public, anon, authenticated;
revoke all on function public.admin_set_user_access(uuid, uuid, public.app_role, boolean, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_add_user_membership(uuid, uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.admin_set_membership_state(uuid, uuid, boolean, boolean, text) from public, anon, authenticated;

grant execute on function public.admin_set_user_access(uuid, uuid, public.app_role, boolean, text, uuid) to service_role;
grant execute on function public.admin_add_user_membership(uuid, uuid, uuid, boolean, text) to service_role;
grant execute on function public.admin_set_membership_state(uuid, uuid, boolean, boolean, text) to service_role;

notify pgrst, 'reload schema';
