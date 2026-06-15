import {
  ChecklistDraft,
  ChecklistResponseStatus,
  ChecklistTemplateItemRecord,
  createChecklistDraft,
} from "@/lib/checklists";

type AutomationAssessment = {
  market_region: string;
  target_load_mw: number | null;
  initial_load_mw: number | null;
  full_buildout_load_mw: number | null;
  desired_energization_date: string | null;
  project_stage: string | null;
  land_control_status: string | null;
  known_utility: string | null;
  known_tsp: string | null;
  known_substation_or_poi: string | null;
  existing_studies_summary: string | null;
  existing_power_quote_summary: string | null;
  backup_generation_assumptions: string | null;
  battery_storage_assumptions: string | null;
  curtailment_willingness: string | null;
  workload_flexibility_assumptions: string | null;
  water_cooling_notes: string | null;
  intake_completeness_score: number;
};

type AutomationSite = {
  site_name: string;
  address: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  parcel_id: string | null;
};

type AutomationProject = {
  name: string;
  description: string | null;
  deadline: string | null;
};

type AutomationOrganisation = {
  name: string;
};

type AutomationContact = {
  name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
};

type AutomationNote = {
  note_type: string;
  body: string;
};

type AutomationFile = {
  file_name: string;
  document_category: string | null;
  description: string | null;
};

export type ChecklistAutomationContext = {
  assessment: AutomationAssessment;
  contact: AutomationContact | null;
  files: AutomationFile[];
  notes: AutomationNote[];
  organisation: AutomationOrganisation | null;
  project: AutomationProject | null;
  site: AutomationSite | null;
};

type ChecklistAutomationSuggestion = {
  analystNote: string;
  evidenceNote: string;
  status: ChecklistResponseStatus;
};

export type ChecklistAutomationResult = {
  appliedCount: number;
  drafts: Record<string, ChecklistDraft>;
  skippedCount: number;
};

const missing = (label: string) => `Missing ${label}`;

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function joined(values: Array<string | number | null | undefined>) {
  return values
    .filter((value): value is string | number => value !== null && value !== undefined && String(value).trim().length > 0)
    .join("; ");
}

function dateIsWithinMonths(value: string | null, months: number) {
  if (!value) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() + months);

  return date <= threshold;
}

function evidenceContext(context: ChecklistAutomationContext) {
  const { assessment, files, notes } = context;
  const fileNames = files.map((file) => file.file_name).slice(0, 4).join(", ");
  const noteTypes = notes.map((note) => note.note_type.replaceAll("_", " ")).slice(0, 4).join(", ");

  return joined([
    assessment.existing_studies_summary ? `Studies: ${assessment.existing_studies_summary}` : null,
    assessment.existing_power_quote_summary ? `Power quote: ${assessment.existing_power_quote_summary}` : null,
    fileNames ? `Files: ${fileNames}` : null,
    noteTypes ? `Notes: ${noteTypes}` : null,
  ]);
}

function hasAnyEvidence(context: ChecklistAutomationContext) {
  return (
    hasText(context.assessment.existing_studies_summary) ||
    hasText(context.assessment.existing_power_quote_summary) ||
    context.files.length > 0 ||
    context.notes.length > 0
  );
}

function hasLocationBasis(context: ChecklistAutomationContext) {
  const site = context.site;

  if (!site) {
    return false;
  }

  return (
    hasText(site.address) ||
    hasText(site.city) ||
    hasText(site.county) ||
    (hasNumber(site.latitude) && hasNumber(site.longitude))
  );
}

function locationEvidence(context: ChecklistAutomationContext) {
  const site = context.site;

  if (!site) {
    return "No site record attached.";
  }

  return joined([
    site.site_name ? `Site: ${site.site_name}` : null,
    site.address ? `Address: ${site.address}` : null,
    site.city ? `City: ${site.city}` : null,
    site.county ? `County: ${site.county}` : null,
    site.state ? `State: ${site.state}` : null,
    hasNumber(site.latitude) && hasNumber(site.longitude) ? `Coordinates: ${site.latitude}, ${site.longitude}` : null,
    site.parcel_id ? `Parcel: ${site.parcel_id}` : null,
  ]);
}

