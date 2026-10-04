/**
 * PERSONAL OS — Planeador domain.
 *
 * The planner holds commitments, appointments, tasks and time blocks. It is NOT
 * a second habits system: nothing here measures streaks or consistency.
 */

export type PlannerItemType = "task" | "event";
export type PlannerPriority = "normal" | "important" | "urgent";
export type PlannerStatus = "pending" | "done";

export interface PlannerCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface PlannerItem {
  id: string;
  user_id: string;
  category_id: string | null;
  type: PlannerItemType;
  title: string;
  description: string | null;
  /** ISO date, YYYY-MM-DD — the global date this item belongs to. */
  scheduled_on: string;
  /** HH:MM[:SS] or null when the item has no fixed hour. */
  start_time: string | null;
  end_time: string | null;
  due_on: string | null;
  location: string | null;
  priority: PlannerPriority;
  status: PlannerStatus;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface PlannerCategoryInput {
  name: string;
  color: string;
}

export interface PlannerItemInput {
  type: PlannerItemType;
  title: string;
  description: string | null;
  scheduled_on: string;
  start_time: string | null;
  end_time: string | null;
  due_on: string | null;
  location: string | null;
  priority: PlannerPriority;
  category_id: string | null;
}

export const PRIORITY_LABEL: Record<PlannerPriority, string> = {
  normal: "Normal",
  important: "Importante",
  urgent: "Urgente",
};

export const TYPE_LABEL: Record<PlannerItemType, string> = {
  task: "Tarea",
  event: "Evento",
};

/** "08:00" from "08:00:00"; empty string when there is no hour. */
export function shortTime(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

/**
 * Chronological order for a day: timed items first by hour, untimed last,
 * always stable by creation time.
 */
export function compareChronologically(a: PlannerItem, b: PlannerItem): number {
  const at = a.start_time ?? "";
  const bt = b.start_time ?? "";
  if (at && bt && at !== bt) return at < bt ? -1 : 1;
  if (at && !bt) return -1;
  if (!at && bt) return 1;
  return a.created_at < b.created_at ? -1 : 1;
}