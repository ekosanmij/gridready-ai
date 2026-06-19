import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateReportPdf, generateSiteMapPng } from "@/lib/report-artifact-generator";
import type { AssessmentReportVersionRecord, ReportVersionSnapshot } from "@/lib/report-artifacts";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Report artifact generation failed.";
}

function slug(value: unknown) {
  return String(value || "gridready-assessment")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "gridready-assessment";
}

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest, context: { params: Promise<{ assessmentId: string }> }) {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const { assessmentId } = await context.params;
  const body = await request.json().catch(() => ({})) as { exportId?: string; retry?: boolean };
  let reportVersionId = "";

  try {
    const { data: versionData, error: versionError } = await client
      .rpc("request_report_artifact_generation", {
        p_assessment_id: assessmentId,
        p_export_id: body.exportId || null,
        p_force: Boolean(body.retry),
      })
      .single();
    if (versionError) throw versionError;

    const version = versionData as AssessmentReportVersionRecord & { content_snapshot: ReportVersionSnapshot };
    reportVersionId = version.id;
    if (version.status === "ready" || version.status === "delivered") {
      return NextResponse.json({ reportVersion: version, reused: true });
    }

    const snapshot = version.content_snapshot;
    const mapPng = await generateSiteMapPng(snapshot);
    const reportPdf = await generateReportPdf(snapshot, mapPng);
    const baseName = slug(snapshot.assessment.assessment_name);
    const folder = `${version.organisation_id}/${assessmentId}/v${version.version_number}`;
    const mapFileName = `${baseName}-v${version.version_number}-site-map.png`;
    const pdfFileName = `${baseName}-v${version.version_number}-report.pdf`;
    const mapPath = `${folder}/${mapFileName}`;
    const pdfPath = `${folder}/${pdfFileName}`;

    const [{ error: mapUploadError }, { error: pdfUploadError }] = await Promise.all([
      client.storage.from("report-artifacts").upload(mapPath, mapPng, { contentType: "image/png", upsert: true }),
      client.storage.from("report-artifacts").upload(pdfPath, reportPdf, { contentType: "application/pdf", upsert: true }),
    ]);
    if (mapUploadError) throw mapUploadError;
    if (pdfUploadError) throw pdfUploadError;

    const { data: completedVersion, error: completeError } = await client
      .rpc("complete_report_artifact_generation", {
        p_artifacts: [
          {
            artifact_type: "report_pdf",
            byte_size: reportPdf.byteLength,
            file_name: pdfFileName,
            metadata: { generator: "pdf-lib", map_artifact: mapFileName, schema_version: snapshot.schema_version },
            mime_type: "application/pdf",
            sha256: sha256(reportPdf),
            storage_path: pdfPath,
          },
          {
            artifact_type: "site_map",
            byte_size: mapPng.byteLength,
            file_name: mapFileName,
            metadata: { asset_count: snapshot.grid_assets.length, generator: "sharp-svg", source_note: "Coordinate-based screening map" },
            mime_type: "image/png",
            sha256: sha256(mapPng),
            storage_path: mapPath,
          },
        ],
        p_report_version_id: version.id,
      })
      .single();
    if (completeError) throw completeError;

    return NextResponse.json({ reportVersion: completedVersion, reused: false });
  } catch (error) {
    const message = errorMessage(error);
    if (reportVersionId) {
      await client.rpc("fail_report_artifact_generation", {
        p_error: message,
        p_report_version_id: reportVersionId,
      });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
