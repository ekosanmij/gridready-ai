"use client";

export type ThemePreference = "dark" | "light";

const themePreferenceKey = "gridready-ui-theme";
const themePreferenceChangedEvent = "gridready-theme-preference-changed";
const assessmentPanelPrefix = "gridready-assessment-panels";

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredThemePreference(): ThemePreference | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const stored = window.localStorage.getItem(themePreferenceKey);
  return stored === "dark" || stored === "light" ? stored : null;
}

export function resolveThemePreference(): ThemePreference {
  const stored = getStoredThemePreference();

  if (stored) {
    return stored;
  }

  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
}

export function saveThemePreference(theme: ThemePreference) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(themePreferenceKey, theme);
}

export function getThemePreferenceSnapshot(): ThemePreference {
  return resolveThemePreference();
}

export function getThemePreferenceServerSnapshot(): ThemePreference {
  return "light";
}

export function subscribeThemePreference(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  const handlePreferenceChange = () => {
    onStoreChange();
  };
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === themePreferenceKey) {
      onStoreChange();
    }
  };

  window.addEventListener(themePreferenceChangedEvent, handlePreferenceChange);
  window.addEventListener("storage", handleStorageChange);
  mediaQuery?.addEventListener?.("change", handlePreferenceChange);

  return () => {
    window.removeEventListener(themePreferenceChangedEvent, handlePreferenceChange);
    window.removeEventListener("storage", handleStorageChange);
    mediaQuery?.removeEventListener?.("change", handlePreferenceChange);
  };
}

export function setThemePreference(theme: ThemePreference) {
  saveThemePreference(theme);
  applyThemePreference(theme);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(themePreferenceChangedEvent));
  }
}

export function getAssessmentPanelPreferenceKey(assessmentId: string) {
  return `${assessmentPanelPrefix}:${assessmentId}`;
}

export function getStoredAssessmentPanels<T extends string>(assessmentId: string, allowedIds: readonly T[]) {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const stored = window.localStorage.getItem(getAssessmentPanelPreferenceKey(assessmentId));

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;

    if (!Array.isArray(parsed)) {
      return null;
    }

    const allowed = new Set<string>(allowedIds);
    return parsed.filter((item): item is T => typeof item === "string" && allowed.has(item));
  } catch {
    return null;
  }
}

export function saveAssessmentPanels(assessmentId: string, expandedSectionIds: readonly string[]) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(
    getAssessmentPanelPreferenceKey(assessmentId),
    JSON.stringify(Array.from(new Set(expandedSectionIds))),
  );
}
