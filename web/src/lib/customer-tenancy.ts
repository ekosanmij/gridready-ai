import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountContext = {
  appRole: "admin" | "analyst" | "reviewer" | "customer";
  needsOrganisationSelection: boolean;
  organisationCount: number;
  organisationId: string | null;
  organisationName: string | null;
  userId: string;
};

type AccountContextRecord = {
  app_role?: AccountContext["appRole"] | null;
  needs_organisation_selection?: boolean | null;
  organisation_count?: number | null;
  organisation_id?: string | null;
  organisation_name?: string | null;
  user_id?: string | null;
};

type ProvisionedOrganisationRecord = {
  created?: boolean | null;
  organisation_id?: string | null;
  organisation_name?: string | null;
};

type OrganisationMembershipRecord = {
  is_default?: boolean | null;
  organisation_id?: string | null;
  organisations?: Array<{ name?: string | null }> | { name?: string | null } | null;
};

type ContactIdRecord = {
  id?: string | null;
};

export function normaliseAccountContext(record: AccountContextRecord | null | undefined): AccountContext | null {
  if (!record?.user_id) {
    return null;
  }

  return {
    appRole: record.app_role ?? "customer",
    needsOrganisationSelection: Boolean(record.needs_organisation_selection),
    organisationCount: record.organisation_count ?? 0,
    organisationId: record.organisation_id ?? null,
    organisationName: record.organisation_name ?? null,
    userId: record.user_id,
  };
}

export async function loadCurrentAccountContext(client: SupabaseClient) {
  const { data, error } = await client.rpc("current_account_context").maybeSingle();

  if (error) {
    throw error;
  }

  return normaliseAccountContext(data as AccountContextRecord | null);
}

export async function ensureCustomerOrganisation(
  client: SupabaseClient,
  input: { organisationName: string; organisationType: string },
) {
  const { data, error } = await client
    .rpc("provision_customer_account", {
      p_organisation_name: input.organisationName,
      p_organisation_type: input.organisationType,
    })
    .single();

  if (error) {
    throw error;
  }

  const record = data as ProvisionedOrganisationRecord | null;
  if (!record?.organisation_id) {
    throw new Error("Your account does not have an active organisation.");
  }

  return {
    created: Boolean(record.created),
    organisationId: record.organisation_id,
    organisationName: record.organisation_name ?? input.organisationName,
  };
}

export async function ensureCustomerContact(
  client: SupabaseClient,
  input: {
    email: string;
    name: string;
    organisationId: string;
    phone: string;
    roleTitle: string;
  },
) {
  const email = input.email.trim().toLowerCase();
  const { data: existingContact, error: lookupError } = await client
    .from("contacts")
    .select("id")
    .eq("organisation_id", input.organisationId)
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  const existingId = (existingContact as ContactIdRecord | null)?.id;
  if (existingId) {
    return { created: false, id: existingId };
  }

  const { data: contact, error: createError } = await client
    .from("contacts")
    .insert({
      email,
      is_primary: true,
      name: input.name.trim() || email,
      organisation_id: input.organisationId,
      phone: input.phone.trim() || null,
      role_title: input.roleTitle.trim() || null,
    })
    .select("id")
    .single();

  if (createError) {
    throw createError;
  }

  const contactId = (contact as ContactIdRecord | null)?.id;
  if (!contactId) {
    throw new Error("The requester contact could not be created.");
  }

  return { created: true, id: contactId };
}

export async function loadOrganisationChoices(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("organisation_memberships")
    .select("organisation_id, is_default, organisations (name)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as OrganisationMembershipRecord[]).flatMap((record) => {
    if (!record.organisation_id) {
      return [];
    }

    const organisation = Array.isArray(record.organisations)
      ? record.organisations[0]
      : record.organisations;

    return [{
      id: record.organisation_id,
      isDefault: Boolean(record.is_default),
      name: organisation?.name ?? "Organisation",
    }];
  });
}

export async function setActiveOrganisation(client: SupabaseClient, organisationId: string) {
  const { data, error } = await client
    .rpc("set_active_organisation", { p_organisation_id: organisationId })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normaliseAccountContext(data as AccountContextRecord | null);
}
