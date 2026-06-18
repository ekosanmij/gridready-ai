"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { canManageAssessments, type AppRole } from "@/components/auth/auth-provider";
import { StatusPill, primaryButtonClass, secondaryButtonClass } from "@/components/ui-primitives";
import { Drawer } from "@/components/ui/drawer";
import type { AssessmentDetailRecord, SmartSignal } from "@/lib/assessment-workspace";
import type { GridAssetRecord } from "@/lib/gis";
import { deriveUtilityTspSuggestions, type TerritoryInference } from "@/lib/inference";
import { supabase } from "@/lib/supabase";

type Suggestion = {
  confidence_level: "high" | "medium" | "low";
  field_name: "known_tsp" | "known_utility";
  id: string;
  rationale: string | null;
  source: string | null;
  suggested_value: string;
};

export function SmartAssistant({ assessment, gridAssets, role, signals, onApplied }: {
  assessment: AssessmentDetailRecord;
  gridAssets: GridAssetRecord[];
  role: AppRole;
  signals: SmartSignal[];
  onApplied: (field: "known_tsp" | "known_utility", value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const editable = canManageAssessments(role);

  const loadSuggestions = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("assessment_suggestions").select("id, field_name, suggested_value, confidence_level, rationale, source").eq("site_assessment_id", assessment.id).eq("status", "pending").order("created_at", { ascending: false });
    setSuggestions((data ?? []) as Suggestion[]);
  }, [assessment.id]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from("assessment_suggestions").select("id, field_name, suggested_value, confidence_level, rationale, source").eq("site_assessment_id", assessment.id).eq("status", "pending").order("created_at", { ascending: false }).then(({ data }) => {
      if (active) setSuggestions((data ?? []) as Suggestion[]);
    });
    return () => { active = false; };
  }, [assessment.id]);

  async function infer() {
    if (!supabase || !editable) return;
    const site = Array.isArray(assessment.sites) ? assessment.sites[0] : assessment.sites;
    if (typeof site?.latitude !== "number" || typeof site.longitude !== "number") {
      setMessage("Add valid site coordinates before running geospatial inference.");
      return;
    }
    setRunning(true);
    setMessage("");
    const { data, error } = await supabase.rpc("infer_utility_tsp", { latitude: site.latitude, longitude: site.longitude, market: assessment.market_region || null });
    if (error) {
      setMessage(error.message);
      setRunning(false);
      return;
    }
    const territory = ((data ?? [])[0] as TerritoryInference | undefined) ?? null;
    const inferred = deriveUtilityTspSuggestions(territory, gridAssets, assessment);
    for (const item of inferred) {
      const alreadyPending = suggestions.some((suggestion) => suggestion.field_name === item.field && suggestion.suggested_value === item.value);
      if (!alreadyPending) await supabase.from("assessment_suggestions").insert({ site_assessment_id: assessment.id, suggestion_type: "geospatial_utility_tsp", field_name: item.field, suggested_value: item.value, confidence_level: item.confidence, rationale: item.rationale, source: item.source });
    }
    setMessage(inferred.length ? `${inferred.length} inference suggestion${inferred.length === 1 ? "" : "s"} ready for review.` : "No new territory or nearby-asset match was found.");
    await loadSuggestions();
    setRunning(false);
  }

  async function resolve(suggestion: Suggestion, status: "accepted" | "dismissed") {
    if (!supabase || !editable) return;
    if (status === "accepted") {
      const { error } = await supabase.from("site_assessments").update({ [suggestion.field_name]: suggestion.suggested_value }).eq("id", assessment.id);
      if (error) { setMessage(error.message); return; }
      onApplied(suggestion.field_name, suggestion.suggested_value);
    }
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("assessment_suggestions").update({ status, resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null }).eq("id", suggestion.id);
    await loadSuggestions();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${secondaryButtonClass} w-full`}><Sparkles size={16} /> Smart assistance {suggestions.length ? `(${suggestions.length})` : ""}</button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Smart assistance" description="Review proactive checks and explicitly accept or dismiss inferred values.">
        <div className="space-y-5">
          {editable ? <button type="button" onClick={() => void infer()} disabled={running} className={`${primaryButtonClass} w-full`}>{running ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Run utility/TSP inference</button> : null}
          {message ? <p aria-live="polite" className="rounded-md bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">{message}</p> : null}
          {suggestions.map((suggestion) => <article key={suggestion.id} className="rounded-md border border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] p-3"><div className="flex flex-wrap items-center gap-2"><StatusPill tone="brand">{suggestion.field_name === "known_tsp" ? "TSP" : "Utility"}</StatusPill><StatusPill tone="info">{suggestion.confidence_level} confidence</StatusPill></div><p className="mt-2 font-semibold text-[var(--color-text-primary)]">{suggestion.suggested_value}</p><p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{suggestion.rationale}</p>{suggestion.source ? <p className="mt-2 break-all text-xs text-[var(--color-text-secondary)]">Source: {suggestion.source}</p> : null}{editable ? <div className="mt-3 flex gap-2"><button type="button" className={primaryButtonClass} onClick={() => void resolve(suggestion, "accepted")}><Check size={16} /> Apply</button><button type="button" className={secondaryButtonClass} onClick={() => void resolve(suggestion, "dismissed")}><X size={16} /> Dismiss</button></div> : null}</article>)}
          <div className="space-y-2"><h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Other checks</h3>{signals.map((signal) => <article key={signal.label} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"><div className="flex flex-wrap items-center gap-2"><StatusPill tone={signal.tone}>{signal.label}</StatusPill><span className="text-xs text-[var(--color-text-secondary)]">{signal.confidence} confidence</span></div><p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{signal.body}</p></article>)}</div>
        </div>
      </Drawer>
    </>
  );
}
