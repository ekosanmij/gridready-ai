import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { SmartIntakeForm } from "@/components/smart-intake/smart-intake-form";
import { secondaryButtonClass } from "@/components/ui-primitives";
import { getIntakeRequestType, intakeRequestTypes } from "@/lib/intake-request-types";

export function generateStaticParams() {
  return intakeRequestTypes.map((requestType) => ({ requestType: requestType.id }));
}

export default async function SmartRequestPage({
  params,
}: {
  params: Promise<{ requestType: string }>;
}) {
  const { requestType: requestTypeId } = await params;
  const requestType = getIntakeRequestType(requestTypeId);

  if (!requestType) {
    notFound();
  }

  return (
    <AppShell
      actions={<Link href="/intake/requests/new" className={secondaryButtonClass}>Request catalog</Link>}
      eyebrow="Smart intake"
      title={requestType.shortLabel}
    >
      <SmartIntakeForm requestType={requestType} />
    </AppShell>
  );
}

