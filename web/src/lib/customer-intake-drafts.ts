import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentFormState } from "@/lib/intake";
import type { IntakeFieldState, IntakeRequestTypeId } from "@/lib/intake-request-types";

export const customerEvidenceMaxBytes = 50 * 1024 * 1024;
export const customerEvidenceAccept = ".pdf,.docx,.xlsx,.csv,.kml,.kmz,.zip,.geojson,.json,.gif,.jpg,.jpeg,.png,.tif,.tiff,.webp";

const supportedExtensions = new Set([
  "csv",
  "docx",
  "geojson",
  "gif",
  "jpeg",
  "jpg",
  "json",
  "kml",
  "kmz",
  "pdf",
  "png",
  "tif",
  "tiff",
  "webp",
  "xlsx",
  "zip",
]);

export type CustomerIntakeDraft = {
  fieldStates: Partial<Record<keyof AssessmentFormState, IntakeFieldState>>;
  form: AssessmentFormState;
  id: string;
  savedAt: string;
  status: "active" | "discarded" | "submitted";
  submittedAssessmentId: string | null;
};

export type CustomerIntakeFile = {
  checksumSha256: string;
  createdAt: string;
  id: string;
  malwareScanStatus: "clean" | "failed" | "pending" | "quarantined";
  mimeType: string | null;
  originalFilename: string;
  processingStatus: "failed" | "processing" | "ready" | "uploaded" | "uploading";
  sizeBytes: number;
  storagePath: string;
};

type DraftRecord = {
  field_states?: CustomerIntakeDraft["fieldStates"] | null;
  form_data?: AssessmentFormState | null;
  id: string;
  status: CustomerIntakeDraft["status"];
  submitted_assessment_id?: string | null;
  updated_at: string;
};

type FileRecord = {
  checksum_sha256: string;
  created_at: string;
  id: string;
  malware_scan_status: CustomerIntakeFile["malwareScanStatus"];
  mime_type: string | null;
  original_filename: string;
  processing_status: CustomerIntakeFile["processingStatus"];
  size_bytes: number;
  storage_path: string;
};

function normaliseDraft(record: DraftRecord | null, fallbackForm: AssessmentFormState): CustomerIntakeDraft | null {
  if (!record) {
    return null;
  }

  return {
    fieldStates: record.field_states ?? {},
    form: { ...fallbackForm, ...(record.form_data ?? {}) },
    id: record.id,
    savedAt: record.updated_at,
    status: record.status,
    submittedAssessmentId: record.submitted_assessment_id ?? null,
  };
}

function normaliseFile(record: FileRecord): CustomerIntakeFile {
  return {
    checksumSha256: record.checksum_sha256,
    createdAt: record.created_at,
    id: record.id,
    malwareScanStatus: record.malware_scan_status,
    mimeType: record.mime_type,
    originalFilename: record.original_filename,
    processingStatus: record.processing_status,
    sizeBytes: record.size_bytes,
    storagePath: record.storage_path,
  };
}

export function validateCustomerEvidenceFile(file: File) {
  if (file.size <= 0) {
    return "The selected file is empty.";
  }
  if (file.size > customerEvidenceMaxBytes) {
    return "Files must be 50 MB or smaller.";
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!supportedExtensions.has(extension)) {
    return "Use PDF, DOCX, XLSX, CSV, KML, KMZ, ZIP, GeoJSON, JSON, or a supported image.";
  }

  return null;
}

