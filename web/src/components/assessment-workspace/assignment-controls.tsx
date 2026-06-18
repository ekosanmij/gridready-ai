"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarClock, Loader2, Save } from "lucide-react";
import { canManageAssessments, type AppRole } from "@/components/auth/auth-provider";
import { FieldControl, StatusPill, inputClass, primaryButtonClass, textareaClass } from "@/components/ui-primitives";
import { supabase } from "@/lib/supabase";

type Assignee = { full_name: string | null; id: string; role: AppRole };

export type AssignmentValue = {
  assignment_note: string | null;
  owner_id: string | null;
  sla_due_at: string | null;
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function AssignmentControls({ assessmentId, role, value, onSaved }: {
  assessmentId: string;
  role: AppRole;
  value: AssignmentValue;
  onSaved: (value: AssignmentValue) => void;
}) {
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [ownerId, setOwnerId] = useState(value.owner_id ?? "");
  const [dueAt, setDueAt] = useState(toLocalDateTime(value.sla_due_at));
  const [note, setNote] = useState(value.assignment_note ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const editable = canManageAssessments(role);

  useEffect(() => {
    if (!editable || !supabase) return;
    void supabase.from("profiles").select("id, full_name, role").eq("is_active", true).in("role", ["admin", "analyst", "reviewer"]).order("full_name").then(({ data }) => {
      setAssignees((data ?? []) as Assignee[]);
    });
  }, [editable]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editable) return;
    setSaving(true);
    setMessage("");
    const nextValue: AssignmentValue = {
      assignment_note: note.trim() || null,
      owner_id: ownerId || null,
      sla_due_at: dueAt ? new Date(dueAt).toISOString() : null,
    };
    const { error } = await supabase.from("site_assessments").update(nextValue).eq("id", assessmentId);
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    onSaved(nextValue);
    setMessage("Assignment and SLA saved.");
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]"><CalendarClock size={16} /> Owner & SLA</div>
        <StatusPill tone={editable ? "brand" : "neutral"}>{editable ? "Editable" : "Read only"}</StatusPill>
      </div>
      <FieldControl label="Owner">
        <select className={inputClass} disabled={!editable} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
          <option value="">Unassigned</option>
          {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.full_name || assignee.id} ({assignee.role})</option>)}
        </select>
      </FieldControl>
      <FieldControl label="SLA due">
        <input className={inputClass} disabled={!editable} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
      </FieldControl>
      <FieldControl label="Assignment note">
        <textarea className={textareaClass} disabled={!editable} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </FieldControl>
      {editable ? <button type="submit" disabled={saving} className={`${primaryButtonClass} w-full`}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save assignment</button> : null}
      {message ? <p aria-live="polite" className="text-xs text-[var(--color-text-secondary)]">{message}</p> : null}
    </form>
  );
}
