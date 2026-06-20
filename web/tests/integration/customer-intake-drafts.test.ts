import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  customerEvidenceMaxBytes,
  formatFileSize,
  linkCustomerIntakeFiles,
  validateCustomerEvidenceFile,
} from "@/lib/customer-intake-drafts";
import { getErrorMessage } from "@/lib/errors";

const repositoryRoot = resolve(process.cwd(), "..");
const securityMigration = readFileSync(resolve(repositoryRoot, "supabase/migrations/20260620140000_upload_security_metadata.sql"), "utf8");

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

  it("links submitted files through the controlled server function", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 2, error: null });
    const client = { rpc } as unknown as SupabaseClient;

    await linkCustomerIntakeFiles(client, { assessmentId: "assessment-a", draftId: "draft-a" });

    expect(rpc).toHaveBeenCalledWith("link_customer_intake_files", {
      p_assessment_id: "assessment-a",
      p_draft_id: "draft-a",
    });
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
