import { AssessmentFormState, AssessmentStatus } from "@/lib/intake";

export type IntakeFieldState =
  | "missing"
  | "not_applicable"
  | "provided"
  | "provided_in_attachment"
  | "to_confirm"
  | "unknown";

export type IntakeRequestTypeId =
  | "evidence-upload"
  | "existing-assessment-update"
  | "investor-underwriting"
  | "portfolio-triage"
  | "report-package"
  | "single-site-screen";

export type IntakeRequestType = {
  defaultStatus: AssessmentStatus;
  description: string;
  expectedOutput: string;
  fieldGroups: Array<{
    description: string;
    fields: Array<keyof AssessmentFormState>;
    id: string;
    title: string;
  }>;
  id: IntakeRequestTypeId;
  minimumRequirements: string[];
  primaryOutcome: string;
  recommendedFields: Array<keyof AssessmentFormState>;
  requiredFields: Array<keyof AssessmentFormState>;
  shortLabel: string;
  slaLabel: string;
  title: string;
};

export const intakeRequestTypes: IntakeRequestType[] = [
  {
    defaultStatus: "draft",
    description: "Start a focused power-feasibility screen for one candidate site.",
    expectedOutput: "Power feasibility intake and analyst-ready assessment workspace",
    fieldGroups: [
      {
        description: "Enough context to create the request and route it correctly.",
        fields: ["organisationName", "contactEmail", "projectName", "confidentialityStatus"],
        id: "requester",
        title: "Requester",
      },
      {
        description: "The site and load facts needed for a first screen.",
        fields: ["siteName", "address", "targetLoadMw", "desiredEnergizationDate"],
        id: "site_power",
        title: "Site and power need",
      },
      {
        description: "Optional context that improves analyst triage.",
        fields: ["knownUtility", "knownTsp", "existingStudiesSummary", "existingPowerQuoteSummary"],
        id: "supporting_context",
        title: "Supporting context",
      },
    ],
    id: "single-site-screen",
    minimumRequirements: ["Requester/customer", "Site name or address", "Target load", "Target energization"],
    primaryOutcome: "Determine whether a site is ready for power diligence.",
    recommendedFields: ["knownUtility", "knownTsp", "existingStudiesSummary", "existingPowerQuoteSummary"],
    requiredFields: ["organisationName", "contactEmail", "projectName", "targetLoadMw", "desiredEnergizationDate"],
    shortLabel: "Single site",
    slaLabel: "5-10 business day report cycle",
    title: "Single-site power feasibility screen",
  },
  {
    defaultStatus: "draft",
    description: "Compare several candidate sites before committing deeper diligence time.",
    expectedOutput: "Portfolio triage request and workspace for follow-up site records",
    fieldGroups: [
      {
        description: "Who owns the portfolio review and why it is being requested.",
        fields: ["organisationName", "contactEmail", "projectName", "projectDeadline"],
        id: "requester",
        title: "Requester",
      },
      {
        description: "Use the description and attachments to describe the portfolio.",
        fields: ["projectDescription", "targetLoadMw", "desiredEnergizationDate", "existingStudiesSummary"],
        id: "portfolio",
        title: "Portfolio summary",
      },
    ],
    id: "portfolio-triage",
    minimumRequirements: ["Customer/sponsor", "Portfolio description", "Decision deadline or target date"],
    primaryOutcome: "Rank candidate sites by diligence readiness.",
    recommendedFields: ["targetLoadMw", "desiredEnergizationDate", "existingStudiesSummary"],
    requiredFields: ["organisationName", "contactEmail", "projectName", "projectDescription"],
    shortLabel: "Portfolio",
    slaLabel: "Triage scope set after intake",
    title: "Portfolio / multi-site triage",
  },
  {
    defaultStatus: "draft",
    description: "Pressure-test a sponsor's power story before an investment decision.",
    expectedOutput: "Investor underwriting request with evidence and risk focus",
    fieldGroups: [
      {
        description: "Decision owner, timeline, and sponsor context.",
        fields: ["organisationName", "contactEmail", "projectName", "projectDeadline"],
        id: "requester",
        title: "Requester",
      },
      {
        description: "What is being underwritten and what evidence exists already.",
        fields: ["siteName", "address", "targetLoadMw", "desiredEnergizationDate", "existingStudiesSummary", "existingPowerQuoteSummary"],
        id: "underwriting",
        title: "Underwriting context",
      },
    ],
    id: "investor-underwriting",
    minimumRequirements: ["Investor/sponsor", "Decision deadline", "Site or portfolio description", "Existing evidence if available"],
    primaryOutcome: "Identify power and interconnection diligence gaps for investment review.",
    recommendedFields: ["siteName", "address", "targetLoadMw", "existingStudiesSummary", "existingPowerQuoteSummary"],
    requiredFields: ["organisationName", "contactEmail", "projectName", "projectDeadline"],
    shortLabel: "Underwriting",
    slaLabel: "Decision timeline driven",
    title: "Investor underwriting review",
  },
  {
    defaultStatus: "draft",
    description: "Submit new information or corrections for an assessment already in motion.",
    expectedOutput: "Updated intake request linked to the assessment workspace",
    fieldGroups: [
      {
        description: "Which assessment changed and who is providing the update.",
        fields: ["organisationName", "contactEmail", "assessmentName", "projectDescription"],
        id: "update",
        title: "Update summary",
      },
      {
        description: "Optional fields that may need correction.",
        fields: ["siteName", "address", "targetLoadMw", "desiredEnergizationDate", "knownUtility", "knownTsp"],
        id: "changed_fields",
        title: "Changed fields",
      },
    ],
    id: "existing-assessment-update",
    minimumRequirements: ["Assessment name or site", "Requester", "Description of what changed"],
    primaryOutcome: "Route updates into the existing assessment workflow.",
    recommendedFields: ["siteName", "address", "knownUtility", "knownTsp"],
    requiredFields: ["organisationName", "contactEmail", "assessmentName", "projectDescription"],
    shortLabel: "Update",
    slaLabel: "Reviewed with active assessment",
    title: "Update an existing assessment",
  },
  {
    defaultStatus: "draft",
    description: "Send studies, quotes, data-room notes, or assumptions for analyst review.",
    expectedOutput: "Evidence intake request ready for analyst tagging",
    fieldGroups: [
      {
        description: "What evidence is being provided and where it should be attached.",
        fields: ["organisationName", "contactEmail", "assessmentName", "existingStudiesSummary", "existingPowerQuoteSummary"],
        id: "evidence",
        title: "Evidence package",
      },
    ],
    id: "evidence-upload",
    minimumRequirements: ["Requester", "Assessment/site reference", "Evidence summary"],
    primaryOutcome: "Turn customer material into evidence and findings.",
    recommendedFields: ["existingStudiesSummary", "existingPowerQuoteSummary"],
    requiredFields: ["organisationName", "contactEmail", "assessmentName"],
    shortLabel: "Evidence",
    slaLabel: "Analyst review queue",
    title: "Evidence / data-room upload",
  },
  {
    defaultStatus: "report_drafting",
    description: "Request a report package or final review for an assessment.",
    expectedOutput: "Report package work item with readiness blockers",
    fieldGroups: [
      {
        description: "Which assessment/report needs work and what deadline applies.",
        fields: ["organisationName", "contactEmail", "assessmentName", "projectDeadline", "projectDescription"],
        id: "report",
        title: "Report request",
      },
    ],
    id: "report-package",
    minimumRequirements: ["Assessment reference", "Requester", "Report need/deadline"],
    primaryOutcome: "Move an assessment toward report delivery.",
    recommendedFields: ["projectDeadline", "projectDescription"],
    requiredFields: ["organisationName", "contactEmail", "assessmentName"],
    shortLabel: "Report",
    slaLabel: "Delivery date confirmed in review",
    title: "Report package request",
  },
];

export function getIntakeRequestType(id: string): IntakeRequestType | undefined {
  return intakeRequestTypes.find((requestType) => requestType.id === id);
}

