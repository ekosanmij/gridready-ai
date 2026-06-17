import {
  AssessmentFieldValidationMap,
  AssessmentFormState,
  getCoreAssessmentFieldValidationState,
  hasValue,
  isValidContactEmail,
  parseOptionalNumber,
} from "@/lib/intake";

export type IntakeStepId =
  | "customer_project"
  | "site_location"
  | "load_timing"
  | "grid_context"
  | "risk_flexibility"
  | "evidence_references"
  | "review";

export type IntakeStepStatus = "not_started" | "partial" | "complete" | "blocked";

export type IntakeStepDefinition = {
  description: string;
  id: IntakeStepId;
  label: string;
  shortLabel: string;
};

export type IntakeBlocker = {
  field: keyof AssessmentFormState;
  id: string;
  label: string;
  message: string;
  stepId: IntakeStepId;
};

export type IntakeWarning = {
  field?: keyof AssessmentFormState;
  id: string;
  message: string;
  stepId: IntakeStepId;
};

export type FieldValidationMap = AssessmentFieldValidationMap;

export type IntakeStepCompletion = {
  blockers: IntakeBlocker[];
  completedFields: number;
  requiredFields: number;
  status: IntakeStepStatus;
  stepId: IntakeStepId;
  warnings: IntakeWarning[];
};

export const intakeWizardSteps: IntakeStepDefinition[] = [
  {
    id: "customer_project",
    label: "Customer & Project",
    shortLabel: "Customer",
    description: "Who this diligence record is for and which project owns it.",
  },
  {
    id: "site_location",
    label: "Site & Location",
    shortLabel: "Location",
    description: "Where the site is and whether it can be placed on the map.",
  },
  {
    id: "load_timing",
    label: "Load & Timing",
    shortLabel: "Load",
    description: "Power demand, project timing, and readiness context.",
  },
  {
    id: "grid_context",
    label: "Grid Context",
    shortLabel: "Grid",
    description: "Known utility, TSP, POI, studies, and quote context.",
  },
  {
    id: "risk_flexibility",
    label: "Risk & Flexibility",
    shortLabel: "Risk",
    description: "Operational flexibility and non-grid assumptions.",
  },
  {
    id: "evidence_references",
    label: "Evidence & References",
    shortLabel: "Evidence",
    description: "Early source material and post-creation evidence workflow.",
  },
  {
    id: "review",
    label: "Review & Save",
    shortLabel: "Review",
    description: "Confirm blockers, warnings, completeness, and suggested status.",
  },
];

const stepFieldMap: Record<IntakeStepId, Array<keyof AssessmentFormState>> = {
  customer_project: [
    "organisationName",
    "organisationType",
    "contactName",
    "contactEmail",
    "contactPhone",
    "contactRoleTitle",
    "projectName",
    "projectType",
    "projectDeadline",
    "projectDescription",
    "confidentialityStatus",
  ],
  site_location: ["siteName", "address", "city", "county", "state", "latitude", "longitude", "parcelId"],
  load_timing: [
    "assessmentName",
    "marketRegion",
    "targetLoadMw",
    "initialLoadMw",
    "fullBuildoutLoadMw",
    "desiredEnergizationDate",
    "projectStage",
    "landControlStatus",
  ],
  grid_context: [
    "knownUtility",
    "knownTsp",
    "knownSubstationOrPoi",
    "existingStudiesSummary",
    "existingPowerQuoteSummary",
  ],
  risk_flexibility: [
    "backupGenerationAssumptions",
    "batteryStorageAssumptions",
    "curtailmentWillingness",
    "workloadFlexibilityAssumptions",
    "waterCoolingNotes",
  ],
  evidence_references: ["existingStudiesSummary", "existingPowerQuoteSummary"],
  review: [],
};

