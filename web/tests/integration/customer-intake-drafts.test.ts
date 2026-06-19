import { describe, expect, it } from "vitest";
import {
  customerEvidenceMaxBytes,
  formatFileSize,
  validateCustomerEvidenceFile,
} from "@/lib/customer-intake-drafts";
import { getErrorMessage } from "@/lib/errors";

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
});
