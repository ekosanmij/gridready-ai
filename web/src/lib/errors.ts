type StructuredError = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (error && typeof error === "object") {
    const structuredError = error as StructuredError;
    const parts = [
      structuredError.message,
      structuredError.details,
      structuredError.hint,
      structuredError.code,
    ]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());

    if (parts.length > 0) {
      return Array.from(new Set(parts)).join(" ");
    }
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
}