function loadEvidence(context: ChecklistAutomationContext) {
  const { assessment } = context;

  return joined([
    hasNumber(assessment.target_load_mw) ? `Target load: ${assessment.target_load_mw} MW` : null,
    hasNumber(assessment.initial_load_mw) ? `Initial phase: ${assessment.initial_load_mw} MW` : null,
    hasNumber(assessment.full_buildout_load_mw) ? `Full buildout: ${assessment.full_buildout_load_mw} MW` : null,
    assessment.desired_energization_date ? `Desired energization: ${assessment.desired_energization_date}` : null,
  ]);
}

function projectEvidence(context: ChecklistAutomationContext) {
  const { assessment, project } = context;

  return joined([
    assessment.project_stage ? `Project stage: ${assessment.project_stage}` : null,
    assessment.land_control_status ? `Land control: ${assessment.land_control_status}` : null,
    project?.deadline ? `Project deadline: ${project.deadline}` : null,
    project?.description ? `Project description: ${project.description}` : null,
  ]);
}

function powerStrategyEvidence(context: ChecklistAutomationContext) {
  const { assessment } = context;

  return joined([
    assessment.backup_generation_assumptions ? `Backup: ${assessment.backup_generation_assumptions}` : null,
    assessment.battery_storage_assumptions ? `Battery/storage: ${assessment.battery_storage_assumptions}` : null,
    assessment.curtailment_willingness ? `Curtailment: ${assessment.curtailment_willingness}` : null,
    assessment.workload_flexibility_assumptions ? `Workload flexibility: ${assessment.workload_flexibility_assumptions}` : null,
  ]);
}

function hasExpertReviewTrigger(context: ChecklistAutomationContext) {
  const { assessment } = context;

  return (
    Number(assessment.target_load_mw ?? 0) >= 75 ||
    dateIsWithinMonths(assessment.desired_energization_date, 24) ||
    !hasText(assessment.backup_generation_assumptions) ||
    !hasText(assessment.battery_storage_assumptions)
  );
}

