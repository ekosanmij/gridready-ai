import { AppShell } from "@/components/app-shell/app-shell";
import { EvidenceWorkbench } from "@/components/workbenches/evidence-workbench";

export default function EvidencePage() {
  return (
    <AppShell eyebrow="Evidence workbench" title="Evidence">
      <EvidenceWorkbench />
    </AppShell>
  );
}
