import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  ensureCustomerContact,
  ensureCustomerOrganisation,
  normaliseAccountContext,
} from "@/lib/customer-tenancy";

describe("customer tenancy contracts", () => {
  it("normalises the server-resolved role and organisation context", () => {
    expect(normaliseAccountContext({
      app_role: "customer",
      needs_organisation_selection: false,
      organisation_count: 1,
      organisation_id: "organisation-a",
      organisation_name: "Example Energy",
      user_id: "user-a",
    })).toEqual({
      appRole: "customer",
      needsOrganisationSelection: false,
      organisationCount: 1,
      organisationId: "organisation-a",
      organisationName: "Example Energy",
      userId: "user-a",
    });
    expect(normaliseAccountContext(null)).toBeNull();
  });

  it("uses the provisioning RPC and returns its durable organisation identifier", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        created: true,
        organisation_id: "organisation-a",
        organisation_name: "Example Energy",
      },
      error: null,
    });
    const rpc = vi.fn().mockReturnValue({ single });
    const client = { rpc } as unknown as SupabaseClient;

    await expect(ensureCustomerOrganisation(client, {
      organisationName: "Example Energy",
      organisationType: "developer",
    })).resolves.toEqual({
      created: true,
      organisationId: "organisation-a",
      organisationName: "Example Energy",
    });
    expect(rpc).toHaveBeenCalledWith("provision_customer_account", {
      p_organisation_name: "Example Energy",
      p_organisation_type: "developer",
    });
  });

  it("reuses an organisation contact when the email already exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "contact-a" }, error: null });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const ilike = vi.fn().mockReturnValue({ limit });
    const eqOrganisation = vi.fn().mockReturnValue({ ilike });
    const select = vi.fn().mockReturnValue({ eq: eqOrganisation });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as unknown as SupabaseClient;

    await expect(ensureCustomerContact(client, {
      email: " Requester@Example.com ",
      name: "Requester",
      organisationId: "organisation-a",
      phone: "",
      roleTitle: "",
    })).resolves.toEqual({ created: false, id: "contact-a" });

    expect(from).toHaveBeenCalledWith("contacts");
    expect(eqOrganisation).toHaveBeenCalledWith("organisation_id", "organisation-a");
    expect(ilike).toHaveBeenCalledWith("email", "requester@example.com");
  });
});
