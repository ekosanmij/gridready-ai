import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;
const DEFAULT_POLL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const JOB_TYPES = ["malware_scan", "document_extract"];

function positiveInteger(value, fallback, label) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function requiredEnvironment(name, environment = process.env) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optionalAdapterUrl(name, environment = process.env) {
  const value = environment[name]?.trim();
  if (!value) return null;
  const url = new URL(value);
  const local = ["127.0.0.1", "::1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error(`${name} must use HTTPS (HTTP is allowed only for localhost).`);
  }
  return url.toString();
}

export function loadWorkerConfig(environment = process.env) {
  return {
    batchSize: positiveInteger(environment.FILE_WORKER_BATCH_SIZE, DEFAULT_BATCH_SIZE, "FILE_WORKER_BATCH_SIZE"),
    bucket: environment.FILE_WORKER_BUCKET?.trim() || "assessment-evidence",
    documentExtractorToken: environment.DOCUMENT_EXTRACTOR_TOKEN?.trim() || null,
    documentExtractorUrl: optionalAdapterUrl("DOCUMENT_EXTRACTOR_URL", environment),
    malwareScannerToken: environment.MALWARE_SCANNER_TOKEN?.trim() || null,
    malwareScannerUrl: optionalAdapterUrl("MALWARE_SCANNER_URL", environment),
    maxFileBytes: positiveInteger(environment.FILE_WORKER_MAX_FILE_BYTES, DEFAULT_MAX_FILE_BYTES, "FILE_WORKER_MAX_FILE_BYTES"),
    pollMs: positiveInteger(environment.FILE_WORKER_POLL_MS, DEFAULT_POLL_MS, "FILE_WORKER_POLL_MS"),
    serviceRoleKey: requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY", environment),
    supabaseUrl: requiredEnvironment("SUPABASE_URL", environment),
    timeoutMs: positiveInteger(environment.FILE_WORKER_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, "FILE_WORKER_TIMEOUT_MS"),
    workerId: environment.FILE_WORKER_ID?.trim() || `${hostname()}:${process.pid}:${randomUUID()}`,
  };
}

export function normaliseScanResponse(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Malware scanner returned an invalid JSON object.");
  }
  if (!["clean", "quarantined"].includes(payload.status)) {
    throw new Error("Malware scanner status must be clean or quarantined.");
  }
  return {
    engine: typeof payload.engine === "string" ? payload.engine.slice(0, 200) : "configured-adapter",
    engineVersion: typeof payload.engineVersion === "string" ? payload.engineVersion.slice(0, 200) : null,
    signature: typeof payload.signature === "string" ? payload.signature.slice(0, 500) : null,
    status: payload.status,
  };
}

export function normaliseExtractionResponse(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Document extractor returned an invalid JSON object.");
  }
  const contentText = typeof payload.contentText === "string" ? payload.contentText : payload.text;
  if (typeof contentText !== "string" || contentText.trim().length === 0) {
    throw new Error("Document extractor returned no text.");
  }
  if (contentText.length > 5_000_000) {
    throw new Error("Document extractor returned more than 5000000 characters.");
  }
  const pageCount = payload.pageCount === undefined || payload.pageCount === null
    ? null
    : Number(payload.pageCount);
  if (pageCount !== null && (!Number.isSafeInteger(pageCount) || pageCount < 0)) {
    throw new Error("Document extractor pageCount must be a non-negative integer.");
  }
  const metadata = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
    ? payload.metadata
    : {};
  return {
    contentText,
    extractor: typeof payload.extractor === "string" ? payload.extractor.slice(0, 200) : "configured-adapter",
    extractorVersion: typeof payload.extractorVersion === "string" ? payload.extractorVersion.slice(0, 200) : null,
    language: typeof payload.language === "string" ? payload.language.slice(0, 40) : null,
    metadata,
    pageCount,
  };
}

function safeFileName(value) {
  return String(value || "uploaded-file").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-240) || "uploaded-file";
}

