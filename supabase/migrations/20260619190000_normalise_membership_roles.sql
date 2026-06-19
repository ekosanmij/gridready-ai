-- Repair legacy organisation_memberships tables whose text role constraint
-- predates the application roles introduced by the production workbench.
-- In particular, the legacy constraint rejected self-service `customer`
-- memberships created by provision_customer_account.

alter table public.organisation_memberships
  drop constraint if exists organisation_memberships_role_check;

-- Converting the legacy text column to the canonical enum also prevents the
-- database constraint and the application role contract drifting apart again.
-- Unknown legacy roles are deliberately downgraded to customer; only the four
-- trusted application roles retain elevated permissions.
alter table public.organisation_memberships
  alter column role drop default;

alter table public.organisation_memberships
  alter column role type public.app_role
  using (
    case lower(role::text)
      when 'admin' then 'admin'::public.app_role
      when 'analyst' then 'analyst'::public.app_role
      when 'reviewer' then 'reviewer'::public.app_role
      when 'customer' then 'customer'::public.app_role
      else 'customer'::public.app_role
    end
  );

alter table public.organisation_memberships
  alter column role set default 'customer'::public.app_role,
  alter column role set not null,
  add constraint organisation_memberships_role_check
    check (role in ('admin', 'analyst', 'reviewer', 'customer'));
