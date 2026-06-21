"use client";

import {
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  Moon,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { GlobalSearch } from "@/components/global-search/global-search";
import { useAuth } from "@/components/auth/auth-provider";
import { cx, primaryButtonClass, secondaryButtonClass } from "@/components/ui-primitives";
import {
  ThemePreference,
  applyThemePreference,
  getClientHydrationSnapshot,
  getServerHydrationSnapshot,
  getThemePreferenceServerSnapshot,
  getThemePreferenceSnapshot,
  setThemePreference,
  subscribeHydrationChange,
  subscribeThemePreference,
} from "@/lib/ui-preferences";
import { loadOrganisationChoices, setActiveOrganisation } from "@/lib/customer-tenancy";
import { supabase } from "@/lib/supabase";

const baseNavigationItems = [
  { href: "/intake", icon: <Home size={18} />, label: "Home" },
  { href: "/intake/requests/new", icon: <Plus size={18} />, label: "Requests" },
  { href: "/intake/assessments", icon: <ClipboardList size={18} />, label: "Assessments" },
  { href: "/intake/evidence", icon: <ShieldCheck size={18} />, label: "Evidence" },
  { href: "/intake/workspace", icon: <LayoutDashboard size={18} />, label: "Workspace" },
  { href: "/intake/reports", icon: <FileText size={18} />, label: "Reports" },
];

export function AppShell({
  actions,
  children,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  const pathname = usePathname();
  const {
    needsOrganisationSelection,
    reloadAccount,
    role,
    user,
  } = useAuth();
  const [organisationChoices, setOrganisationChoices] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOrganisationId, setSelectedOrganisationId] = useState("");
  const [organisationError, setOrganisationError] = useState("");
  const [selectingOrganisation, setSelectingOrganisation] = useState(false);
  const theme = useSyncExternalStore(
    subscribeThemePreference,
    getThemePreferenceSnapshot,
    getThemePreferenceServerSnapshot,
  );
  const isHydrated = useSyncExternalStore(
    subscribeHydrationChange,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const displayedTheme = isHydrated ? theme : getThemePreferenceServerSnapshot();
  const navigationItems = role === "admin"
    ? [...baseNavigationItems, { href: "/intake/admin/users", icon: <Users size={18} />, label: "Administration" }]
    : baseNavigationItems;

  useEffect(() => {
    applyThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    async function loadChoices() {
      if (!needsOrganisationSelection || !supabase || !user) {
        return;
      }

      try {
        const choices = await loadOrganisationChoices(supabase, user.id);
        if (!cancelled) {
          setOrganisationChoices(choices);
          setSelectedOrganisationId(choices[0]?.id ?? "");
          setOrganisationError("");
        }
      } catch (error) {
        if (!cancelled) {
          setOrganisationError(error instanceof Error ? error.message : "Could not load organisations.");
        }
      }
    }

    void loadChoices();
    return () => {
      cancelled = true;
    };
  }, [needsOrganisationSelection, user]);

  function toggleTheme() {
    const nextTheme: ThemePreference = theme === "dark" ? "light" : "dark";
    setThemePreference(nextTheme);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    window.location.assign("/auth/login");
  }

  async function chooseOrganisation() {
    if (!supabase || !selectedOrganisationId) {
      return;
    }

    setSelectingOrganisation(true);
    setOrganisationError("");
    try {
      await setActiveOrganisation(supabase, selectedOrganisationId);
      await reloadAccount();
    } catch (error) {
      setOrganisationError(error instanceof Error ? error.message : "Could not select organisation.");
    } finally {
      setSelectingOrganisation(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
          <div className="sticky top-0 flex h-screen flex-col">
            <Link href="/" className="flex min-h-16 items-center gap-3 border-b border-[var(--color-border)] px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                <Image src="/gridready-logo.svg" alt="GridReady AI" width={25} height={25} priority />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-primary)]">
                  GridReady AI
                </span>
                <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">Service portal</span>
              </span>
            </Link>

            <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Portal navigation">
              {navigationItems.map((item) => {
                const active = pathname === item.href || (item.href !== "/intake" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]",
                      active
                        ? "bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]",
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-[var(--color-border)] p-3">
              {user ? (
                <div className="mb-3 rounded-md bg-[var(--color-surface-muted)] px-3 py-2">
                  <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">{user.email}</p>
                  <p className="mt-0.5 text-xs capitalize text-[var(--color-text-secondary)]">{role}</p>
                </div>
              ) : null}
              <button type="button" className={secondaryButtonClass}>
                <Settings size={16} />
                Settings
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--background)]/90 backdrop-blur-xl">
            <div className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 xl:flex-row xl:items-center xl:justify-between xl:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href="/intake"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm shadow-[var(--color-shadow)] lg:hidden"
                >
                  <Image src="/gridready-logo.svg" alt="GridReady AI" width={25} height={25} priority />
                </Link>
                <div className="min-w-0">
                  {eyebrow ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">
                      {eyebrow}
                    </p>
                  ) : null}
                  <h1 className="truncate text-lg font-semibold text-[var(--color-text-primary)] sm:text-xl">{title}</h1>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <GlobalSearch className="hidden xl:block" />
                {actions}
                <Link href="/intake/requests/new" className={primaryButtonClass}>
                  <Plus size={16} />
                  Start request
                </Link>
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-pressed={displayedTheme === "dark"}
                  className={secondaryButtonClass}
                  title={displayedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {displayedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                  {displayedTheme === "dark" ? "Light" : "Dark"}
                </button>
                <button type="button" onClick={signOut} className={secondaryButtonClass} title="Sign out">
                  <LogOut size={16} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            </div>

            <div className="border-t border-[var(--color-border)] px-4 py-2 xl:hidden">
              <GlobalSearch />
            </div>

            <nav className="flex gap-2 overflow-x-auto border-t border-[var(--color-border)] px-4 py-2 lg:hidden" aria-label="Mobile navigation">
              {navigationItems.map((item) => {
                const active = pathname === item.href || (item.href !== "/intake" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(
                      "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold",
                      active
                        ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 xl:px-8">
            {needsOrganisationSelection ? (
              <section className="mb-5 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4" role="alert">
                <p className="font-semibold text-[var(--color-text-primary)]">Choose an organisation</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Your account belongs to more than one organisation. Select the active account context.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <select
                    className="min-h-10 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                    value={selectedOrganisationId}
                    onChange={(event) => setSelectedOrganisationId(event.target.value)}
                  >
                    {organisationChoices.map((organisation) => (
                      <option key={organisation.id} value={organisation.id}>{organisation.name}</option>
                    ))}
                  </select>
                  <button
                    className={primaryButtonClass}
                    disabled={!selectedOrganisationId || selectingOrganisation}
                    onClick={chooseOrganisation}
                    type="button"
                  >
                    {selectingOrganisation ? "Selecting..." : "Continue"}
                  </button>
                </div>
                {organisationError ? <p className="mt-2 text-sm text-[var(--color-danger)]">{organisationError}</p> : null}
              </section>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