async function callAdapter({ blob, file, job, timeoutMs, token, url, fetchImpl }) {
  if (!url) throw new Error(`${job.job_type === "malware_scan" ? "MALWARE_SCANNER_URL" : "DOCUMENT_EXTRACTOR_URL"} is not configured.`);
  const form = new FormData();
  form.append("file", blob, safeFileName(file.original_filename || file.file_name));
  form.append("job_id", job.id);
  form.append("uploaded_file_id", file.id);
  form.append("mime_type", file.mime_type || "application/octet-stream");
  form.append("checksum_sha256", file.checksum_sha256 || "");

  const response = await fetchImpl(url, {
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Adapter returned HTTP ${response.status}.`);
  }
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error("Adapter returned a non-JSON response.");
  }
}

async function loadUploadedFile(client, job, maxFileBytes) {
  if (job.entity_type !== "uploaded_file" || !job.entity_id) {
    throw new Error("File-processing jobs must reference an uploaded_file entity.");
  }
  const { data, error } = await client
    .from("uploaded_files")
    .select("id, checksum_sha256, file_name, malware_scan_status, mime_type, original_filename, retention_state, size_bytes, storage_path")
    .eq("id", job.entity_id)
    .single();
  if (error) throw error;
  if (data.retention_state !== "active") throw new Error("Uploaded file is not active.");
  if (Number(data.size_bytes) > maxFileBytes) {
    throw new Error(`Uploaded file exceeds the worker limit of ${maxFileBytes} bytes.`);
  }
  return data;
}

async function downloadUploadedFile(client, bucket, file) {
  const { data, error } = await client.storage.from(bucket).download(file.storage_path);
  if (error) throw error;
  if (!data) throw new Error("Storage returned an empty file response.");
  return data;
}

async function completeJob(client, workerId, jobId, success, result, errorMessage = null) {
  const { error } = await client.rpc("complete_claimed_background_job", {
    p_error: errorMessage,
    p_job_id: jobId,
    p_result: result,
    p_success: success,
    p_worker_id: workerId,
  });
  if (error) throw error;
}

export async function processClaimedJob({ client, config, fetchImpl = fetch, job }) {
  if (!JOB_TYPES.includes(job.job_type)) throw new Error(`Unsupported job type: ${job.job_type}`);
  const file = await loadUploadedFile(client, job, config.maxFileBytes);
  const blob = await downloadUploadedFile(client, config.bucket, file);
  if (blob.size > config.maxFileBytes) {
    throw new Error(`Stored file exceeds the worker limit of ${config.maxFileBytes} bytes.`);
  }
  const sourceChecksum = createHash("sha256").update(Buffer.from(await blob.arrayBuffer())).digest("hex");
  if (file.checksum_sha256 && sourceChecksum !== file.checksum_sha256) {
    throw new Error("Stored file checksum does not match registered upload metadata.");
  }

  if (job.job_type === "malware_scan") {
    const payload = await callAdapter({
      blob,
      file,
      fetchImpl,
      job,
      timeoutMs: config.timeoutMs,
      token: config.malwareScannerToken,
      url: config.malwareScannerUrl,
    });
    const scan = normaliseScanResponse(payload);
    await completeJob(client, config.workerId, job.id, true, {
      engine: scan.engine,
      engine_version: scan.engineVersion,
      signature: scan.signature,
      status: scan.status,
    });
    return { jobId: job.id, jobType: job.job_type, status: scan.status };
  }

  if (file.malware_scan_status !== "clean") {
    throw new Error("Document extraction requires a clean malware scan.");
  }
  const payload = await callAdapter({
    blob,
    file,
    fetchImpl,
    job,
    timeoutMs: config.timeoutMs,
    token: config.documentExtractorToken,
    url: config.documentExtractorUrl,
  });
  const extraction = normaliseExtractionResponse(payload);
  const contentChecksum = createHash("sha256").update(extraction.contentText).digest("hex");
  const { error: saveError } = await client.rpc("save_uploaded_file_extraction", {
    p_extraction: {
      content_checksum: contentChecksum,
      content_text: extraction.contentText,
      extractor: extraction.extractor,
      extractor_version: extraction.extractorVersion,
      language: extraction.language,
      metadata: extraction.metadata,
      page_count: extraction.pageCount,
    },
    p_job_id: job.id,
    p_worker_id: config.workerId,
  });
  if (saveError) throw saveError;
  await completeJob(client, config.workerId, job.id, true, {
    content_checksum: contentChecksum,
    extracted_characters: extraction.contentText.length,
    extractor: extraction.extractor,
    extractor_version: extraction.extractorVersion,
    language: extraction.language,
    page_count: extraction.pageCount,
  });
  return { jobId: job.id, jobType: job.job_type, status: "ready" };
}

export async function processBatch({ client, config, fetchImpl = fetch, logger = console }) {
  const { data: jobs, error } = await client.rpc("claim_background_jobs", {
    p_job_types: JOB_TYPES,
    p_limit: config.batchSize,
    p_worker_id: config.workerId,
  });
  if (error) throw error;

  const results = [];
  for (const job of jobs || []) {
    try {
      const result = await processClaimedJob({ client, config, fetchImpl, job });
      results.push(result);
      logger.info(JSON.stringify({ event: "file_job_completed", ...result }));
    } catch (jobError) {
      const message = jobError instanceof Error ? jobError.message : "File-processing job failed.";
      try {
        await completeJob(client, config.workerId, job.id, false, {}, message);
      } catch (completionError) {
        logger.error(JSON.stringify({
          error: completionError instanceof Error ? completionError.message : "Job completion failed.",
          event: "file_job_completion_failed",
          jobId: job.id,
          jobType: job.job_type,
        }));
      }
      results.push({ jobId: job.id, jobType: job.job_type, status: "retrying_or_failed" });
      logger.error(JSON.stringify({ event: "file_job_failed", jobId: job.id, jobType: job.job_type, error: message }));
    }
  }
  return results;
}

async function main() {
  const config = loadWorkerConfig();
  const runOnce = process.argv.includes("--once");
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.info(JSON.stringify({ event: "file_worker_started", runOnce, workerId: config.workerId }));
  do {
    const results = await processBatch({ client, config });
    if (runOnce || stopping) break;
    if (results.length === 0) await new Promise((resolve) => setTimeout(resolve, config.pollMs));
  } while (!stopping);
  console.info(JSON.stringify({ event: "file_worker_stopped", workerId: config.workerId }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(JSON.stringify({ event: "file_worker_crashed", error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
}
