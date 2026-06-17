import Link from "next/link";
import { FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-primitives";

export default function ReportsIndexPage() {
  return (
    <AppShell eyebrow="Report workbench" title="Reports">
      <EmptyState
        icon={<FileText size={20} />}
        title="Report workbench route prepared"
        description="Report package requests and section-level report work will move here in the next slice. Existing report previews remain available from assessment records."
        action={<Link href="/intake/assessments" className={primaryButtonClass}>Open assessment queue</Link>}
        secondaryAction={<Link href="/intake/workspace" className={secondaryButtonClass}>Open existing console</Link>}
      />
    </AppShell>
  );
}

