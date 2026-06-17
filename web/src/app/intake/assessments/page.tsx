import { AppShell } from "@/components/app-shell/app-shell";
import { AssessmentQueue } from "@/components/work-queue/assessment-queue";

export default function AssessmentsPage() {
  return (
    <AppShell eyebrow="Analyst workspace" title="Assessment queue">
      <AssessmentQueue />
    </AppShell>
  );
}

