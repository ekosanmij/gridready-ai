import { describe, expect, it } from "vitest";
import {
  customerEvidenceMaxBytes,
  formatFileSize,
  validateCustomerEvidenceFile,
} from "@/lib/customer-intake-drafts";

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
});