export async function sha256File(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function loadCustomerIntakeDraft(
  client: SupabaseClient,
  input: { draftId?: string; fallbackForm: AssessmentFormState; requestType: IntakeRequestTypeId; userId: string },
) {
  let query = client
    .from("customer_intake_drafts")
    .select("id, form_data, field_states, status, submitted_assessment_id, updated_at")
    .eq("user_id", input.userId)
    .eq("request_type", input.requestType)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (input.draftId) {
    query = query.eq("id", input.draftId);
  } else {
    query = query.eq("status", "active");
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }

  return normaliseDraft(data as DraftRecord | null, input.fallbackForm);
}

export async function saveCustomerIntakeDraft(
  client: SupabaseClient,
  input: {
    draftId: string;
    fieldStates: CustomerIntakeDraft["fieldStates"];
    form: AssessmentFormState;
    organisationId: string | null;
    requestType: IntakeRequestTypeId;
    userId: string;
  },
) {
  const { data, error } = await client
    .from("customer_intake_drafts")
    .upsert({
      field_states: input.fieldStates,
      form_data: input.form,
      id: input.draftId,
      organisation_id: input.organisationId,
      request_type: input.requestType,
      schema_version: 1,
      status: "active",
      submitted_assessment_id: null,
      updated_at: new Date().toISOString(),
      user_id: input.userId,
    }, { onConflict: "id" })
    .select("id, form_data, field_states, status, submitted_assessment_id, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return normaliseDraft(data as DraftRecord, input.form) as CustomerIntakeDraft;
}

export async function discardCustomerIntakeDraft(client: SupabaseClient, draftId: string) {
  const { error } = await client.from("customer_intake_drafts").delete().eq("id", draftId);
  if (error) {
    throw error;
  }
}

export async function listCustomerIntakeFiles(client: SupabaseClient, draftId: string) {
  const { data, error } = await client
    .from("customer_intake_files")
    .select("id, storage_path, original_filename, mime_type, size_bytes, checksum_sha256, processing_status, malware_scan_status, created_at")
    .eq("draft_id", draftId)
    .eq("retention_state", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as FileRecord[]).map(normaliseFile);
}

export async function uploadCustomerIntakeFile(
  client: SupabaseClient,
  input: { draftId: string; file: File; userId: string },
  onProgress?: (progress: number) => void,
) {
  const validationError = validateCustomerEvidenceFile(input.file);
  if (validationError) {
    throw new Error(validationError);
  }

  onProgress?.(10);
  const checksum = await sha256File(input.file);
  onProgress?.(30);

  const { data: duplicate, error: duplicateError } = await client
    .from("customer_intake_files")
    .select("id")
    .eq("draft_id", input.draftId)
    .eq("checksum_sha256", checksum)
    .eq("retention_state", "active")
    .maybeSingle();
  if (duplicateError) {
    throw duplicateError;
  }
  if (duplicate) {
    throw new Error("This file is already attached to the draft.");
  }

  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `drafts/${input.userId}/${input.draftId}/${crypto.randomUUID()}-${safeName}`;
  onProgress?.(45);
  const { error: uploadError } = await client.storage
    .from("assessment-evidence")
    .upload(storagePath, input.file, { contentType: input.file.type || undefined, upsert: false });
  if (uploadError) {
    throw uploadError;
  }

  onProgress?.(85);
  const { data, error } = await client
    .from("customer_intake_files")
    .insert({
      checksum_sha256: checksum,
      draft_id: input.draftId,
      malware_scan_status: "pending",
      mime_type: input.file.type || null,
      original_filename: input.file.name,
      processing_status: "uploaded",
      retention_state: "active",
      size_bytes: input.file.size,
      storage_path: storagePath,
      uploaded_by: input.userId,
    })
    .select("id, storage_path, original_filename, mime_type, size_bytes, checksum_sha256, processing_status, malware_scan_status, created_at")
    .single();

  if (error) {
    await client.storage.from("assessment-evidence").remove([storagePath]);
    throw error;
  }

  onProgress?.(100);
  return normaliseFile(data as FileRecord);
}

export async function removeCustomerIntakeFile(client: SupabaseClient, file: CustomerIntakeFile) {
  const { error: storageError } = await client.storage.from("assessment-evidence").remove([file.storagePath]);
  if (storageError) {
    throw storageError;
  }

  const { error } = await client.from("customer_intake_files").delete().eq("id", file.id);
  if (error) {
    throw error;
  }
}

export async function submitCustomerIntakeDraft(
  client: SupabaseClient,
  input: {
    draftId: string;
    fieldStates: CustomerIntakeDraft["fieldStates"];
    form: AssessmentFormState;
    requestType: IntakeRequestTypeId;
  },
) {
  const { data, error } = await client.rpc("submit_customer_intake_draft", {
    p_draft_id: input.draftId,
    p_field_states: input.fieldStates,
    p_form_data: input.form,
    p_request_type: input.requestType,
    p_schema_version: 1,
  });
  if (error) {
    throw error;
  }
  if (typeof data !== "string" || !data) {
    throw new Error("The submitted assessment identifier was not returned.");
  }
  return data;
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
