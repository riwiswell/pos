import type { Habit, HabitLog } from "@/domain/types";

/**
 * Single source of truth for "is this habit completed on this day".
 * Counter habits with a target need to reach it; without target any value > 0 counts.
 */
export function isHabitDone(habit: Habit, log: HabitLog | undefined): boolean {
  if (habit.type === "check") return log?.completed ?? false;
  const target = habit.target ?? 0;
  const value = log?.value ?? 0;
  return target > 0 ? value >= target : value > 0;
}

/** Partial progress: some value logged but the target not reached yet. */
export function isHabitPartial(habit: Habit, log: HabitLog | undefined): boolean {
  if (isHabitDone(habit, log)) return false;
  if (habit.type === "check") return false;
  return (log?.value ?? 0) > 0;
}