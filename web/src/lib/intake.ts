export const organisationTypes = [
  { value: "developer", label: "Developer" },
  { value: "investor", label: "Investor" },
  { value: "energy_developer", label: "Energy developer" },
  { value: "landowner", label: "Landowner" },
  { value: "consultant", label: "Consultant" },
  { value: "gridready", label: "GridReady" },
  { value: "other", label: "Other" },
] as const;

export const projectTypes = [
  { value: "single_site", label: "Single site" },
  { value: "multi_site", label: "Multi-site" },
  { value: "investor_underwriting", label: "Investor underwriting" },
  { value: "retainer", label: "Retainer" },
] as const;

export const assessmentStatuses = [
  { value: "draft", label: "Draft" },
  { value: "intake_incomplete", label: "Intake incomplete" },
  { value: "intake_complete", label: "Intake complete" },
  { value: "in_analyst_review", label: "In analyst review" },
  { value: "in_expert_review", label: "In expert review" },
  { value: "report_drafting", label: "Report drafting" },
  { value: "final_review", label: "Final review" },
  { value: "delivered", label: "Delivered" },
  { value: "archived", label: "Archived" },
] as const;

export const curtailmentOptions = [
  { value: "", label: "Unknown" },
  { value: "yes", label: "Yes" },
  { value: "partial", label: "Partial" },
  { value: "no", label: "No" },
] as const;

export type AssessmentStatus = (typeof assessmentStatuses)[number]["value"];

export type AssessmentFormState = {
  organisationId: string;
  organisationName: string;
  organisationType: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactRoleTitle: string;
  projectId: string;
  projectName: string;
  projectType: string;
  projectDeadline: string;
  projectDescription: string;
  siteId: string;
  siteName: string;
  address: string;
  city: string;
  county: string;
  state: string;
  latitude: string;
  longitude: string;
  parcelId: string;
  assessmentId: string;
  assessmentName: string;
  marketRegion: string;
  targetLoadMw: string;
  initialLoadMw: string;
  fullBuildoutLoadMw: string;
  desiredEnergizationDate: string;
  projectStage: string;
  landControlStatus: string;
  knownUtility: string;
  knownTsp: string;
  knownSubstationOrPoi: string;
  existingStudiesSummary: string;
  existingPowerQuoteSummary: string;
  backupGenerationAssumptions: string;
  batteryStorageAssumptions: string;
  curtailmentWillingness: string;
  workloadFlexibilityAssumptions: string;
  waterCoolingNotes: string;
  confidentialityStatus: string;
};

export type AssessmentFieldValidationMap = Partial<Record<keyof AssessmentFormState, string>>;

export const blankAssessmentForm: AssessmentFormState = {
  organisationId: "",
  organisationName: "",
  organisationType: "developer",
  contactId: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  contactRoleTitle: "",
  projectId: "",
  projectName: "",
  projectType: "single_site",
  projectDeadline: "",
  projectDescription: "",
  siteId: "",
  siteName: "",
  address: "",
  city: "",
  county: "",
  state: "TX",
  latitude: "",
  longitude: "",
  parcelId: "",
  assessmentId: "",
  assessmentName: "",
  marketRegion: "ERCOT",
  targetLoadMw: "",
  initialLoadMw: "",
  fullBuildoutLoadMw: "",
  desiredEnergizationDate: "",
  projectStage: "",
  landControlStatus: "",
  knownUtility: "",
  knownTsp: "",
  knownSubstationOrPoi: "",
  existingStudiesSummary: "",
  existingPowerQuoteSummary: "",
  backupGenerationAssumptions: "",
  batteryStorageAssumptions: "",
  curtailmentWillingness: "",
  workloadFlexibilityAssumptions: "",
  waterCoolingNotes: "",
  confidentialityStatus: "confidential",
};

const requiredWeights: Array<[keyof AssessmentFormState, number]> = [
  ["organisationName", 10],
  ["contactEmail", 8],
  ["projectName", 8],
  ["siteName", 10],
  ["targetLoadMw", 12],
  ["desiredEnergizationDate", 12],
];

