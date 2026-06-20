export type ReportArtifactType = "report_pdf" | "site_map";
export type ReportVersionStatus = "delivered" | "failed" | "generating" | "ready";

export type AssessmentReportVersionRecord = {
  created_at: string;
  delivered_at: string | null;
  generated_at: string | null;
  generation_attempts: number;
  generation_error: string | null;
  generation_token?: string;
  id: string;
  organisation_id: string;
  report_export_id: string;
  requested_at: string;
  requested_by: string;
  site_assessment_id: string;
  snapshot_checksum: string;
  status: ReportVersionStatus;
  template_id: string;
  template_version: string;
  updated_at: string;
  version_number: number;
};

export type ReportArtifactRecord = {
  artifact_type: ReportArtifactType;
  byte_size: number;
  created_at: string;
  file_name: string;
  id: string;
  metadata: Record<string, unknown>;
  mime_type: string;
  organisation_id: string;
  report_version_id: string;
  sha256: string;
  site_assessment_id: string;
  storage_path?: string;
};

export type ReportDeliveryRecord = {
  created_at: string;
  delivered_at: string;
  delivered_by: string;
  id: string;
  organisation_id: string;
  recipient_user_id: string | null;
  report_version_id: string;
  revocation_reason: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  site_assessment_id: string;
};

export type ReportVersionPackage = AssessmentReportVersionRecord & {
  artifacts: ReportArtifactRecord[];
  deliveries: ReportDeliveryRecord[];
};

export type ReportVersionSnapshot = {
  assessment: Record<string, unknown> & { assessment_name?: string; market_region?: string };
  captured_at: string;
  claim_evidence_links: Array<Record<string, unknown>>;
  claim_lineage: Array<Record<string, unknown>>;
  evidence_gaps: Array<Record<string, unknown>>;
  evidence_sources: Array<Record<string, unknown>>;
  expert_review: (Record<string, unknown> & { approved_at?: string; reviewer_name?: string }) | null;
  expert_review_checklist: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  grid_assets: Array<Record<string, unknown>>;
  organisation: Record<string, unknown> & { name?: string };
  project: Record<string, unknown> & { name?: string };
  report_version: {
    export_id: string;
    finalized_at: string;
    preflight_run_id: string;
    template_id: string;
    template_version: string;
    version_number: number;
  };
  schema_version: number;
  score_calculation: Record<string, unknown> | null;
  scores: Array<Record<string, unknown>>;
  sections: Array<Record<string, unknown>>;
  site: (Record<string, unknown> & {
    address?: string;
    city?: string;
    county?: string;
    latitude?: number;
    longitude?: number;
    site_name?: string;
    state?: string;
  }) | null;
  template: Record<string, unknown>;
  verdict: Record<string, unknown> | null;
};

export function reportArtifactTypeLabel(value: ReportArtifactType) {
  return value === "report_pdf" ? "Issued report PDF" : "Site map";
}

export function reportVersionStatusLabel(value: ReportVersionStatus) {
  return {
    delivered: "Delivered",
    failed: "Generation failed",
    generating: "Generating",
    ready: "Ready to deliver",
  }[value];
}

export function formatArtifactSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
