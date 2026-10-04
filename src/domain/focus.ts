/**
 * PERSONAL OS — Enfoque del día.
 *
 * A focus is a priority attached to one calendar date. It can point at an
 * existing habit, an existing planner item, or be plain free text. It never
 * creates habits or tasks, and never touches habit stats.
 */

export type FocusSource = "habit" | "planner" | "free";

export interface DailyFocus {
  id: string;
  user_id: string;
  /** ISO date, YYYY-MM-DD — the global date this focus belongs to. */
  focus_date: string;
  source: FocusSource;
  habit_id: string | null;
  planner_item_id: string | null;
  /** Free text focus, or a fallback label for referenced items. */
  text: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyFocusInput {
  focus_date: string;
  source: FocusSource;
  habit_id: string | null;
  planner_item_id: string | null;
  text: string | null;
}

export const FOCUS_SOURCE_LABEL: Record<FocusSource, string> = {
  habit: "Hábito",
  planner: "Planeador",
  free: "Libre",
};