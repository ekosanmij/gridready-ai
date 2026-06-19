import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type AuthorizedArtifact = {
  artifact_id: string;
  delivery_id: string | null;
  file_name: string;
  mime_type: string;
  storage_path: string;
};

export async function GET(request: NextRequest, context: { params: Promise<{ artifactId: string }> }) {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const { artifactId } = await context.params;
  const { data, error } = await client.rpc("authorize_report_artifact_download", { p_artifact_id: artifactId }).single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Artifact is not available." }, { status: 403 });

  const artifact = data as AuthorizedArtifact;
  const { data: signedData, error: signedError } = await client.storage
    .from("report-artifacts")
    .createSignedUrl(artifact.storage_path, 60, { download: artifact.file_name });
  if (signedError || !signedData.signedUrl) {
    return NextResponse.json({ error: signedError?.message ?? "Could not create the download link." }, { status: 500 });
  }

  const { error: auditError } = await client.rpc("record_report_artifact_download", {
    p_artifact_id: artifact.artifact_id,
    p_delivery_id: artifact.delivery_id,
    p_metadata: {
      link_ttl_seconds: 60,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 });

  const response = NextResponse.redirect(signedData.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
