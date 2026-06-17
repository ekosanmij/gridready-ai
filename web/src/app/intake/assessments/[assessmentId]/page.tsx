import Link from "next/link";
import { AppShell } from "@/components/app-shell/app-shell";
import { secondaryButtonClass } from "@/components/ui-primitives";
import { AssessmentStatusPage } from "@/components/work-queue/assessment-status-page";

export default async function AssessmentDetailRoute({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  return (
    <AppShell
      actions={<Link href="/intake/assessments" className={secondaryButtonClass}>Assessment queue</Link>}
      eyebrow="Assessment status"
      title="Workspace"
    >
      <AssessmentStatusPage assessmentId={assessmentId} />
    </AppShell>
  );
}

