import { AppShell } from "@/components/app-shell/app-shell";
import { AssessmentStatusPage } from "@/components/work-queue/assessment-status-page";

export default async function RequestStatusRoute({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;

  return (
    <AppShell eyebrow="Request tracking" title="Request status">
      <AssessmentStatusPage assessmentId={requestId} />
    </AppShell>
  );
}
