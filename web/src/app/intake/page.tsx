import { AppShell } from "@/components/app-shell/app-shell";
import { PortalHome } from "@/components/portal-home/portal-home";

export default function IntakePage() {
  return (
    <AppShell eyebrow="GridReady service portal" title="Home">
      <PortalHome />
    </AppShell>
  );
}
