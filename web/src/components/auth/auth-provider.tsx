"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadCurrentAccountContext } from "@/lib/customer-tenancy";
import { supabase } from "@/lib/supabase";

export type AppRole = "admin" | "analyst" | "reviewer" | "customer";

type AuthState = {
  loading: boolean;
  needsOrganisationSelection: boolean;
  organisationCount: number;
  organisationId: string | null;
  organisationName: string | null;
  reloadAccount: () => Promise<void>;
  role: AppRole;
  user: User | null;
};

const AuthContext = createContext<AuthState>({
  loading: true,
  needsOrganisationSelection: false,
  organisationCount: 0,
  organisationId: null,
  organisationName: null,
  reloadAccount: async () => {},
  role: "customer",
  user: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>("customer");
  const [organisationId, setOrganisationId] = useState<string | null>(null);
  const [organisationName, setOrganisationName] = useState<string | null>(null);
  const [organisationCount, setOrganisationCount] = useState(0);
  const [needsOrganisationSelection, setNeedsOrganisationSelection] = useState(false);
  const [loading, setLoading] = useState(true);

  const resetAccount = useCallback(() => {
    setRole("customer");
    setOrganisationId(null);
    setOrganisationName(null);
    setOrganisationCount(0);
    setNeedsOrganisationSelection(false);
  }, []);

  const reloadAccount = useCallback(async () => {
    if (!supabase) {
      resetAccount();
      return;
    }

    const { data: { user: nextUser } } = await supabase.auth.getUser();
    setUser(nextUser);

    if (!nextUser) {
      resetAccount();
      return;
    }

    try {
      const context = await loadCurrentAccountContext(supabase);
      if (!context) {
        resetAccount();
        return;
      }

      setRole(context.appRole);
      setOrganisationId(context.organisationId);
      setOrganisationName(context.organisationName);
      setOrganisationCount(context.organisationCount);
      setNeedsOrganisationSelection(context.needsOrganisationSelection);
    } catch {
      // Keep the app usable while the tenancy migration is being deployed.
      const { data } = await supabase
        .from("profiles")
        .select("organisation_id, role")
        .eq("id", nextUser.id)
        .maybeSingle();
      setRole((data?.role as AppRole | undefined) ?? "customer");
      setOrganisationId((data?.organisation_id as string | null | undefined) ?? null);
      setOrganisationName(null);
      setOrganisationCount(data?.organisation_id ? 1 : 0);
      setNeedsOrganisationSelection(false);
    }
  }, [resetAccount]);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      await reloadAccount();
      if (active) setLoading(false);
    }

    void loadUser();
    const { data: listener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) resetAccount();
      void loadUser();
    }) ?? { data: null };

    return () => {
      active = false;
      listener?.subscription.unsubscribe();
    };
  }, [reloadAccount, resetAccount]);

  const value = useMemo(() => ({
    loading,
    needsOrganisationSelection,
    organisationCount,
    organisationId,
    organisationName,
    reloadAccount,
    role,
    user,
  }), [
    loading,
    needsOrganisationSelection,
    organisationCount,
    organisationId,
    organisationName,
    reloadAccount,
    role,
    user,
  ]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function canManageAssessments(role: AppRole) {
  return role === "admin" || role === "analyst";
}

export function canAuthorReports(role: AppRole) {
  return role === "admin" || role === "analyst";
}
