"use client";

import { FileText, Loader2, Search, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { cx, StatusPill } from "@/components/ui-primitives";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type ResultType = "assessment" | "evidence" | "finding" | "report";
type GlobalSearchResult = { href: string; id: string; rank: number; subtitle: string; title: string; type: ResultType };

const resultLabels: Record<ResultType, string> = { assessment: "Request", evidence: "Evidence", finding: "Finding", report: "Report" };

export function GlobalSearch({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = query.trim();

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setFocused(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      if (normalizedQuery.length < 2) {
        setResults([]);
        setError("");
        setLoading(false);
        return;
      }
      if (!hasSupabaseConfig || !supabase) {
        setError("Supabase is not configured.");
        return;
      }
      setLoading(true);
      setError("");
      const { data, error: searchError } = await supabase.rpc("search_portal", { query_text: normalizedQuery, result_limit: 20 });
      if (!cancelled) {
        if (searchError) {
          setError(searchError.message);
          setResults([]);
        } else setResults((data ?? []) as GlobalSearchResult[]);
        setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [normalizedQuery]);

  const grouped = useMemo(() => results.reduce<Record<ResultType, GlobalSearchResult[]>>((groups, result) => {
    groups[result.type].push(result);
    return groups;
  }, { assessment: [], evidence: [], finding: [], report: [] }), [results]);
  const visible = focused && (normalizedQuery.length > 0 || results.length > 0 || Boolean(error));

  return (
    <div ref={containerRef} className={cx("relative min-w-[260px] flex-1", className)}>
      <label className="relative block">
        <span className="sr-only">Search portal</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setFocused(true)} className="h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-9 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]" placeholder="Search requests, evidence, findings, reports" />
        {loading ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-text-secondary)]" size={16} /> : null}
      </label>
      {visible ? <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(680px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-xl shadow-[var(--color-shadow)]">
        {normalizedQuery.length < 2 ? <SearchMessage>Type at least 2 characters to search the portal.</SearchMessage> : error ? <SearchMessage error>{error}</SearchMessage> : !loading && results.length === 0 ? <SearchMessage>No matching indexed records.</SearchMessage> : <div className="space-y-2"><ResultGroup icon={<Sparkles size={15} />} label="Requests" results={grouped.assessment} /><ResultGroup icon={<ShieldCheck size={15} />} label="Evidence" results={grouped.evidence} /><ResultGroup icon={<Search size={15} />} label="Findings" results={grouped.finding} /><ResultGroup icon={<FileText size={15} />} label="Reports" results={grouped.report} /></div>}
      </div> : null}
    </div>
  );
}

function SearchMessage({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={cx("rounded-md px-3 py-4 text-sm", error ? "border border-[var(--color-danger)] bg-[var(--color-danger-soft)] font-medium text-[var(--color-danger)]" : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]")}>{children}</div>;
}

function ResultGroup({ icon, label, results }: { icon: ReactNode; label: string; results: GlobalSearchResult[] }) {
  if (!results.length) return null;
  return <section><div className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">{icon}{label}</div><div className="space-y-1">{results.map((result) => <Link key={result.id} href={result.href} className="block rounded-md px-3 py-2 transition hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{result.title}</p><p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{result.subtitle || "Open record"}</p></div><StatusPill tone={result.type === "assessment" ? "brand" : result.type === "evidence" ? "success" : result.type === "finding" ? "warning" : "info"}>{resultLabels[result.type]}</StatusPill></div></Link>)}</div></section>;
}
