import Link from "next/link";
import { AssessmentWorkspace } from "@/components/assessment-workspace/assessment-workspace";
import { AppShell } from "@/components/app-shell/app-shell";
import { secondaryButtonClass } from "@/components/ui-primitives";

export default async function AssessmentDetailRoute({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  return (
    <AppShell
      actions={<Link href="/intake/assessments" className={secondaryButtonClass}>Assessment queue</Link>}
      eyebrow="Analyst workspace"
      title="Workspace"
    >
      <AssessmentWorkspace assessmentId={assessmentId} />
    </AppShell>
  );
}
