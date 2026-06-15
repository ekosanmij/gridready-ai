import { ReportPreview } from "@/components/report-preview";

export default async function ReportPreviewPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  return <ReportPreview assessmentId={assessmentId} />;
}
