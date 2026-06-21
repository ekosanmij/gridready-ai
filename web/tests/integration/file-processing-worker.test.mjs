import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  loadWorkerConfig,
  normaliseExtractionResponse,
  normaliseScanResponse,
  processBatch,
  processClaimedJob,
} from "../../scripts/file-processing-worker.mjs";

const baseFile = {
  checksum_sha256: "6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72",
  file_name: "evidence.pdf",
  id: "11111111-1111-4111-8111-111111111111",
  malware_scan_status: "pending",
  mime_type: "application/pdf",
  original_filename: "evidence.pdf",
  retention_state: "active",
  size_bytes: 12,
  storage_path: "assessment/evidence.pdf",
};

const baseConfig = {
  batchSize: 5,
  bucket: "assessment-evidence",
  documentExtractorToken: "extract-token",
  documentExtractorUrl: "https://extractor.example.test/process",
  malwareScannerToken: "scan-token",
  malwareScannerUrl: "https://scanner.example.test/scan",
  maxFileBytes: 1024,
  pollMs: 100,
  serviceRoleKey: "service-role-key",
  supabaseUrl: "https://project.supabase.co",
  timeoutMs: 1000,
  workerId: "worker-1",
};

function createClient({ file = baseFile, claimedJobs = [] } = {}) {
  const rpcCalls = [];
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: file, error: null })),
        })),
      })),
    })),
    rpc: vi.fn(async (name, args) => {
      rpcCalls.push({ args, name });
      if (name === "claim_background_jobs") return { data: claimedJobs, error: null };
      return { data: {}, error: null };
    }),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(async () => ({ data: new Blob(["test content"], { type: file.mime_type }), error: null })),
      })),
    },
  };
  return { client, rpcCalls };
}

describe("file-processing worker", () => {
  it("binds extraction writes and job completion to the active worker lease", () => {
    const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/20260621100000_file_processing_workers.sql"), "utf8");
    expect(migration).toContain("create table if not exists public.uploaded_file_extractions");
    expect(migration).toContain("v_job.locked_by is distinct from");
    expect(migration).toContain("create or replace function public.complete_claimed_background_job");
    expect(migration).toContain("revoke execute on function public.complete_background_job");
    expect(migration).toContain("left(x.content_text, 1000000)");
  });

  it("requires service credentials and secure adapter URLs", () => {
    expect(() => loadWorkerConfig({
      DOCUMENT_EXTRACTOR_URL: "http://extractor.example.test",
      SUPABASE_SERVICE_ROLE_KEY: "key",
      SUPABASE_URL: "https://project.supabase.co",
    })).toThrow("DOCUMENT_EXTRACTOR_URL must use HTTPS");

    expect(loadWorkerConfig({
      DOCUMENT_EXTRACTOR_URL: "http://localhost:8080",
      SUPABASE_SERVICE_ROLE_KEY: "key",
      SUPABASE_URL: "https://project.supabase.co",
    })).toMatchObject({ documentExtractorUrl: "http://localhost:8080/" });
  });

  it("accepts only explicit clean or quarantined scan results", () => {
    expect(normaliseScanResponse({ status: "clean", engine: "ClamAV" })).toMatchObject({ status: "clean", engine: "ClamAV" });
    expect(() => normaliseScanResponse({ status: "unknown" })).toThrow("clean or quarantined");
  });

  it("validates extractor text and page counts", () => {
    expect(normaliseExtractionResponse({ text: "Page one", pageCount: 1 })).toMatchObject({ contentText: "Page one", pageCount: 1 });
    expect(() => normaliseExtractionResponse({ text: "" })).toThrow("no text");
    expect(() => normaliseExtractionResponse({ text: "Text", pageCount: -1 })).toThrow("non-negative integer");
  });

  it("completes a clean malware scan through the lease-bound RPC", async () => {
    const { client, rpcCalls } = createClient();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      engine: "ClamAV",
      engineVersion: "1.4",
      status: "clean",
    }), { status: 200 }));

    await expect(processClaimedJob({
      client,
      config: baseConfig,
      fetchImpl,
      job: { entity_id: baseFile.id, entity_type: "uploaded_file", id: "job-scan", job_type: "malware_scan" },
    })).resolves.toMatchObject({ status: "clean" });

    expect(fetchImpl).toHaveBeenCalledWith(baseConfig.malwareScannerUrl, expect.objectContaining({
      headers: { Authorization: "Bearer scan-token" },
      method: "POST",
      redirect: "error",
    }));
    expect(rpcCalls.at(-1)).toEqual({
      name: "complete_claimed_background_job",
      args: expect.objectContaining({ p_job_id: "job-scan", p_success: true, p_worker_id: "worker-1" }),
    });
  });

  it("persists searchable extraction text before completing the job", async () => {
    const { client, rpcCalls } = createClient({ file: { ...baseFile, malware_scan_status: "clean" } });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      extractor: "Textract",
      extractorVersion: "2026-06",
      language: "en",
      metadata: { tables: 2 },
      pageCount: 3,
      text: "Extracted diligence content",
    }), { status: 200 }));

    await processClaimedJob({
      client,
      config: baseConfig,
      fetchImpl,
      job: { entity_id: baseFile.id, entity_type: "uploaded_file", id: "job-extract", job_type: "document_extract" },
    });

    expect(rpcCalls.map(({ name }) => name)).toEqual([
      "save_uploaded_file_extraction",
      "complete_claimed_background_job",
    ]);
    expect(rpcCalls[0].args.p_extraction).toMatchObject({
      content_checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      content_text: "Extracted diligence content",
      page_count: 3,
    });
    expect(rpcCalls[1].args.p_result).not.toHaveProperty("content_text");
  });

  it("records adapter failures without leaking file content to logs", async () => {
    const job = { entity_id: baseFile.id, entity_type: "uploaded_file", id: "job-fail", job_type: "malware_scan" };
    const { client, rpcCalls } = createClient({ claimedJobs: [job] });
    const logger = { error: vi.fn(), info: vi.fn() };
    const fetchImpl = vi.fn(async () => new Response("scanner unavailable", { status: 503 }));

    await expect(processBatch({ client, config: baseConfig, fetchImpl, logger })).resolves.toEqual([
      { jobId: "job-fail", jobType: "malware_scan", status: "retrying_or_failed" },
    ]);
    expect(rpcCalls.at(-1)).toEqual({
      name: "complete_claimed_background_job",
      args: expect.objectContaining({ p_job_id: "job-fail", p_success: false }),
    });
    expect(logger.error).toHaveBeenCalledWith(expect.not.stringContaining("test content"));
  });
});
