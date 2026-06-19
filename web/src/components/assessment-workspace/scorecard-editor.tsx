"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { canManageAssessments, type AppRole } from "@/components/auth/auth-provider";
import {
  FieldControl,
  StatusPill,
  inputClass,
  primaryButtonClass,
  textareaClass,
} from "@/components/ui-primitives";
import { evidenceConfidenceLevels, riskLevels } from "@/lib/evidence";
import {
  type AssessmentScoreCalculationRecord,
  type AssessmentScoreDraft,
  type AssessmentScoreRecord,
  type AssessmentVerdictDraft,
  type AssessmentVerdictRecord,
  type ScoreModuleKey,
  buildScoreDrafts,
  calculateScorecardSummary,
  createVerdictDraft,
  parseScoreInput,
  readinessBandLabel,
  scoreComponents,
  validateScoreDraft,
  verdictOptions,
} from "@/lib/scorecard";
import { saveAssessmentScores, saveAssessmentVerdict } from "@/lib/scorecard-service";
import { supabase } from "@/lib/supabase";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

export function ScorecardEditor({
  assessmentId,
  calculation,
  onChanged,
  role,
  scores,
  verdict,
}: {
  assessmentId: string;
  calculation: AssessmentScoreCalculationRecord | null;
  onChanged: () => void;
  role: AppRole;
  scores: AssessmentScoreRecord[];
  verdict: AssessmentVerdictRecord | null;
}) {
  const [scoreDrafts, setScoreDrafts] = useState(() => buildScoreDrafts(scores));
  const [verdictDraft, setVerdictDraft] = useState(() => createVerdictDraft(verdict));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingScores, setSavingScores] = useState(false);
  const [savingVerdict, setSavingVerdict] = useState(false);
  const editable = canManageAssessments(role);
  const summary = calculateScorecardSummary(scores);
  const scoresByModule = useMemo(() => new Map(scores.map((score) => [score.module_key, score])), [scores]);

  function updateScore(moduleKey: ScoreModuleKey, updates: Partial<AssessmentScoreDraft>) {
    setScoreDrafts((current) => ({
      ...current,
      [moduleKey]: { ...current[moduleKey], ...updates },
    }));
    setError("");
    setMessage("");
  }

  async function submitScores(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editable) return;

    const validationErrors: string[] = [];
    const payloads = scoreComponents.flatMap((component) => {
      const draft = scoreDrafts[component.value];
      if (!draft.score.trim()) return [];
      const validationError = validateScoreDraft(component.label, draft);
      const score = parseScoreInput(draft.score);
      if (validationError || score === null) {
        validationErrors.push(validationError ?? `${component.label} score is required.`);
        return [];
      }
      return [{
        confidence_level: draft.confidenceLevel,
        module_key: component.value,
        override_note: draft.overrideNote.trim() || null,
        rationale: draft.rationale.trim() || null,
        risk_level: draft.riskLevel,
        score,
      }];
    });

    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      return;
    }
    if (payloads.length === 0) {
      setError("Enter at least one component score before saving.");
      return;
    }

    setSavingScores(true);
    setError("");
    setMessage("");
    try {
      const result = await saveAssessmentScores(supabase, { assessmentId, scores: payloads });
      setMessage(result.overall_score === null
        ? `Scores saved. ${result.saved_component_count} component change(s) recorded; readiness remains incomplete.`
        : `Scores saved. Weighted readiness ${result.overall_score}/100; ${readinessBandLabel(result.readiness_band)}; ${result.overall_confidence} confidence.`);
      onChanged();
    } catch (saveError) {
      setError(errorMessage(saveError, "Could not save the scorecard."));
    } finally {
      setSavingScores(false);
    }
  }

  async function submitVerdict(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editable) return;
    if (!verdictDraft.summary.trim()) {
      setError("A verdict rationale is required.");
      return;
    }
    if (verdictDraft.confidenceLevel === "unknown") {
      setError("Select high, medium or low verdict confidence.");
      return;
    }
    if (!verdictDraft.conditions.trim()) {
      setError("Verdict conditions are required; state explicitly when none apply.");
      return;
    }

    setSavingVerdict(true);
    setError("");
    setMessage("");
    try {
      await saveAssessmentVerdict(supabase, { assessmentId, draft: verdictDraft });
      setMessage("Verdict saved with an immutable history event.");
      onChanged();
    } catch (saveError) {
      setError(errorMessage(saveError, "Could not save the verdict."));
    } finally {
      setSavingVerdict(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Weighted readiness" value={summary.averageScore === null ? "Incomplete" : `${summary.averageScore}/100`} />
        <Metric label="Readiness band" value={readinessBandLabel(calculation?.readiness_band ?? summary.readinessBand)} />
        <Metric label="Independent confidence" value={calculation?.overall_confidence ?? summary.overallConfidence} />
      </div>

      {calculation?.blockers?.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <p className="text-sm font-semibold">Calculation blockers</p>
          <ul className="mt-2 space-y-1 text-sm">
            {calculation.blockers.map((blocker) => <li key={blocker.key}>{blocker.message} {blocker.remediation}</li>)}
          </ul>
        </div>
      ) : null}

      {error ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p> : null}
      {message ? <p aria-live="polite" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p> : null}

      <form onSubmit={submitScores} className="space-y-3">
        {scoreComponents.map((component) => {
          const draft = scoreDrafts[component.value];
          const saved = scoresByModule.get(component.value);
          return (
            <article key={component.value} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{component.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{component.guidance}</p>
                </div>
                <StatusPill tone="info">{Math.round(component.weight * 100)}% weight{saved?.weighted_contribution != null ? ` · ${Number(saved.weighted_contribution).toFixed(1)} pts` : ""}</StatusPill>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <FieldControl label="Score (0–100)"><input className={inputClass} disabled={!editable} min={0} max={100} type="number" value={draft.score} onChange={(event) => updateScore(component.value, { score: event.target.value })} /></FieldControl>
                <FieldControl label="Risk"><select className={inputClass} disabled={!editable} value={draft.riskLevel} onChange={(event) => updateScore(component.value, { riskLevel: event.target.value as AssessmentScoreDraft["riskLevel"] })}>{riskLevels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FieldControl>
                <FieldControl label="Evidence confidence"><select className={inputClass} disabled={!editable} value={draft.confidenceLevel} onChange={(event) => updateScore(component.value, { confidenceLevel: event.target.value as AssessmentScoreDraft["confidenceLevel"] })}>{evidenceConfidenceLevels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FieldControl>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <FieldControl label="Rationale"><textarea className={textareaClass} disabled={!editable} rows={3} value={draft.rationale} onChange={(event) => updateScore(component.value, { rationale: event.target.value })} /></FieldControl>
                <FieldControl label="Override reason"><textarea className={textareaClass} disabled={!editable} rows={3} placeholder="Required when changing a saved value" value={draft.overrideNote} onChange={(event) => updateScore(component.value, { overrideNote: event.target.value })} /></FieldControl>
              </div>
            </article>
          );
        })}
        {editable ? <button className={primaryButtonClass} disabled={savingScores} type="submit">{savingScores ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save weighted scorecard</button> : null}
      </form>

      <form onSubmit={submitVerdict} className="rounded-md border border-[var(--color-border)] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <FieldControl label="Canonical verdict"><select className={inputClass} disabled={!editable} value={verdictDraft.verdict} onChange={(event) => setVerdictDraft((current) => ({ ...current, verdict: event.target.value as AssessmentVerdictDraft["verdict"] }))}>{verdictOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FieldControl>
          <FieldControl label="Verdict confidence"><select className={inputClass} disabled={!editable} value={verdictDraft.confidenceLevel} onChange={(event) => setVerdictDraft((current) => ({ ...current, confidenceLevel: event.target.value as AssessmentVerdictDraft["confidenceLevel"] }))}>{evidenceConfidenceLevels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FieldControl>
          <label className="flex items-end"><span className="inline-flex h-11 w-full items-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3 text-sm font-semibold"><input checked={verdictDraft.approvedByAnalyst} disabled={!editable} type="checkbox" onChange={(event) => setVerdictDraft((current) => ({ ...current, approvedByAnalyst: event.target.checked }))} /> Analyst approved</span></label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <FieldControl label="Verdict rationale"><textarea className={textareaClass} disabled={!editable} required rows={4} value={verdictDraft.summary} onChange={(event) => setVerdictDraft((current) => ({ ...current, summary: event.target.value }))} /></FieldControl>
          <FieldControl label="Conditions"><textarea className={textareaClass} disabled={!editable} required rows={4} placeholder="State the conditions, or explicitly record that none apply" value={verdictDraft.conditions} onChange={(event) => setVerdictDraft((current) => ({ ...current, conditions: event.target.value }))} /></FieldControl>
          <FieldControl label="Key strengths"><textarea className={textareaClass} disabled={!editable} rows={3} value={verdictDraft.keyStrengths} onChange={(event) => setVerdictDraft((current) => ({ ...current, keyStrengths: event.target.value }))} /></FieldControl>
          <FieldControl label="Key risks"><textarea className={textareaClass} disabled={!editable} rows={3} value={verdictDraft.keyRisks} onChange={(event) => setVerdictDraft((current) => ({ ...current, keyRisks: event.target.value }))} /></FieldControl>
          <FieldControl label="Recommended next steps"><textarea className={textareaClass} disabled={!editable} rows={3} value={verdictDraft.recommendedNextSteps} onChange={(event) => setVerdictDraft((current) => ({ ...current, recommendedNextSteps: event.target.value }))} /></FieldControl>
          <FieldControl label="Limitations"><textarea className={textareaClass} disabled={!editable} rows={3} value={verdictDraft.limitationsNote} onChange={(event) => setVerdictDraft((current) => ({ ...current, limitationsNote: event.target.value }))} /></FieldControl>
          <FieldControl label="Change reason"><textarea className={textareaClass} disabled={!editable} rows={3} placeholder="Required when changing verdict, confidence or approval" value={verdictDraft.changeReason} onChange={(event) => setVerdictDraft((current) => ({ ...current, changeReason: event.target.value }))} /></FieldControl>
        </div>
        {editable ? <button className={`${primaryButtonClass} mt-4`} disabled={savingVerdict} type="submit">{savingVerdict ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save verdict</button> : null}
      </form>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">{label}</p><p className="mt-1 font-semibold capitalize text-[var(--color-text-primary)]">{value}</p></div>;
}
