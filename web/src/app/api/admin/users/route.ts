import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  AdminUserInputError,
  type AdminManagedRole,
  type AdminMembershipSummary,
  type AdminUserSummary,
  parseAdminUserMutation,
} from "@/lib/admin-users";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ProfileRecord = {
  created_at: string | null;
  full_name: string | null;
  id: string;
  is_active: boolean;
  role: AdminManagedRole;
};

type MembershipRecord = {
  id: string;
  is_active: boolean;
  is_default: boolean;
  organisation_id: string;
  user_id: string;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requireAdministrator() {
  const sessionClient = await createSupabaseServerClient();
  if (!sessionClient) return { error: errorResponse("Supabase is not configured.", 503) };

  const { data: userData, error: userError } = await sessionClient.auth.getUser();
  if (userError || !userData.user) return { error: errorResponse("Authentication is required.", 401) };

  const { data: context, error: contextError } = await sessionClient
    .rpc("current_account_context")
    .maybeSingle();
  const accountContext = context as { app_role?: AdminManagedRole | null } | null;
  if (contextError || accountContext?.app_role !== "admin") {
    return { error: errorResponse("Administrator access is required.", 403) };
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return { error: errorResponse("Administrator service credentials are not configured.", 503) };
  return { actorId: userData.user.id, adminClient };
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function membershipMap(records: MembershipRecord[], organisationNames: Map<string, string>) {
  const byUser = new Map<string, AdminMembershipSummary[]>();
  for (const record of records) {
    const list = byUser.get(record.user_id) ?? [];
    list.push({
      id: record.id,
      isActive: record.is_active,
      isDefault: record.is_default,
      organisationId: record.organisation_id,
      organisationName: organisationNames.get(record.organisation_id) ?? "Organisation",
    });
    byUser.set(record.user_id, list);
  }
  return byUser;
}

function normaliseAdminUser(
  user: User,
  profile: ProfileRecord | undefined,
  memberships: AdminMembershipSummary[],
  assignedAssessmentCount: number,
): AdminUserSummary {
  return {
    assignedAssessmentCount,
    createdAt: user.created_at ?? profile?.created_at ?? null,
    email: user.email ?? "No email",
    fullName: profile?.full_name ?? (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ?? "",
    id: user.id,
    isActive: profile?.is_active ?? false,
    lastSignInAt: user.last_sign_in_at ?? null,
    memberships,
    role: profile?.role ?? "customer",
  };
}

async function updateAuthAccess(
  adminClient: SupabaseClient,
  userId: string,
  role: AdminManagedRole,
  isActive: boolean,
  organisationId?: string,
) {
  const { data, error } = await adminClient.auth.admin.getUserById(userId);
  if (error) return error.message;
  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...(data.user.app_metadata ?? {}),
      organisation_id: organisationId ?? data.user.app_metadata?.organisation_id,
      role,
    },
    ban_duration: isActive ? "none" : "876000h",
  });
  return updateError?.message ?? null;
}

export async function GET() {
  const authorization = await requireAdministrator();
  if ("error" in authorization) return authorization.error;
  const { adminClient } = authorization;

  const [authResult, profileResult, membershipResult, organisationResult, assessmentResult] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    adminClient.from("profiles").select("id, full_name, role, is_active, created_at"),
    adminClient.from("organisation_memberships").select("id, user_id, organisation_id, is_active, is_default"),
    adminClient.from("organisations").select("id, name").order("name"),
    adminClient.from("site_assessments").select("owner_id, status").not("owner_id", "is", null),
  ]);

  const failure = authResult.error ?? profileResult.error ?? membershipResult.error ?? organisationResult.error ?? assessmentResult.error;
  if (failure) return errorResponse(failure.message, 500);

  const organisations = (organisationResult.data ?? []) as Array<{ id: string; name: string }>;
  const organisationNames = new Map(organisations.map((organisation) => [organisation.id, organisation.name]));
  const memberships = membershipMap((membershipResult.data ?? []) as MembershipRecord[], organisationNames);
  const profiles = new Map(((profileResult.data ?? []) as ProfileRecord[]).map((profile) => [profile.id, profile]));
  const assignmentCounts = new Map<string, number>();
  for (const assessment of assessmentResult.data ?? []) {
    if (!assessment.owner_id || ["archived", "delivered"].includes(assessment.status)) continue;
    assignmentCounts.set(assessment.owner_id, (assignmentCounts.get(assessment.owner_id) ?? 0) + 1);
  }

  const users = authResult.data.users
    .map((user) => normaliseAdminUser(
      user,
      profiles.get(user.id),
      memberships.get(user.id) ?? [],
      assignmentCounts.get(user.id) ?? 0,
    ))
    .sort((a, b) => a.email.localeCompare(b.email));

  return NextResponse.json({ organisations, users });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse("Request origin is not allowed.", 403);
  const authorization = await requireAdministrator();
  if ("error" in authorization) return authorization.error;
  const { actorId, adminClient } = authorization;

  let mutation;
  try {
    mutation = parseAdminUserMutation(await request.json());
  } catch (error) {
    return errorResponse(error instanceof AdminUserInputError ? error.message : "Request body is invalid.", 400);
  }

  if (mutation.action === "invite") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(mutation.email, {
      data: { full_name: mutation.fullName },
      redirectTo: new URL("/auth/login", siteUrl).toString(),
    });
    if (inviteError || !inviteData.user) return errorResponse(inviteError?.message ?? "Invitation failed.", 400);

    const { error: accessError } = await adminClient.rpc("admin_set_user_access", {
      p_actor_id: actorId,
      p_is_active: true,
      p_reason: mutation.reason,
      p_reassign_owner_id: null,
      p_role: mutation.role,
      p_subject_user_id: inviteData.user.id,
    });
    if (accessError) return errorResponse(accessError.message, 400);

    const { error: membershipError } = await adminClient.rpc("admin_add_user_membership", {
      p_actor_id: actorId,
      p_make_default: true,
      p_organisation_id: mutation.organisationId,
      p_reason: mutation.reason,
      p_subject_user_id: inviteData.user.id,
    });
    if (membershipError) return errorResponse(membershipError.message, 400);

    const warning = await updateAuthAccess(adminClient, inviteData.user.id, mutation.role, true, mutation.organisationId);
    return NextResponse.json({ ok: true, userId: inviteData.user.id, warning });
  }

  if (mutation.action === "set_access") {
    const { error } = await adminClient.rpc("admin_set_user_access", {
      p_actor_id: actorId,
      p_is_active: mutation.isActive,
      p_reason: mutation.reason,
      p_reassign_owner_id: mutation.reassignOwnerId,
      p_role: mutation.role,
      p_subject_user_id: mutation.userId,
    });
    if (error) return errorResponse(error.message, 400);
    const warning = await updateAuthAccess(adminClient, mutation.userId, mutation.role, mutation.isActive);
    return NextResponse.json({ ok: true, warning });
  }

  if (mutation.action === "add_membership") {
    const { error } = await adminClient.rpc("admin_add_user_membership", {
      p_actor_id: actorId,
      p_make_default: mutation.makeDefault,
      p_organisation_id: mutation.organisationId,
      p_reason: mutation.reason,
      p_subject_user_id: mutation.userId,
    });
    if (error) return errorResponse(error.message, 400);
    return NextResponse.json({ ok: true });
  }

  const { error } = await adminClient.rpc("admin_set_membership_state", {
    p_actor_id: actorId,
    p_is_active: mutation.isActive,
    p_make_default: mutation.makeDefault,
    p_membership_id: mutation.membershipId,
    p_reason: mutation.reason,
  });
  if (error) return errorResponse(error.message, 400);
  return NextResponse.json({ ok: true });
}
