import { AssessmentStatus } from "@/lib/intake";

export type PortalAssessmentRecord = {
  assessment_name: string;
  desired_energization_date: string | null;
  id: string;
  intake_completeness_score: number;
  known_tsp: string | null;
  known_utility: string | null;
  market_region: string;
  projects?: PortalProjectRecord | PortalProjectRecord[] | null;
  sites?: PortalSiteRecord | PortalSiteRecord[] | null;
  status: AssessmentStatus;
  target_load_mw: number | null;
  updated_at: string;
};

export type PortalProjectRecord = {
  name: string;
  organisations?: PortalOrganisationRecord | PortalOrganisationRecord[] | null;
};

export type PortalOrganisationRecord = {
  name: string;
};

export type PortalSiteRecord = {
  address: string | null;
  city: string | null;
  county: string | null;
  site_name: string;
  state: string | null;
};

export function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function formatPortalDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function getPortalNextAction(assessment: PortalAssessmentRecord) {
  if (
    assessment.intake_completeness_score < 100 ||
    assessment.status === "draft" ||
    assessment.status === "intake_incomplete"
  ) {
    return { label: "Complete intake", tone: "warning" as const };
  }

  if (assessment.status === "intake_complete" || assessment.status === "in_analyst_review") {
    return { label: "Analyst review", tone: "info" as const };
  }

  if (assessment.status === "in_expert_review") {
    return { label: "Expert review", tone: "warning" as const };
  }

  if (assessment.status === "report_drafting") {
    return { label: "Draft report", tone: "brand" as const };
  }

  if (assessment.status === "final_review") {
    return { label: "Final review", tone: "info" as const };
  }

  if (assessment.status === "delivered") {
    return { label: "Delivered", tone: "success" as const };
  }

  return { label: "Open workspace", tone: "neutral" as const };
}

export function portalAssessmentSearchText(assessment: PortalAssessmentRecord) {
  const site = single(assessment.sites);
  const project = single(assessment.projects);
  const organisation = single(project?.organisations);

  return [
    assessment.assessment_name,
    assessment.market_region,
    assessment.status,
    assessment.known_utility,
    assessment.known_tsp,
    site?.site_name,
    site?.address,
    site?.city,
    site?.county,
    site?.state,
    project?.name,
    organisation?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

