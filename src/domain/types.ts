/**
 * PERSONAL OS — Domain types.
 *
 * These are the stable data contracts the UI depends on. They intentionally do
 * not leak Supabase specifics so future domains (Finanzas, Salud, ...) can be
 * added without reshaping the UI layer.
 */

export type HabitType = "check" | "counter";
/**
 * A "habit" repeats every day and builds streaks. An "activity" is something you
 * simply want to log when it happens, without judging consistency.
 */
export type HabitKind = "habit" | "activity";

export interface Profile {
  id: string;
  full_name: string | null;
  /** Name used in the greeting; falls back to full_name. */
  display_name: string | null;
  avatar_url: string | null;
  /** Storage path (profile-media) or absolute URL of the custom background. */
  background_url: string | null;
  accent_color: string | null;
  created_at: string;
  updated_at: string;
}

export interface HabitCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  type: HabitType;
  kind: HabitKind;
  target: number | null;
  unit: string | null;
  position: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HabitLog {
  id: string;
  user_id: string;
  habit_id: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  completed: boolean;
  value: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface HabitCategoryInput {
  name: string;
  color: string;
}

export interface HabitInput {
  category_id: string | null;
  name: string;
  type: HabitType;
  kind: HabitKind;
  target: number | null;
  unit: string | null;
}