import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ExpertReviewChecklistItemRecord,
  buildExpertReviewChecklistDrafts,
  expertReviewChecklistDefinitions,
} from "@/lib/scorecard";

const repositoryRoot = resolve(process.cwd(), "..");
const migration = readFileSync(resolve(repositoryRoot, "supabase/migrations/20260619230000_expert_review_version_approval.sql"), "utf8");
const assignmentMigration = readFileSync(resolve(repositoryRoot, "supabase/migrations/20260620120000_expert_review_assignment_checklist.sql"), "utf8");

describe("expert review and report-version approval contracts", () => {
  it("creates a complete review checklist draft in a stable order", () => {
    const savedItem: ExpertReviewChecklistItemRecord = {
      created_at: "2026-06-19T12:00:00Z",
      expert_review_id: "review-1",
      id: "item-1",
      item_key: "evidence_and_claims",
      label: "Evidence and material claims",
      required_change: null,
      reviewer_comment: "Lineage checked.",
      site_assessment_id: "assessment-1",
      status: "pass",
      updated_at: "2026-06-19T12:00:00Z",
    };

    const drafts = buildExpertReviewChecklistDrafts([savedItem]);

    expect(drafts).toHaveLength(expertReviewChecklistDefinitions.length);
    expect(drafts.map((item) => item.itemKey)).toEqual(expertReviewChecklistDefinitions.map((item) => item.key));
    expect(drafts.find((item) => item.itemKey === "evidence_and_claims")).toMatchObject({
      comments: "Lineage checked.",
      status: "pass",
    });
    expect(drafts.find((item) => item.itemKey === "delivery_package")?.status).toBe("not_checked");
  });

  it("blocks direct writes and routes review packets through one server function", () => {
    expect(migration).toContain("create or replace function public.save_expert_review_packet");
    expect(migration).toContain("before insert or update or delete on public.expert_reviews");
    expect(migration).toContain("before insert or update or delete on public.expert_review_checklist_items");
    expect(migration).toContain("Expert reviews must be changed through save_expert_review_packet().");
  });

  it("restricts decisions and validates approval completeness", () => {
    expect(migration).toContain("Only an administrator or reviewer can record a review decision.");
    expect(migration).toContain("Approval requires a completed review checklist.");
    expect(migration).toContain("in ('fail', 'not_checked')");
    expect(migration).toContain("Rejected reviews require a decision reason or reviewer comments.");
    expect(assignmentMigration).toContain("Only the assigned reviewer can record this decision.");
    expect(assignmentMigration).toContain("Reviewer assignment cannot change while recording a decision.");
    expect(assignmentMigration).toContain("expert_review_admin_override");
  });

  it("enforces the canonical checklist at the database boundary", () => {
    expect(assignmentMigration).toContain("create table if not exists public.expert_review_checklist_definitions");
    for (const definition of expertReviewChecklistDefinitions) {
      expect(assignmentMigration).toContain(`('${definition.key}', '${definition.label}'`);
    }
    expect(assignmentMigration).toContain("Expert review checklist contains an unknown item.");
    expect(assignmentMigration).toContain("Expert review checklist contains duplicate items.");
    expect(assignmentMigration).toContain("Approval requires every canonical checklist item to be completed without failures.");
  });

  it("separates report authorship from expert approval", () => {
    expect(assignmentMigration).toContain("public.current_app_role() not in ('admin', 'analyst')");
    expect(assignmentMigration).toContain("rename to save_report_claim_unchecked");
    expect(assignmentMigration).toContain("rename to finalize_assessment_report_unchecked");
    expect(assignmentMigration).toContain("drop policy if exists report_sections_author_manage");
    expect(assignmentMigration).toContain("drop policy if exists report_exports_author_manage");
  });

  it("versions finalized exports and requires approval for that exact version", () => {
    expect(migration).toContain("version_number = coalesce(version_number, 0) + 1");
    expect(migration).toContain("finalization_snapshot = public.current_report_export_snapshot(v_export.id)");
    expect(migration).toContain("r.report_export_id = v_ready_export.id");
    expect(migration).toContain("r.report_export_version = v_ready_export.version_number");
    expect(migration).toContain("Required expert review is not approved for the current report version");
    expect(migration).toContain("Assign the current finalized report version for review before recording a decision.");
    expect(migration).toContain("set status = 'not_checked', reviewer_comment = null, required_change = null");
  });

  it("stores immutable decision and checklist snapshots", () => {
    expect(migration).toContain("create table if not exists public.expert_review_decisions");
    expect(migration).toContain("Expert review decision history is immutable.");
    expect(migration).toContain("review_snapshot jsonb not null");
    expect(migration).toContain("checklist_snapshot jsonb not null");
  });

  it("keeps the export snapshot helper private", () => {
    expect(migration).toContain("revoke all on function public.current_report_export_snapshot(uuid) from public, anon, authenticated");
    expect(migration).not.toContain("grant execute on function public.current_report_export_snapshot(uuid) to authenticated");
  });
});
