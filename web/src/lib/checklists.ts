export const checklistResponseStatuses = [
  { value: "not_started", label: "Not started" },
  { value: "pass", label: "Pass" },
  { value: "risk", label: "Risk" },
  { value: "blocked", label: "Blocked" },
  { value: "not_applicable", label: "N/A" },
] as const;

export type ChecklistResponseStatus = (typeof checklistResponseStatuses)[number]["value"];

export type ChecklistTemplateRecord = {
  id: string;
  name: string;
  market_region: string;
  version: string;
};

export type ChecklistTemplateItemRecord = {
  id: string;
  template_id: string;
  module_key: string;
  module_name: string;
  module_sort_order: number;
  item_key: string;
  prompt: string;
  guidance: string | null;
  is_required: boolean;
  item_sort_order: number;
};

export type ChecklistResponseRecord = {
  id: string;
  template_item_id: string;
  status: ChecklistResponseStatus;
  analyst_note: string | null;
  evidence_note: string | null;
  updated_at: string;
};

export type ChecklistDraft = {
  responseId: string | null;
  status: ChecklistResponseStatus;
  analystNote: string;
  evidenceNote: string;
  updatedAt: string | null;
};

export type ChecklistItemWithDraft = ChecklistTemplateItemRecord & {
  draft: ChecklistDraft;
};

export type ChecklistModuleGroup = {
  moduleKey: string;
  moduleName: string;
  moduleSortOrder: number;
  items: ChecklistItemWithDraft[];
  totalItems: number;
  answeredItems: number;
  requiredItems: number;
  requiredAnsweredItems: number;
  progressPercent: number;
};

export function createChecklistDraft(response?: ChecklistResponseRecord | null): ChecklistDraft {
  return {
    responseId: response?.id ?? null,
    status: response?.status ?? "not_started",
    analystNote: response?.analyst_note ?? "",
    evidenceNote: response?.evidence_note ?? "",
    updatedAt: response?.updated_at ?? null,
  };
}

export function buildChecklistDrafts(
  items: ChecklistTemplateItemRecord[],
  responses: ChecklistResponseRecord[],
) {
  const responseByItemId = new Map(responses.map((response) => [response.template_item_id, response]));

  return items.reduce<Record<string, ChecklistDraft>>((drafts, item) => {
    drafts[item.id] = createChecklistDraft(responseByItemId.get(item.id));
    return drafts;
  }, {});
}

export function isChecklistAnswered(status: ChecklistResponseStatus) {
  return status !== "not_started";
}

export function groupChecklistItems(
  items: ChecklistTemplateItemRecord[],
  drafts: Record<string, ChecklistDraft>,
): ChecklistModuleGroup[] {
  const groupsByKey = new Map<string, ChecklistModuleGroup>();

  [...items]
    .sort((first, second) => {
      if (first.module_sort_order !== second.module_sort_order) {
        return first.module_sort_order - second.module_sort_order;
      }

      return first.item_sort_order - second.item_sort_order;
    })
    .forEach((item) => {
      const group =
        groupsByKey.get(item.module_key) ??
        ({
          moduleKey: item.module_key,
          moduleName: item.module_name,
          moduleSortOrder: item.module_sort_order,
          items: [],
          totalItems: 0,
          answeredItems: 0,
          requiredItems: 0,
          requiredAnsweredItems: 0,
          progressPercent: 0,
        } satisfies ChecklistModuleGroup);

      const draft = drafts[item.id] ?? createChecklistDraft();
      const itemWithDraft = { ...item, draft };

      group.items.push(itemWithDraft);
      group.totalItems += 1;

      if (isChecklistAnswered(draft.status)) {
        group.answeredItems += 1;
      }

      if (item.is_required) {
        group.requiredItems += 1;

        if (isChecklistAnswered(draft.status)) {
          group.requiredAnsweredItems += 1;
        }
      }

      group.progressPercent =
        group.totalItems === 0 ? 0 : Math.round((group.answeredItems / group.totalItems) * 100);

      groupsByKey.set(item.module_key, group);
    });

  return [...groupsByKey.values()].sort((first, second) => first.moduleSortOrder - second.moduleSortOrder);
}

export function calculateChecklistProgress(groups: ChecklistModuleGroup[]) {
  const totalItems = groups.reduce((sum, group) => sum + group.totalItems, 0);
  const answeredItems = groups.reduce((sum, group) => sum + group.answeredItems, 0);
  const requiredItems = groups.reduce((sum, group) => sum + group.requiredItems, 0);
  const requiredAnsweredItems = groups.reduce((sum, group) => sum + group.requiredAnsweredItems, 0);

  return {
    totalItems,
    answeredItems,
    requiredItems,
    requiredAnsweredItems,
    progressPercent: totalItems === 0 ? 0 : Math.round((answeredItems / totalItems) * 100),
  };
}

export function checklistStatusLabel(status: ChecklistResponseStatus) {
  return checklistResponseStatuses.find((item) => item.value === status)?.label ?? status;
}

export function checklistStatusTone(status: ChecklistResponseStatus) {
  const styles: Record<ChecklistResponseStatus, string> = {
    not_started: "border-slate-200 bg-white text-slate-600",
    pass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    risk: "border-amber-200 bg-amber-50 text-amber-800",
    blocked: "border-rose-200 bg-rose-50 text-rose-800",
    not_applicable: "border-slate-200 bg-slate-100 text-slate-600",
  };

  return styles[status];
}