function suggestionForItem(
  itemKey: string,
  context: ChecklistAutomationContext,
): ChecklistAutomationSuggestion | null {
  const { assessment, contact, organisation, project, site } = context;
  const targetLoadMw = Number(assessment.target_load_mw ?? 0);
  const location = locationEvidence(context);
  const load = loadEvidence(context);
  const projectFacts = projectEvidence(context);
  const powerStrategy = powerStrategyEvidence(context);
  const evidence = evidenceContext(context);
  const largeLoad = targetLoadMw >= 75;
  const urgentEnergization = dateIsWithinMonths(assessment.desired_energization_date, 24);

  switch (itemKey) {
    case "minimum_site_identity": {
      const gaps = [
        !organisation?.name ? missing("organisation") : null,
        !project?.name ? missing("project") : null,
        !site?.site_name ? missing("site name") : null,
        !contact?.email ? missing("contact email") : null,
      ].filter(Boolean);

      return {
        status: gaps.length === 0 ? "pass" : "blocked",
        analystNote: gaps.length === 0 ? "Minimum customer, project, site, and contact identity is present." : gaps.join("; "),
        evidenceNote: joined([organisation?.name, project?.name, site?.site_name, contact?.email]),
      };
    }

    case "location_basis":
      return {
        status: hasLocationBasis(context) ? "pass" : "blocked",
        analystNote: hasLocationBasis(context)
          ? "Location basis is usable for first-pass screening."
          : "Address, county, city, or coordinates are needed before location screening can proceed.",
        evidenceNote: location,
      };

    case "load_and_timing": {
      const hasRequiredLoadInputs = hasNumber(assessment.target_load_mw) && hasText(assessment.desired_energization_date);
      const hasPhasing = hasNumber(assessment.initial_load_mw) || hasNumber(assessment.full_buildout_load_mw);

      return {
        status: hasRequiredLoadInputs && hasPhasing ? "pass" : hasRequiredLoadInputs ? "risk" : "blocked",
        analystNote: hasRequiredLoadInputs
          ? hasPhasing
            ? "Load, timing, and at least one phasing assumption are captured."
            : "Core load and timing are captured; phase ramp remains light."
          : "Target load and desired energization date are required.",
        evidenceNote: load,
      };
    }

    case "project_stage_land_control":
      return {
        status: hasText(assessment.project_stage) && hasText(assessment.land_control_status) ? "pass" : "risk",
        analystNote: "Project stage and land-control maturity were inferred from intake fields.",
        evidenceNote: projectFacts || "Project stage or land-control fields are blank.",
      };

    case "customer_documents_logged":
      return {
        status: hasAnyEvidence(context) ? "pass" : "risk",
        analystNote: hasAnyEvidence(context) ? "Customer documents or evidence notes are present." : "No customer evidence or document reference has been logged yet.",
        evidenceNote: evidence || "No evidence inputs found.",
      };

    case "market_region_identified":
    case "pricing_zone_context":
      return {
        status: hasText(assessment.market_region) ? "pass" : "blocked",
        analystNote: `${assessment.market_region || "Market region"} is the current market basis for this screen.`,
        evidenceNote: `Market region: ${assessment.market_region || "not set"}`,
      };

    case "utility_tsp_context":
      return {
        status: hasText(assessment.known_utility) && hasText(assessment.known_tsp) ? "pass" : "risk",
        analystNote: "Utility/TSP context was drafted from intake fields.",
        evidenceNote: joined([
          assessment.known_utility ? `Known utility: ${assessment.known_utility}` : missing("known utility"),
          assessment.known_tsp ? `Known TSP: ${assessment.known_tsp}` : missing("known TSP"),
        ]),
      };

    case "nearby_transmission_context":
    case "nearby_substation_context":
    case "candidate_poi_notes":
      return {
        status: hasText(assessment.known_substation_or_poi) ? "pass" : hasText(assessment.known_tsp) ? "risk" : "blocked",
        analystNote: hasText(assessment.known_substation_or_poi)
          ? "Known substation or POI context is present."
          : "Transmission/substation context needs analyst enrichment.",
        evidenceNote: joined([assessment.known_substation_or_poi, assessment.known_tsp]) || "No substation, POI, or TSP context captured.",
      };

    case "time_to_power_risk":
      return {
        status: !assessment.desired_energization_date ? "blocked" : urgentEnergization ? "risk" : "pass",
        analystNote: urgentEnergization
          ? "Requested energization appears to be within 24 months, so time-to-power should be treated as a diligence risk."
          : "Requested energization is not inside the 24-month risk trigger.",
        evidenceNote: assessment.desired_energization_date ? `Desired energization: ${assessment.desired_energization_date}` : missing("desired energization date"),
      };

    case "large_load_threshold":
      return {
        status: hasNumber(assessment.target_load_mw) ? largeLoad ? "risk" : "not_applicable" : "blocked",
        analystNote: largeLoad
          ? "Target load is at or above the 75 MW large-load trigger."
          : "Target load is below the 75 MW large-load trigger.",
        evidenceNote: load || missing("target load"),
      };

    case "required_entity_and_control":
      return {
        status: organisation?.name && hasText(assessment.land_control_status) ? "pass" : "risk",
        analystNote: "Entity and site-control readiness was inferred from organisation and land-control inputs.",
        evidenceNote: joined([organisation?.name, assessment.land_control_status]) || "Entity or land-control input is missing.",
      };

    case "load_ramp_and_energization":
      return {
        status:
          hasNumber(assessment.target_load_mw) &&
          hasText(assessment.desired_energization_date) &&
          (hasNumber(assessment.initial_load_mw) || hasNumber(assessment.full_buildout_load_mw))
            ? "pass"
            : "risk",
        analystNote: "Load ramp and energization were drafted from target load, phasing, and desired energization inputs.",
        evidenceNote: load || "Load ramp inputs are incomplete.",
      };

    case "engineering_inputs":
    case "commissioning_and_telemetry":
    case "observability_and_models":
    case "protection_and_trip_settings":
    case "ride_through_assumptions":
      return {
        status: "risk",
        analystNote: "This input is not captured directly in the current intake form and needs analyst or expert follow-up.",
        evidenceNote: largeLoad ? "Large-load site: treat missing engineering inputs as a diligence gap." : "No direct intake evidence available.",
      };

    case "power_strategy_inputs":
    case "ups_backup_storage_behaviour":
      return {
        status: powerStrategy ? "pass" : "risk",
        analystNote: powerStrategy ? "Power strategy assumptions are present in intake." : "Backup, battery, curtailment, or workload flexibility assumptions are missing.",
        evidenceNote: powerStrategy || "No power strategy assumptions captured.",
      };

    case "studies_financial_communications":
      return {
        status: hasText(assessment.existing_studies_summary) || hasText(assessment.existing_power_quote_summary) ? "pass" : "risk",
        analystNote: "Study and utility/TSP communication readiness was inferred from existing-study and power-quote fields.",
        evidenceNote: evidence || "No existing study, power quote, or utility/TSP communication evidence captured.",
      };

    case "sudden_load_drop_risk":
      return {
        status: largeLoad ? "risk" : hasNumber(assessment.target_load_mw) ? "pass" : "blocked",
        analystNote: largeLoad
          ? "Large load could create sudden load-drop risk; analyst should confirm interruptible load and ride-through assumptions."
          : "Target load does not trigger large-load sudden-drop concern at this stage.",
        evidenceNote: load || missing("target load"),
      };

    case "disturbance_and_power_quality":
      return {
        status: largeLoad ? "risk" : "not_applicable",
        analystNote: largeLoad
          ? "Large electronic load should receive disturbance and power-quality review."
          : "No large-load trigger from current target load.",
        evidenceNote: load || missing("target load"),
      };

    case "expert_review_trigger":
    case "review_trigger_checked": {
      const triggered = hasExpertReviewTrigger(context);

      return {
        status: triggered ? "risk" : "pass",
        analystNote: triggered
          ? "Expert review is likely needed based on load size, timeline, or missing reliability/power strategy assumptions."
          : "No obvious expert-review trigger from intake fields.",
        evidenceNote: joined([load, powerStrategy, urgentEnergization ? "Energization within 24 months" : null]),
      };
    }

    case "congestion_risk_summary":
    case "tariff_and_capacity_uncertainty":
      return {
        status: "risk",
        analystNote: "This needs market/grid analysis beyond the current intake form.",
        evidenceNote: `Market region: ${assessment.market_region || "not set"}`,
      };

    case "nearby_generation_summary":
    case "access_and_fibre":
      return {
        status: "risk",
        analystNote: "Not captured in the current intake form; analyst should enrich if material to the screen.",
        evidenceNote: "No direct intake evidence available.",
      };

    case "procurement_options":
      return {
        status: hasText(assessment.existing_power_quote_summary) || powerStrategy ? "pass" : "risk",
        analystNote: "Procurement pathway was drafted from power quote and flexibility/backup assumptions.",
        evidenceNote: joined([assessment.existing_power_quote_summary, powerStrategy]) || "No procurement pathway input captured.",
      };

    case "curtailment_capability":
    case "demand_response_positioning":
      return {
        status:
          assessment.curtailment_willingness === "yes" || assessment.curtailment_willingness === "partial"
            ? "pass"
            : assessment.curtailment_willingness === "no"
              ? "risk"
              : "blocked",
        analystNote: "Curtailment posture was inferred from intake selection.",
        evidenceNote: assessment.curtailment_willingness ? `Curtailment willingness: ${assessment.curtailment_willingness}` : missing("curtailment willingness"),
      };

    case "workload_shift_and_ramp":
      return {
        status: hasText(assessment.workload_flexibility_assumptions) || hasNumber(assessment.initial_load_mw) ? "pass" : "risk",
        analystNote: "Workload shifting and ramp assumptions were drafted from workload flexibility and phasing fields.",
        evidenceNote: joined([assessment.workload_flexibility_assumptions, load]) || "No workload flexibility or ramp evidence captured.",
      };

    case "staged_energization":
      return {
        status: hasNumber(assessment.initial_load_mw) && hasNumber(assessment.full_buildout_load_mw) ? "pass" : "risk",
        analystNote: "Staged energization potential was inferred from initial-phase and full-buildout load inputs.",
        evidenceNote: load || "No phasing inputs captured.",
      };

    case "storage_backup_thermal":
      return {
        status: hasText(assessment.battery_storage_assumptions) || hasText(assessment.backup_generation_assumptions) || hasText(assessment.water_cooling_notes) ? "pass" : "risk",
        analystNote: "Storage, backup, and thermal flexibility were drafted from intake assumptions.",
        evidenceNote: joined([assessment.battery_storage_assumptions, assessment.backup_generation_assumptions, assessment.water_cooling_notes]) || "No storage, backup, or thermal assumptions captured.",
      };

    case "land_and_zoning":
      return {
        status: hasText(assessment.land_control_status) ? "pass" : "risk",
        analystNote: "Land/zoning readiness was initially inferred from land-control input only.",
        evidenceNote: assessment.land_control_status || missing("land control"),
      };

    case "water_and_cooling":
      return {
        status: hasText(assessment.water_cooling_notes) ? "pass" : "risk",
        analystNote: "Water and cooling position was drafted from intake notes.",
        evidenceNote: assessment.water_cooling_notes || missing("water/cooling notes"),
      };

    case "environmental_permitting_community":
      return {
        status: "risk",
        analystNote: "Environmental, permitting, and community risk is not captured directly in the current intake form.",
        evidenceNote: location,
      };

    case "backup_generation_permitting":
      return {
        status: hasText(assessment.backup_generation_assumptions) ? "risk" : "not_applicable",
        analystNote: hasText(assessment.backup_generation_assumptions)
          ? "Backup generation is mentioned; permitting/emissions risk should be checked."
          : "No backup generation assumption captured.",
        evidenceNote: assessment.backup_generation_assumptions || "No backup generation input.",
      };

    case "source_list_started":
    case "key_claims_supported":
      return {
        status: hasAnyEvidence(context) ? "pass" : "risk",
        analystNote: hasAnyEvidence(context) ? "Evidence sources or notes have been started." : "Evidence sources need to be added before report drafting.",
        evidenceNote: evidence || "No evidence sources found.",
      };

    case "source_confidence_classified":
    case "evidence_gaps_flagged":
    case "assumptions_separated":
      return {
        status: hasAnyEvidence(context) ? "risk" : "blocked",
        analystNote: "Evidence quality still needs analyst judgement even when source material exists.",
        evidenceNote: evidence || "No evidence inputs found.",
      };

    case "reviewer_assigned":
      return {
        status: hasExpertReviewTrigger(context) ? "risk" : "not_applicable",
        analystNote: hasExpertReviewTrigger(context)
          ? "Expert review is likely triggered, but no reviewer assignment is captured yet."
          : "No expert-review trigger identified from intake fields.",
        evidenceNote: joined([load, powerStrategy]) || "No trigger evidence captured.",
      };

    case "review_comments_tracked":
      return {
        status: "not_applicable",
        analystNote: "Reviewer comments are not applicable until expert review has started.",
        evidenceNote: "No reviewer comments expected at intake-review stage.",
      };

    case "delivery_gate_checked":
      return {
        status: "risk",
        analystNote: "Delivery gate cannot be cleared from intake alone; complete analysis, evidence review, and any expert review first.",
        evidenceNote: `Checklist auto-fill based on ${assessment.intake_completeness_score}% intake completeness.`,
      };

    default:
      return null;
  }
}

function shouldPreserveDraft(draft: ChecklistDraft) {
  return (
    Boolean(draft.responseId) ||
    draft.status !== "not_started" ||
    hasText(draft.analystNote) ||
    hasText(draft.evidenceNote)
  );
}

export function buildAutomatedChecklistDrafts(
  items: ChecklistTemplateItemRecord[],
  currentDrafts: Record<string, ChecklistDraft>,
  context: ChecklistAutomationContext,
): ChecklistAutomationResult {
  let appliedCount = 0;
  let skippedCount = 0;
  const drafts = { ...currentDrafts };

  items.forEach((item) => {
    const currentDraft = currentDrafts[item.id] ?? createChecklistDraft();

    if (shouldPreserveDraft(currentDraft)) {
      skippedCount += 1;
      drafts[item.id] = currentDraft;
      return;
    }

    const suggestion = suggestionForItem(item.item_key, context);

    if (!suggestion) {
      drafts[item.id] = currentDraft;
      return;
    }

    drafts[item.id] = {
      ...currentDraft,
      analystNote: suggestion.analystNote,
      evidenceNote: suggestion.evidenceNote,
      status: suggestion.status,
    };
    appliedCount += 1;
  });

  return { appliedCount, drafts, skippedCount };
}
