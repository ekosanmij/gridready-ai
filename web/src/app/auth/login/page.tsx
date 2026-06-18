"use client";

import { FormEvent, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { inputClass, primaryButtonClass } from "@/components/ui-primitives";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next?.startsWith("/") ? next : "/intake");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl shadow-[var(--color-shadow)]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
            <Image src="/gridready-logo.svg" alt="GridReady AI" width={27} height={27} priority />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">GridReady AI</p>
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Sign in to the workbench</h1>
          </div>
        </div>
        <form onSubmit={signIn} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
            Email
            <input className={`${inputClass} mt-1.5`} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
            Password
            <input className={`${inputClass} mt-1.5`} type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p role="alert" className="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p> : null}
          {!hasSupabaseConfig ? <p role="alert" className="text-sm text-[var(--color-danger)]">Supabase environment variables are not configured.</p> : null}
          <button className={`${primaryButtonClass} w-full`} disabled={submitting || !hasSupabaseConfig} type="submit">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
