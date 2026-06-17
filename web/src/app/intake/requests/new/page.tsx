import { AppShell } from "@/components/app-shell/app-shell";
import { RequestCatalog } from "@/components/request-catalog/request-catalog";

export default function NewRequestPage() {
  return (
    <AppShell eyebrow="Request catalog" title="Start request">
      <RequestCatalog />
    </AppShell>
  );
}

