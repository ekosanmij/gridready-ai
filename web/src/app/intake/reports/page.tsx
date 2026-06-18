import { AppShell } from "@/components/app-shell/app-shell";
import { ReportWorkbench } from "@/components/workbenches/report-workbench";

export default function ReportsIndexPage() {
  return (
    <AppShell eyebrow="Report workbench" title="Reports">
      <ReportWorkbench />
    </AppShell>
  );
}
