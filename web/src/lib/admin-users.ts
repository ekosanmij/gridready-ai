export const adminManagedRoles = ["admin", "analyst", "reviewer", "customer"] as const;

export type AdminManagedRole = (typeof adminManagedRoles)[number];

export type AdminMembershipSummary = {
  id: string;
  isActive: boolean;
  isDefault: boolean;
  organisationId: string;
  organisationName: string;
};

export type AdminUserSummary = {
  assignedAssessmentCount: number;
  createdAt: string | null;
  email: string;
  fullName: string;
  id: string;
  isActive: boolean;
  lastSignInAt: string | null;
  memberships: AdminMembershipSummary[];
  role: AdminManagedRole;
};

export type AdminOrganisationSummary = {
  id: string;
  name: string;
};

export type AdminUserMutation =
  | {
      action: "add_membership";
      makeDefault: boolean;
      organisationId: string;
      reason: string;
      userId: string;
    }
  | {
      action: "invite";
      email: string;
      fullName: string;
      organisationId: string;
      reason: string;
      role: AdminManagedRole;
    }
  | {
      action: "set_access";
      isActive: boolean;
      reason: string;
      reassignOwnerId: string | null;
      role: AdminManagedRole;
      userId: string;
    }
  | {
      action: "set_membership";
      isActive: boolean;
      makeDefault: boolean;
      membershipId: string;
      reason: string;
    };

export class AdminUserInputError extends Error {}

function objectValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdminUserInputError("A JSON object is required.");
  }
  return value as Record<string, unknown>;
}

function stringValue(record: Record<string, unknown>, key: string, label: string, maximum = 1000) {
  const value = typeof record[key] === "string" ? record[key].trim() : "";
  if (!value) throw new AdminUserInputError(`${label} is required.`);
  if (value.length > maximum) throw new AdminUserInputError(`${label} is too long.`);
  return value;
}

function booleanValue(record: Record<string, unknown>, key: string, label: string) {
  if (typeof record[key] !== "boolean") throw new AdminUserInputError(`${label} must be true or false.`);
  return record[key];
}

function identifierValue(record: Record<string, unknown>, key: string, label: string) {
  const value = stringValue(record, key, label, 100);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AdminUserInputError(`${label} is invalid.`);
  }
  return value;
}

function reasonValue(record: Record<string, unknown>) {
  const reason = stringValue(record, "reason", "Audit reason");
  if (reason.length < 8) throw new AdminUserInputError("Audit reason must contain at least 8 characters.");
  return reason;
}

function roleValue(record: Record<string, unknown>) {
  const role = stringValue(record, "role", "Role", 40);
  if (!adminManagedRoles.includes(role as AdminManagedRole)) {
    throw new AdminUserInputError("Role is invalid.");
  }
  return role as AdminManagedRole;
}

export function parseAdminUserMutation(value: unknown): AdminUserMutation {
  const record = objectValue(value);
  const action = stringValue(record, "action", "Action", 40);

  if (action === "invite") {
    const email = stringValue(record, "email", "Email", 320).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AdminUserInputError("Email is invalid.");
    }
    return {
      action,
      email,
      fullName: stringValue(record, "fullName", "Full name", 200),
      organisationId: identifierValue(record, "organisationId", "Organisation"),
      reason: reasonValue(record),
      role: roleValue(record),
    };
  }

  if (action === "set_access") {
    const reassignOwnerId = record.reassignOwnerId === null || record.reassignOwnerId === "" || record.reassignOwnerId === undefined
      ? null
      : identifierValue(record, "reassignOwnerId", "Reassignment owner");
    return {
      action,
      isActive: booleanValue(record, "isActive", "Active state"),
      reason: reasonValue(record),
      reassignOwnerId,
      role: roleValue(record),
      userId: identifierValue(record, "userId", "User"),
    };
  }

  if (action === "add_membership") {
    return {
      action,
      makeDefault: booleanValue(record, "makeDefault", "Default state"),
      organisationId: identifierValue(record, "organisationId", "Organisation"),
      reason: reasonValue(record),
      userId: identifierValue(record, "userId", "User"),
    };
  }

  if (action === "set_membership") {
    return {
      action,
      isActive: booleanValue(record, "isActive", "Active state"),
      makeDefault: booleanValue(record, "makeDefault", "Default state"),
      membershipId: identifierValue(record, "membershipId", "Membership"),
      reason: reasonValue(record),
    };
  }

  throw new AdminUserInputError("Action is invalid.");
}