const usefulWeights: Array<[keyof AssessmentFormState, number]> = [
  ["assessmentName", 5],
  ["address", 5],
  ["latitude", 4],
  ["longitude", 4],
  ["initialLoadMw", 4],
  ["fullBuildoutLoadMw", 4],
  ["projectStage", 4],
  ["landControlStatus", 4],
  ["knownUtility", 4],
  ["knownTsp", 3],
  ["backupGenerationAssumptions", 3],
  ["batteryStorageAssumptions", 3],
  ["curtailmentWillingness", 3],
  ["waterCoolingNotes", 2],
];

export function hasValue(value: string) {
  return value.trim().length > 0;
}

export function parseOptionalNumber(value: string) {
  if (!hasValue(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateNumberField(value: string, label: string, minimum?: number) {
  if (!hasValue(value)) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return `${label} must be a number.`;
  }

  if (minimum !== undefined && parsed < minimum) {
    return `${label} must be at least ${minimum}.`;
  }

  return null;
}

function validateCoordinate(value: string, label: string, minimum: number, maximum: number) {
  if (!hasValue(value)) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return `${label} must be a number.`;
  }

  if (parsed < minimum || parsed > maximum) {
    return `${label} must be between ${minimum} and ${maximum}. Use decimal degrees, for example 31.9686.`;
  }

  return null;
}

export function isValidContactEmail(value: string) {
  const trimmed = value.trim();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function getCoreAssessmentFieldValidationState(form: AssessmentFormState): AssessmentFieldValidationMap {
  const errors: AssessmentFieldValidationMap = {};

  const targetLoadError = validateNumberField(form.targetLoadMw, "Target load MW", 0.01);
  const initialLoadError = validateNumberField(form.initialLoadMw, "Initial phase MW", 0);
  const fullBuildoutError = validateNumberField(form.fullBuildoutLoadMw, "Full buildout MW", 0);
  const latitudeError = validateCoordinate(form.latitude, "Latitude", -90, 90);
  const longitudeError = validateCoordinate(form.longitude, "Longitude", -180, 180);

  if (targetLoadError) {
    errors.targetLoadMw = targetLoadError;
  }

  if (initialLoadError) {
    errors.initialLoadMw = initialLoadError;
  }

  if (fullBuildoutError) {
    errors.fullBuildoutLoadMw = fullBuildoutError;
  }

  if (latitudeError) {
    errors.latitude = latitudeError;
  }

  if (longitudeError) {
    errors.longitude = longitudeError;
  }

  if ((hasValue(form.latitude) && !hasValue(form.longitude)) || (!hasValue(form.latitude) && hasValue(form.longitude))) {
    const message = "Enter both latitude and longitude, or leave both blank and use the address.";
    errors.latitude = errors.latitude ?? message;
    errors.longitude = errors.longitude ?? message;
  }

  return errors;
}

export function validateAssessmentForm(form: AssessmentFormState) {
  return Object.values(getCoreAssessmentFieldValidationState(form));
}

export function calculateCompletenessScore(form: AssessmentFormState) {
  const requiredScore = requiredWeights.reduce((score, [key, weight]) => {
    return hasValue(form[key]) ? score + weight : score;
  }, 0);

  const hasLocation = hasValue(form.address) || (hasValue(form.latitude) && hasValue(form.longitude));
  const locationScore = hasLocation ? 10 : 0;

  const usefulScore = usefulWeights.reduce((score, [key, weight]) => {
    return hasValue(form[key]) ? score + weight : score;
  }, 0);

  return Math.min(100, requiredScore + locationScore + usefulScore);
}

export function hasMinimumIntake(form: AssessmentFormState) {
  const hasLocation = hasValue(form.address) || (hasValue(form.latitude) && hasValue(form.longitude));

  return (
    hasValue(form.organisationName) &&
    hasValue(form.contactEmail) &&
    hasValue(form.projectName) &&
    hasValue(form.siteName) &&
    hasValue(form.targetLoadMw) &&
    hasValue(form.desiredEnergizationDate) &&
    hasLocation
  );
}

export function suggestedIntakeStatus(form: AssessmentFormState): AssessmentStatus {
  if (!hasValue(form.assessmentName) && !hasValue(form.siteName)) {
    return "draft";
  }

  return hasMinimumIntake(form) ? "intake_complete" : "intake_incomplete";
}

export function statusLabel(status: string) {
  return assessmentStatuses.find((item) => item.value === status)?.label ?? status;
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
