"use client";

import { AlertCircle, Loader2, RefreshCw, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/ui/empty-state";
import {
  StatusPill,
  WorkItemPanel,
  cx,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-primitives";
import {
  type AdminManagedRole,
  type AdminOrganisationSummary,
  type AdminUserSummary,
  adminManagedRoles,
} from "@/lib/admin-users";
import { hasSupabaseConfig } from "@/lib/supabase";

type AdminResponse = {
  organisations: AdminOrganisationSummary[];
  users: AdminUserSummary[];
};

const roleLabels: Record<AdminManagedRole, string> = {
  admin: "Administrator",
  analyst: "Analyst",
  customer: "Customer",
  reviewer: "Reviewer",
};

async function responseBody(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string; warning?: string | null };
  if (!response.ok) throw new Error(body.error || "Administrator request failed.");
  return body;
}

async function fetchAdminData() {
  const response = await fetch("/api/admin/users", { cache: "no-store" });
  const body = await response.json() as AdminResponse & { error?: string };
  if (!response.ok) throw new Error(body.error || "Could not load administrator data.");
  return { organisations: body.organisations ?? [], users: body.users ?? [] };
}

export function AdminUserManagement() {
  const { loading: authLoading, role, user: currentUser } = useAuth();
  const [data, setData] = useState<AdminResponse>({ organisations: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [pendingKey, setPendingKey] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [membershipOrganisations, setMembershipOrganisations] = useState<Record<string, string>>({});

  async function load() {
    if (role !== "admin" || !hasSupabaseConfig) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setData(await fetchAdminData());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load administrator data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      if (authLoading) return;
      if (role !== "admin" || !hasSupabaseConfig) {
        if (active) setLoading(false);
        return;
      }
      try {
        const nextData = await fetchAdminData();
        if (active) {
          setData(nextData);
          setError("");
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load administrator data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitialData();
    return () => { active = false; };
  }, [authLoading, role]);

  async function mutate(key: string, payload: Record<string, unknown>, success: string) {
    setPendingKey(key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = await responseBody(response);
      setNotice(body.warning ? `${success} Auth warning: ${body.warning}` : success);
      await load();
      return true;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Administrator request failed.");
      return false;
    } finally {
      setPendingKey("");
    }
  }

  async function inviteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const succeeded = await mutate("invite", {
      action: "invite",
      email: form.get("email"),
      fullName: form.get("fullName"),
      organisationId: form.get("organisationId"),
      reason: form.get("reason"),
      role: form.get("role"),
    }, "Invitation sent and membership provisioned.");
    if (succeeded) event.currentTarget.reset();
  }

  const internalOwners = useMemo(
    () => data.users.filter((item) => item.isActive && ["admin", "analyst"].includes(item.role)),
    [data.users],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = useMemo(() => data.users.filter((item) => [
    item.email,
    item.fullName,
    item.role,
    ...item.memberships.map((membership) => membership.organisationName),
  ].join(" ").toLowerCase().includes(normalizedQuery)), [data.users, normalizedQuery]);

  if (authLoading || loading) {
    return <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-12 text-center text-sm text-[var(--color-text-secondary)]"><Loader2 className="mx-auto mb-3 animate-spin" size={22} />Loading administrator workspace</div>;
  }
  if (role !== "admin") {
    return <EmptyState icon={<ShieldCheck size={20} />} title="Administrator access required" description="User roles, memberships, and suspensions are restricted to active administrators." />;
  }
  if (!hasSupabaseConfig) {
    return <EmptyState icon={<AlertCircle size={20} />} title="Supabase connection needed" description="Configure Supabase and the server-only service-role key to manage users." />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm shadow-[var(--color-shadow)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">Access administration</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">Users and organisations</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">Invite users, maintain tenant memberships, and suspend or reassign accounts with an immutable audit reason.</p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => void load()}><RefreshCw size={16} />Refresh</button>
        </div>
        {error ? <p className="mt-4 rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-3 text-sm text-[var(--color-danger)]" role="alert">{error}</p> : null}
        {notice ? <p className="mt-4 rounded-md border border-[var(--color-success)] bg-[var(--color-success-soft)] px-3 py-3 text-sm text-[var(--color-success)]" role="status">{notice}</p> : null}
      </section>

      <WorkItemPanel title="Invite user" eyebrow="Administrator action" tone="info">
        <form className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3" onSubmit={inviteUser}>
          <label className="text-sm font-medium text-[var(--color-text-primary)]">Full name<input className={cx(inputClass, "mt-1")} name="fullName" required /></label>
          <label className="text-sm font-medium text-[var(--color-text-primary)]">Email<input className={cx(inputClass, "mt-1")} name="email" type="email" required /></label>
          <label className="text-sm font-medium text-[var(--color-text-primary)]">Role<select className={cx(inputClass, "mt-1")} name="role" defaultValue="customer">{adminManagedRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
          <label className="text-sm font-medium text-[var(--color-text-primary)]">Organisation<select className={cx(inputClass, "mt-1")} name="organisationId" required defaultValue=""><option value="" disabled>Select organisation</option>{data.organisations.map((organisation) => <option key={organisation.id} value={organisation.id}>{organisation.name}</option>)}</select></label>
          <label className="text-sm font-medium text-[var(--color-text-primary)] lg:col-span-2">Audit reason<input className={cx(inputClass, "mt-1")} minLength={8} name="reason" placeholder="Why this access is required" required /></label>
          <button className={cx(primaryButtonClass, "self-end")} disabled={pendingKey === "invite"} type="submit">{pendingKey === "invite" ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}Send invitation</button>
        </form>
      </WorkItemPanel>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm shadow-[var(--color-shadow)]">
        <label className="relative block">
          <span className="sr-only">Search users</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
          <input className={cx(inputClass, "pl-9")} placeholder="Search user, role, or organisation" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </section>

      <div className="grid gap-4">
        {filteredUsers.length === 0 ? <EmptyState icon={<Users size={20} />} title="No users found" description="Adjust the search or invite the first user." /> : filteredUsers.map((managedUser) => {
          const reason = reasons[managedUser.id] ?? "";
          const availableOrganisations = data.organisations.filter((organisation) => !managedUser.memberships.some((membership) => membership.organisationId === organisation.id));
          return (
            <WorkItemPanel key={managedUser.id} title={managedUser.fullName || managedUser.email} eyebrow={managedUser.email} tone={managedUser.isActive ? "success" : "danger"}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={managedUser.isActive ? "success" : "danger"}>{managedUser.isActive ? "Active" : "Suspended"}</StatusPill>
                <StatusPill tone="info">{roleLabels[managedUser.role]}</StatusPill>
                <StatusPill tone={managedUser.assignedAssessmentCount > 0 ? "warning" : "neutral"}>{managedUser.assignedAssessmentCount} active assignments</StatusPill>
                {managedUser.id === currentUser?.id ? <StatusPill tone="neutral">Current user</StatusPill> : null}
              </div>

              <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void mutate(`access:${managedUser.id}`, {
                  action: "set_access",
                  isActive: form.get("isActive") === "true",
                  reason,
                  reassignOwnerId: form.get("reassignOwnerId") || null,
                  role: form.get("role"),
                  userId: managedUser.id,
                }, "User access updated.");
              }}>
                <label className="text-sm font-medium text-[var(--color-text-primary)]">Role<select className={cx(inputClass, "mt-1")} name="role" defaultValue={managedUser.role}>{adminManagedRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
                <label className="text-sm font-medium text-[var(--color-text-primary)]">Account state<select className={cx(inputClass, "mt-1")} name="isActive" defaultValue={String(managedUser.isActive)}><option value="true">Active</option><option value="false">Suspended</option></select></label>
                <label className="text-sm font-medium text-[var(--color-text-primary)]">Reassign open work<select className={cx(inputClass, "mt-1")} name="reassignOwnerId" defaultValue=""><option value="">Leave unassigned</option>{internalOwners.filter((owner) => owner.id !== managedUser.id).map((owner) => <option key={owner.id} value={owner.id}>{owner.fullName || owner.email}</option>)}</select></label>
                <button className={cx(primaryButtonClass, "self-end")} disabled={reason.length < 8 || pendingKey === `access:${managedUser.id}`} type="submit">{pendingKey === `access:${managedUser.id}` ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}Save access</button>
              </form>

              <label className="mt-3 block text-sm font-medium text-[var(--color-text-primary)]">Change reason<input className={cx(inputClass, "mt-1")} minLength={8} placeholder="Required for every change" value={reason} onChange={(event) => setReasons((current) => ({ ...current, [managedUser.id]: event.target.value }))} /></label>

              <div className="mt-4 grid gap-2">
                {managedUser.memberships.map((membership) => (
                  <div key={membership.id} className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-sm font-semibold text-[var(--color-text-primary)]">{membership.organisationName}</p><p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{membership.isDefault ? "Default organisation" : "Additional organisation"}</p></div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill tone={membership.isActive ? "success" : "neutral"}>{membership.isActive ? "Active" : "Inactive"}</StatusPill>
                      {membership.isActive && !membership.isDefault ? <button type="button" className={secondaryButtonClass} disabled={reason.length < 8 || Boolean(pendingKey)} onClick={() => void mutate(`membership:${membership.id}:default`, { action: "set_membership", isActive: true, makeDefault: true, membershipId: membership.id, reason }, "Default organisation updated.")}>Set default</button> : null}
                      <button type="button" className={secondaryButtonClass} disabled={reason.length < 8 || Boolean(pendingKey)} onClick={() => void mutate(`membership:${membership.id}:state`, { action: "set_membership", isActive: !membership.isActive, makeDefault: false, membershipId: membership.id, reason }, membership.isActive ? "Membership deactivated." : "Membership activated.")}>{membership.isActive ? "Deactivate" : "Activate"}</button>
                    </div>
                  </div>
                ))}
              </div>

              {availableOrganisations.length > 0 ? <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select className={inputClass} value={membershipOrganisations[managedUser.id] ?? ""} onChange={(event) => setMembershipOrganisations((current) => ({ ...current, [managedUser.id]: event.target.value }))}><option value="">Add organisation membership</option>{availableOrganisations.map((organisation) => <option key={organisation.id} value={organisation.id}>{organisation.name}</option>)}</select>
                <button type="button" className={secondaryButtonClass} disabled={!membershipOrganisations[managedUser.id] || reason.length < 8 || Boolean(pendingKey)} onClick={() => void mutate(`membership:${managedUser.id}:add`, { action: "add_membership", makeDefault: managedUser.memberships.length === 0, organisationId: membershipOrganisations[managedUser.id], reason, userId: managedUser.id }, "Organisation membership added.")}><UserPlus size={16} />Add membership</button>
              </div> : null}
            </WorkItemPanel>
          );
        })}
      </div>
    </div>
  );
}
