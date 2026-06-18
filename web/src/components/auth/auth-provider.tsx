"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AppRole = "admin" | "analyst" | "reviewer" | "customer";

type AuthState = {
  loading: boolean;
  role: AppRole;
  user: User | null;
};

const AuthContext = createContext<AuthState>({ loading: true, role: "customer", user: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>("customer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: { user: nextUser } } = await supabase.auth.getUser();
      if (!active) return;
      setUser(nextUser);

      if (nextUser) {
        const { data } = await supabase.from("profiles").select("role").eq("id", nextUser.id).maybeSingle();
        if (active && data?.role) setRole(data.role as AppRole);
      }
      if (active) setLoading(false);
    }

    void loadUser();
    const { data: listener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) setRole("customer");
      void loadUser();
    }) ?? { data: null };

    return () => {
      active = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ loading, role, user }), [loading, role, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function canManageAssessments(role: AppRole) {
  return role === "admin" || role === "analyst";
}

export function canAuthorReports(role: AppRole) {
  return role === "admin" || role === "analyst" || role === "reviewer";
}