const statusFieldMap: Record<IntakeStepId, Array<keyof AssessmentFormState>> = {
  customer_project: [
    "organisationName",
    "contactName",
    "contactEmail",
    "contactPhone",
    "contactRoleTitle",
    "projectName",
    "projectDeadline",
    "projectDescription",
  ],
  site_location: ["siteName", "address", "city", "county", "latitude", "longitude", "parcelId"],
  load_timing: [
    "assessmentName",
    "targetLoadMw",
    "initialLoadMw",
    "fullBuildoutLoadMw",
    "desiredEnergizationDate",
    "projectStage",
    "landControlStatus",
  ],
  grid_context: stepFieldMap.grid_context,
  risk_flexibility: stepFieldMap.risk_flexibility,
  evidence_references: stepFieldMap.evidence_references,
  review: [],
};

const requiredFieldCounts: Record<IntakeStepId, number> = {
  customer_project: 3,
  site_location: 2,
  load_timing: 2,
  grid_context: 0,
  risk_flexibility: 0,
  evidence_references: 0,
  review: 0,
};

function hasAnyValue(form: AssessmentFormState, fields: Array<keyof AssessmentFormState>) {
  return fields.some((field) => hasValue(form[field]));
}

function hasValidCoordinatePair(form: AssessmentFormState) {
  const latitude = parseOptionalNumber(form.latitude);
  const longitude = parseOptionalNumber(form.longitude);

  return (
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function isPastDate(value: string) {
  if (!hasValue(value)) {
    return false;
  }

  const selected = new Date(`${value}T00:00:00`);

  if (Number.isNaN(selected.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selected < today;
}

function blocker(
  id: string,
  stepId: IntakeStepId,
  field: keyof AssessmentFormState,
  label: string,
  message: string,
): IntakeBlocker {
  return { field, id, label, message, stepId };
}

export function getFieldValidationState(form: AssessmentFormState): FieldValidationMap {
  const errors = { ...getCoreAssessmentFieldValidationState(form) };
  const hasLocation = hasValue(form.address) || hasValidCoordinatePair(form);

  if (!hasValue(form.organisationName)) {
    errors.organisationName = "Organisation is required.";
  }

  if (!hasValue(form.contactEmail)) {
    errors.contactEmail = "Contact email is required.";
  } else if (!isValidContactEmail(form.contactEmail)) {
    errors.contactEmail = "Enter a valid contact email.";
  }

  if (!hasValue(form.projectName)) {
    errors.projectName = "Project name is required.";
  }

  if (!hasValue(form.siteName)) {
    errors.siteName = "Site name is required.";
  }

  if (!hasLocation) {
    errors.address = "Enter an address or valid latitude and longitude.";
  }

  if (!hasValue(form.targetLoadMw)) {
    errors.targetLoadMw = "Target load MW is required.";
  }

  if (!hasValue(form.desiredEnergizationDate)) {
    errors.desiredEnergizationDate = "Desired energization date is required.";
  }

  return errors;
}

export function getIntakeStepBlockers(form: AssessmentFormState, stepId: IntakeStepId): IntakeBlocker[] {
  if (stepId === "review") {
    return getAllIntakeBlockers(form);
  }

  const errors = getFieldValidationState(form);
  const blockers: IntakeBlocker[] = [];

  if (stepId === "customer_project") {
    if (errors.organisationName) {
      blockers.push(blocker("organisationName-required", stepId, "organisationName", "Organisation", errors.organisationName));
    }

    if (errors.contactEmail) {
      blockers.push(blocker("contactEmail-required", stepId, "contactEmail", "Contact email", errors.contactEmail));
    }

    if (errors.projectName) {
      blockers.push(blocker("projectName-required", stepId, "projectName", "Project name", errors.projectName));
    }
  }

  if (stepId === "site_location") {
    if (errors.siteName) {
      blockers.push(blocker("siteName-required", stepId, "siteName", "Site name", errors.siteName));
    }

    if (errors.address) {
      blockers.push(blocker("location-required", stepId, "address", "Location", errors.address));
    }

    if (errors.latitude) {
      blockers.push(blocker("latitude-invalid", stepId, "latitude", "Latitude", errors.latitude));
    }

    if (errors.longitude) {
      blockers.push(blocker("longitude-invalid", stepId, "longitude", "Longitude", errors.longitude));
    }
  }

  if (stepId === "load_timing") {
    if (errors.targetLoadMw) {
      blockers.push(blocker("targetLoadMw-required", stepId, "targetLoadMw", "Target load MW", errors.targetLoadMw));
    }

    if (errors.initialLoadMw) {
      blockers.push(blocker("initialLoadMw-invalid", stepId, "initialLoadMw", "Initial phase MW", errors.initialLoadMw));
    }

    if (errors.fullBuildoutLoadMw) {
      blockers.push(
        blocker("fullBuildoutLoadMw-invalid", stepId, "fullBuildoutLoadMw", "Full buildout MW", errors.fullBuildoutLoadMw),
      );
    }

    if (errors.desiredEnergizationDate) {
      blockers.push(
        blocker(
          "desiredEnergizationDate-required",
          stepId,
          "desiredEnergizationDate",
          "Desired energization",
          errors.desiredEnergizationDate,
        ),
      );
    }
  }

  return blockers;
}

export function getAllIntakeBlockers(form: AssessmentFormState): IntakeBlocker[] {
  return intakeWizardSteps
    .filter((step) => step.id !== "review")
    .flatMap((step) => getIntakeStepBlockers(form, step.id));
}

export function getIntakeWarnings(form: AssessmentFormState): IntakeWarning[] {
  const warnings: IntakeWarning[] = [];
  const initialLoad = parseOptionalNumber(form.initialLoadMw);
  const fullBuildoutLoad = parseOptionalNumber(form.fullBuildoutLoadMw);
  const targetLoad = parseOptionalNumber(form.targetLoadMw);

  if (isPastDate(form.projectDeadline)) {
    warnings.push({
      field: "projectDeadline",
      id: "projectDeadline-past",
      message: "Project deadline is in the past.",
      stepId: "customer_project",
    });
  }

  if (isPastDate(form.desiredEnergizationDate)) {
    warnings.push({
      field: "desiredEnergizationDate",
      id: "desiredEnergizationDate-past",
      message: "Desired energization date is in the past.",
      stepId: "load_timing",
    });
  }

  if (initialLoad !== null && fullBuildoutLoad !== null && fullBuildoutLoad < initialLoad) {
    warnings.push({
      field: "fullBuildoutLoadMw",
      id: "fullBuildoutLoadMw-below-initial",
      message: "Full buildout MW is lower than initial phase MW.",
      stepId: "load_timing",
    });
  }

  if (initialLoad !== null && targetLoad !== null && initialLoad > targetLoad) {
    warnings.push({
      field: "initialLoadMw",
      id: "initialLoadMw-above-target",
      message: "Initial phase MW is higher than target load MW.",
      stepId: "load_timing",
    });
  }

  if (form.curtailmentWillingness === "no") {
    warnings.push({
      field: "curtailmentWillingness",
      id: "curtailment-no",
      message: "No curtailment flexibility may increase feasibility risk.",
      stepId: "risk_flexibility",
    });
  }

  return warnings;
}

export function calculateIntakeStepCompletion(
  form: AssessmentFormState,
  stepId: IntakeStepId,
): IntakeStepCompletion {
  const blockers = getIntakeStepBlockers(form, stepId);
  const warnings = getIntakeWarnings(form).filter((warning) => warning.stepId === stepId);
  const statusFields = statusFieldMap[stepId];
  const completedFields = statusFields.filter((field) => hasValue(form[field])).length;
  const requiredFields = requiredFieldCounts[stepId];
  let status: IntakeStepStatus = "not_started";

  if (blockers.length > 0) {
    status = completedFields > 0 ? "blocked" : "not_started";
  } else if (stepId === "grid_context") {
    status = hasAnyValue(form, statusFields) ? "complete" : "not_started";
  } else if (stepId === "risk_flexibility") {
    status = hasAnyValue(form, statusFields) ? "complete" : "not_started";
  } else if (stepId === "evidence_references") {
    status = hasAnyValue(form, statusFields) ? "complete" : "not_started";
  } else if (stepId === "review") {
    status = getAllIntakeBlockers(form).length === 0 ? "complete" : "blocked";
  } else {
    status = "complete";
  }

  if (status === "not_started" && completedFields > 0) {
    status = "partial";
  }

  return {
    blockers,
    completedFields,
    requiredFields,
    status,
    stepId,
    warnings,
  };
}
