import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  customerEvidenceMaxBytes,
  formatFileSize,
  submitCustomerIntakeDraft,
  validateCustomerEvidenceFile,
} from "@/lib/customer-intake-drafts";
import { getErrorMessage } from "@/lib/errors";
import { blankAssessmentForm } from "@/lib/intake";

const repositoryRoot = resolve(process.cwd(), "..");
const securityMigration = readFileSync(resolve(repositoryRoot, "supabase/migrations/20260620140000_upload_security_metadata.sql"), "utf8");
const submissionMigration = readFileSync(resolve(repositoryRoot, "supabase/migrations/20260620150000_atomic_customer_intake_submission.sql"), "utf8");
const smartIntakeForm = readFileSync(resolve(repositoryRoot, "web/src/components/smart-intake/smart-intake-form.tsx"), "utf8");

describe("customer intake draft and upload contracts", () => {
  it("accepts the documented customer evidence formats", () => {
    expect(validateCustomerEvidenceFile(new File(["report"], "report.pdf", { type: "application/pdf" }))).toBeNull();
    expect(validateCustomerEvidenceFile(new File(["shape"], "parcel.zip", { type: "application/zip" }))).toBeNull();
    expect(validateCustomerEvidenceFile(new File(["{}"], "site.geojson", { type: "application/geo+json" }))).toBeNull();
  });

  it("rejects unsupported and oversized files before upload", () => {
    expect(validateCustomerEvidenceFile(new File(["binary"], "installer.exe"))).toContain("Use PDF");

    const oversized = new File(["x"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: customerEvidenceMaxBytes + 1 });
    expect(validateCustomerEvidenceFile(oversized)).toBe("Files must be 50 MB or smaller.");
  });

  it("formats upload sizes for the customer interface", () => {
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("surfaces Supabase error objects instead of replacing them with a generic message", () => {
    expect(getErrorMessage({
      code: "42501",
      details: "Failing row violates the customer insert policy.",
      hint: "Check the active organisation membership.",
      message: "new row violates row-level security policy",
    }, "Could not submit request.")).toBe(
      "new row violates row-level security policy Failing row violates the customer insert policy. Check the active organisation membership. 42501",
    );
  });

  it("keeps useful native and fallback error messages", () => {
    expect(getErrorMessage(new Error("Network request failed"), "Fallback")).toBe("Network request failed");
    expect(getErrorMessage(null, "Fallback")).toBe("Fallback");
  });

  it("submits the latest draft payload through one server transaction", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "assessment-a", error: null });
    const client = { rpc } as unknown as SupabaseClient;

    await expect(submitCustomerIntakeDraft(client, {
      draftId: "draft-a",
      fieldStates: { siteName: "provided" },
      form: { ...blankAssessmentForm, organisationName: "Acme", contactEmail: "owner@acme.test" },
      requestType: "single-site-screen",
    })).resolves.toBe("assessment-a");

    expect(rpc).toHaveBeenCalledWith("submit_customer_intake_draft", {
      p_draft_id: "draft-a",
      p_field_states: { siteName: "provided" },
      p_form_data: expect.objectContaining({ organisationName: "Acme" }),
      p_request_type: "single-site-screen",
      p_schema_version: 1,
    });
  });

  it("makes submission idempotent and removes the browser-side write chain", () => {
    expect(submissionMigration).toContain("pg_advisory_xact_lock");
    expect(submissionMigration).toContain("v_draft.status = 'submitted'");
    expect(submissionMigration).toContain("return v_draft.submitted_assessment_id");
    expect(submissionMigration).toContain("perform public.link_customer_intake_files");
    expect(submissionMigration).toContain("drop policy if exists assessments_customer_create");
    expect(smartIntakeForm).toContain("submitCustomerIntakeDraft");
    expect(smartIntakeForm).not.toContain('.from("projects")');
    expect(smartIntakeForm).not.toContain('.from("sites")');
    expect(smartIntakeForm).not.toContain('.from("site_assessments")\n        .insert');
  });

  it("keeps upload security state worker-owned and gates private reads", () => {
    expect(securityMigration).toContain("Upload security metadata is immutable outside the processing worker.");
    expect(securityMigration).toContain("new.malware_scan_status := 'pending'");
    expect(securityMigration).toContain("drop policy if exists customer_intake_files_update");
    expect(securityMigration).toContain("drop policy if exists files_customer_link_update");
    expect(securityMigration).toContain("f.malware_scan_status = 'clean'");
    expect(securityMigration).toContain("drop policy if exists customer_assessment_storage_update");
  });
});
