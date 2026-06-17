export type WorkflowEventName =
  | "assessment_create_started"
  | "assessment_create_step_completed"
  | "assessment_created"
  | "assessment_intake_updated"
  | "assessment_quick_link_clicked"
  | "map_layer_toggled"
  | "grid_asset_added"
  | "checklist_module_expanded"
  | "checklist_item_saved"
  | "evidence_source_created"
  | "finding_created"
  | "scorecard_saved"
  | "report_generated"
  | "report_marked_ready";

export type WorkflowEventPayload = Record<string, boolean | number | string | null | undefined>;

export function trackWorkflowEvent(name: WorkflowEventName, payload: WorkflowEventPayload = {}) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info("[workflow]", name, {
    ...payload,
    trackedAt: new Date().toISOString(),
  });
}
