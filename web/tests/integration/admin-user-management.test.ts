import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AdminUserInputError, parseAdminUserMutation } from "@/lib/admin-users";

const userId = "11111111-1111-4111-8111-111111111111";
const organisationId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";

describe("administrator user-management contracts", () => {
  it("normalises an invitation without trusting a client-supplied actor", () => {
    expect(parseAdminUserMutation({
      action: "invite",
      email: " USER@EXAMPLE.COM ",
      fullName: "User Example",
      organisationId,
      reason: "Required for customer project access",
      role: "customer",
    })).toEqual({
      action: "invite",
      email: "user@example.com",
      fullName: "User Example",
      organisationId,
      reason: "Required for customer project access",
      role: "customer",
    });
  });

  it("requires a meaningful audit reason for access changes", () => {
    expect(() => parseAdminUserMutation({
      action: "set_access",
      isActive: false,
      reason: "short",
      role: "analyst",
      userId,
    })).toThrow(AdminUserInputError);
  });

  it("accepts suspension with an explicit reassignment owner", () => {
    expect(parseAdminUserMutation({
      action: "set_access",
      isActive: false,
      reason: "Team member has left the organisation",
      reassignOwnerId: organisationId,
      role: "analyst",
      userId,
    })).toMatchObject({ action: "set_access", isActive: false, reassignOwnerId: organisationId });
  });

  it("validates membership state mutations", () => {
    expect(parseAdminUserMutation({
      action: "set_membership",
      isActive: true,
      makeDefault: true,
      membershipId,
      reason: "Customer selected a new default organisation",
    })).toEqual({
      action: "set_membership",
      isActive: true,
      makeDefault: true,
      membershipId,
      reason: "Customer selected a new default organisation",
    });
  });

  it("rejects unknown roles and malformed identifiers", () => {
    expect(() => parseAdminUserMutation({
      action: "add_membership",
      makeDefault: false,
      organisationId: "not-a-uuid",
      reason: "Adding approved organisation access",
      userId,
    })).toThrow("Organisation is invalid");
    expect(() => parseAdminUserMutation({
      action: "set_access",
      isActive: true,
      reason: "Attempting invalid role elevation",
      role: "owner",
      userId,
    })).toThrow("Role is invalid");
  });

  it("enforces admin, last-admin, audit, membership, and suspension controls in SQL", () => {
    const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/20260621110000_admin_user_management.sql"), "utf8");
    expect(migration).toContain("join public.profiles p on p.id = m.user_id and p.is_active");
    expect(migration).toContain("Administrators cannot suspend or demote their own account");
    expect(migration).toContain("At least one active administrator must remain");
    expect(migration).toContain("create table if not exists public.account_suspension_memberships");
    expect(migration).toContain("set is_active = false,");
    expect(migration).toContain("update public.site_assessments");
    expect(migration).toContain("insert into public.identity_events");
    expect(migration).toContain("grant execute on function public.admin_set_user_access");
    expect(migration).not.toContain("grant execute on function public.admin_set_user_access(uuid, uuid, public.app_role, boolean, text, uuid) to authenticated");
  });

  it("keeps service-role operations behind the authenticated admin API", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/admin/users/route.ts"), "utf8");
    expect(route).toContain('accountContext?.app_role !== "admin"');
    expect(route).toContain("sameOrigin(request)");
    expect(route).toContain("inviteUserByEmail");
    expect(route).toContain('ban_duration: isActive ? "none" : "876000h"');
    expect(route).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  });
});
