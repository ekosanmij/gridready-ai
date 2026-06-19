"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, FileDown, FileOutput, Loader2, RefreshCw, Send } from "lucide-react";
import type { AppRole } from "@/components/auth/auth-provider";
import { FieldControl, StatusPill, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-primitives";
import type { AssessmentReportExportRecord } from "@/lib/report-builder";
import {
  type AssessmentReportVersionRecord,
  type ReportArtifactRecord,
  type ReportDeliveryRecord,
  type ReportVersionPackage,
  formatArtifactSize,
  reportArtifactTypeLabel,
  reportVersionStatusLabel,
} from "@/lib/report-artifacts";
import { supabase } from "@/lib/supabase";

function statusTone(status: AssessmentReportVersionRecord["status"]) {
  if (status === "delivered" || status === "ready") return "success" as const;
  if (status === "failed") return "danger" as const;
  return "info" as const;
}

export function ReportDeliveryPanel({
  assessmentId,
  onChanged,
  reportExport,
  role,
}: {
  assessmentId: string;
  onChanged: () => void;
  reportExport: AssessmentReportExportRecord | null;
  role: AppRole;
}) {
  const canIssue = role === "admin" || role === "analyst";
  const [versions, setVersions] = useState<ReportVersionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revokeReasons, setRevokeReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [versionResult, artifactResult, deliveryResult] = await Promise.all([
      supabase
        .from("assessment_report_versions")
        .select("id, report_export_id, site_assessment_id, organisation_id, template_id, template_version, version_number, status, snapshot_checksum, generation_attempts, generation_error, requested_by, requested_at, generated_at, delivered_at, created_at, updated_at")
        .eq("site_assessment_id", assessmentId)
        .order("version_number", { ascending: false }),
      supabase
        .from("report_artifacts")
        .select("id, report_version_id, site_assessment_id, organisation_id, artifact_type, file_name, mime_type, byte_size, sha256, metadata, created_at")
        .eq("site_assessment_id", assessmentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("report_deliveries")
        .select("id, report_version_id, site_assessment_id, organisation_id, recipient_user_id, delivered_by, delivered_at, revoked_at, revoked_by, revocation_reason, created_at")
        .eq("site_assessment_id", assessmentId)
        .order("delivered_at", { ascending: false }),
    ]);
    setLoading(false);
    const loadError = versionResult.error ?? artifactResult.error ?? deliveryResult.error;
    if (loadError) {
      setError(loadError.message);
      return;
    }
    const artifacts = (artifactResult.data ?? []) as ReportArtifactRecord[];
    const deliveries = (deliveryResult.data ?? []) as ReportDeliveryRecord[];
    setVersions(((versionResult.data ?? []) as AssessmentReportVersionRecord[]).map((version) => ({
      ...version,
      artifacts: artifacts.filter((artifact) => artifact.report_version_id === version.id),
      deliveries: deliveries.filter((delivery) => delivery.report_version_id === version.id),
    })));
    setError("");
  }, [assessmentId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  async function generate(retry = false) {
    if (!canIssue || !reportExport) return;
    setWorkingId("generate");
    setError("");
    setMessage("");
    const response = await fetch(`/api/reports/${assessmentId}/artifacts`, {
      body: JSON.stringify({ exportId: reportExport.id, retry }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = await response.json() as { error?: string; reused?: boolean };
    setWorkingId("");
    if (!response.ok) {
      setError(result.error ?? "Could not generate report artifacts.");
      await load();
      return;
    }
    setMessage(result.reused ? "The issued artifact package already exists for this report version." : "PDF and map artifacts generated and checksumed.");
    await load();
    onChanged();
  }

  async function deliver(versionId: string) {
    if (!supabase || !canIssue) return;
    setWorkingId(`deliver-${versionId}`);
    setError("");
    const { error: deliveryError } = await supabase.rpc("deliver_report_version", {
      p_recipient_user_id: null,
      p_report_version_id: versionId,
    });
    setWorkingId("");
    if (deliveryError) {
      setError(deliveryError.message);
      return;
    }
    setMessage("Report version delivered to active customer members of the organisation.");
    await load();
    onChanged();
  }

  async function revoke(deliveryId: string) {
    if (!supabase || !canIssue) return;
    const reason = revokeReasons[deliveryId]?.trim() ?? "";
    if (reason.length < 10) {
      setError("Enter a substantive revocation reason of at least 10 characters.");
      return;
    }
    setWorkingId(`revoke-${deliveryId}`);
    const { error: revokeError } = await supabase.rpc("revoke_report_delivery", {
      p_delivery_id: deliveryId,
      p_reason: reason,
    });
    setWorkingId("");
    if (revokeError) {
      setError(revokeError.message);
      return;
    }
    setMessage("Delivery access revoked. Previously issued links expire within 60 seconds.");
    setRevokeReasons((current) => ({ ...current, [deliveryId]: "" }));
    await load();
    onChanged();
  }

  const currentVersion = reportExport?.version_number ?? 0;
  const hasCurrentVersion = versions.some((version) => version.version_number === currentVersion);

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Issued artifacts and delivery</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Versioned PDF and map files are private, checksumed, and delivered through expiring audited links.</p>
        </div>
        {canIssue && reportExport?.version_number ? (
          <button className={primaryButtonClass} disabled={workingId === "generate" || hasCurrentVersion} onClick={() => void generate(false)} type="button">
            {workingId === "generate" ? <Loader2 className="animate-spin" size={16} /> : <FileOutput size={16} />}
            Generate version {reportExport.version_number}
          </button>
        ) : null}
      </div>

      {loading ? <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"><Loader2 className="animate-spin" size={16} /> Loading issued versions</p> : null}
      {!loading && versions.length === 0 ? <p className="mt-4 text-sm text-[var(--color-text-secondary)]">No issued artifact version is available yet.</p> : null}

      <div className="mt-4 space-y-3">
        {versions.map((version) => {
          const activeDeliveries = version.deliveries.filter((delivery) => !delivery.revoked_at);
          return (
            <article className="rounded-md border border-[var(--color-border)] bg-white p-4" key={version.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold">Report version {version.version_number}</h4>
                    <StatusPill tone={statusTone(version.status)}>{reportVersionStatusLabel(version.status)}</StatusPill>
                    {activeDeliveries.length ? <StatusPill tone="success">customer access active</StatusPill> : null}
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Snapshot {version.snapshot_checksum.slice(0, 12)} | Attempt {version.generation_attempts}</p>
                </div>
                {canIssue && (version.status === "failed" || version.status === "generating") ? <button className={secondaryButtonClass} disabled={workingId === "generate"} onClick={() => void generate(true)} type="button"><RefreshCw size={16} /> Retry</button> : null}
                {canIssue && version.status === "ready" ? <button className={primaryButtonClass} disabled={workingId === `deliver-${version.id}`} onClick={() => void deliver(version.id)} type="button">{workingId === `deliver-${version.id}` ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Deliver to customer organisation</button> : null}
              </div>

              {version.generation_error ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{version.generation_error}</p> : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {version.artifacts.map((artifact) => (
                  <a className={`${secondaryButtonClass} justify-between`} href={`/api/report-artifacts/${artifact.id}/download`} key={artifact.id}>
                    <span className="flex items-center gap-2"><FileDown size={16} /> {reportArtifactTypeLabel(artifact.artifact_type)}</span>
                    <span className="text-xs font-normal text-[var(--color-text-secondary)]">{formatArtifactSize(artifact.byte_size)}</span>
                  </a>
                ))}
              </div>

              {canIssue ? activeDeliveries.map((delivery) => (
                <div className="mt-3 grid gap-2 border-t border-[var(--color-border)] pt-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)_auto] md:items-end" key={delivery.id}>
                  <p className="text-sm text-[var(--color-text-secondary)]">Delivered {new Date(delivery.delivered_at).toLocaleString()} to {delivery.recipient_user_id ? "one customer" : "all active customer members"}.</p>
                  <FieldControl label="Revocation reason"><input className={inputClass} value={revokeReasons[delivery.id] ?? ""} onChange={(event) => setRevokeReasons((current) => ({ ...current, [delivery.id]: event.target.value }))} /></FieldControl>
                  <button className={secondaryButtonClass} disabled={workingId === `revoke-${delivery.id}`} onClick={() => void revoke(delivery.id)} type="button">{workingId === `revoke-${delivery.id}` ? <Loader2 className="animate-spin" size={16} /> : <Ban size={16} />} Revoke</button>
                </div>
              )) : null}
            </article>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-[var(--color-danger)]" role="alert">{error}</p> : null}
      {message ? <p aria-live="polite" className="mt-3 text-sm text-[var(--color-text-secondary)]">{message}</p> : null}
    </section>
  );
}
