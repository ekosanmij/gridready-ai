import { AssessmentWorkspace } from "@/components/assessment-workspace/assessment-workspace";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function RequestStatusRoute({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;

  return (
    <AppShell eyebrow="Request tracking" title="Request status">
      <AssessmentWorkspace assessmentId={requestId} />
    </AppShell>
  );
}
