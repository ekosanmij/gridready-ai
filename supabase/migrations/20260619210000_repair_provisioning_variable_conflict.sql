-- Repair the existing-organisation path in provision_customer_account.
-- The function returns an `organisation_id` output column, so using the same
-- unqualified name in an ON CONFLICT target is ambiguous in PL/pgSQL.

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

  -- Serialise provisioning attempts for this account. This also makes the
  -- update-then-insert membership repair safe without an ambiguous conflict
  -- target.
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

    update public.organisation_memberships m
    set role = public.current_app_role(),
        is_active = true,
        is_default = true,
        accepted_at = coalesce(m.accepted_at, now()),
        updated_at = now()
    where m.user_id = v_user_id
      and m.organisation_id = v_organisation_id;

    if not found then
      insert into public.organisation_memberships
        (user_id, organisation_id, role, is_active, is_default, accepted_at)
      values (
        v_user_id,
        v_organisation_id,
        public.current_app_role(),
        true,
        true,
        now()
      );
    end if;

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
    where m.user_id = v_user_id
      and m.organisation_id = v_organisation_id;
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

  update public.profiles p
  set organisation_id = v_organisation_id,
      updated_at = now()
  where p.id = v_user_id;

  return query
    select o.id, o.name, v_created
    from public.organisations o
    where o.id = v_organisation_id;
end;
$$;

revoke all on function public.provision_customer_account(text, text) from public, anon;
grant execute on function public.provision_customer_account(text, text) to authenticated;

notify pgrst, 'reload schema';
