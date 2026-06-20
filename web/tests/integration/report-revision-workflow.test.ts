import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "..");
const migration = readFileSync(resolve(repositoryRoot, "supabase/migrations/20260620130000_report_revision_workflow.sql"), "utf8");
const editor = readFileSync(resolve(repositoryRoot, "web/src/components/assessment-workspace/expert-review-editor.tsx"), "utf8");

describe("controlled report revision workflow", () => {
  it("reopens finalized content without changing the prior version number", () => {
    expect(migration).toContain("create or replace function public.start_report_revision");
    expect(migration).toContain("set status = 'draft'");
    expect(migration).toContain("set status = 'analyst_edited'");
    expect(migration).toContain("finalization_snapshot = '{}'::jsonb");
    expect(migration).not.toContain("version_number = version_number + 1");
  });

  it("requires requested changes and preserves delivered reports", () => {
    expect(migration).toContain("v_review.status not in ('changes_requested', 'rejected')");
    expect(migration).toContain("Delivered assessments require a separately governed amendment workflow.");
    expect(migration).toContain("report_revision_started");
  });

  it("exposes the controlled revision action in the expert-review editor", () => {
    expect(editor).toContain('supabase.rpc("start_report_revision"');
    expect(editor).toContain("Start report revision");
  });
});
