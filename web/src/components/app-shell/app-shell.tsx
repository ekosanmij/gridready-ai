"use client";

import {
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useSyncExternalStore } from "react";
import { GlobalSearch } from "@/components/global-search/global-search";
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

const navigationItems = [
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

  useEffect(() => {
    applyThemePreference(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme: ThemePreference = theme === "dark" ? "light" : "dark";
    setThemePreference(nextTheme);
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

          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 xl:px-8">{children}</div>
        </div>
      </div>
    </main>
  );
}
