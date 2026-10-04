import { supabase } from "@/integrations/supabase/client";
import type {
  Habit,
  HabitCategory,
  HabitCategoryInput,
  HabitInput,
  HabitLog,
} from "@/domain/types";

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("No hay sesión activa");
  return data.user.id;
}

/**
 * Habits data service.
 *
 * Every write is scoped to the authenticated user; RLS enforces the same rule
 * server-side. The UI depends only on these functions, never on the client.
 */
export const habitsService = {
  async listCategories(): Promise<HabitCategory[]> {
    const { data, error } = await supabase
      .from("habit_categories")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as HabitCategory[];
  },

  async createCategory(input: HabitCategoryInput, position: number): Promise<HabitCategory> {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("habit_categories")
      .insert({ ...input, position, user_id })
      .select()
      .single();
    if (error) throw error;
    return data as HabitCategory;
  },

  async updateCategory(id: string, patch: Partial<HabitCategoryInput & { position: number }>) {
    const { error } = await supabase.from("habit_categories").update(patch).eq("id", id);
    if (error) throw error;
  },

  async deleteCategory(id: string) {
    const { error } = await supabase.from("habit_categories").delete().eq("id", id);
    if (error) throw error;
  },

  async reorderCategories(ordered: { id: string; position: number }[]) {
    await Promise.all(
      ordered.map(({ id, position }) =>
        supabase
          .from("habit_categories")
          .update({ position })
          .eq("id", id)
          .then(({ error }) => {
            if (error) throw error;
          }),
      ),
    );
  },

  async listHabits(): Promise<Habit[]> {
    const { data, error } = await supabase
      .from("habits")
      .select("*")
      .eq("active", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Habit[];
  },

  async createHabit(input: HabitInput, position: number): Promise<Habit> {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("habits")
      .insert({ ...input, position, user_id })
      .select()
      .single();
    if (error) throw error;
    return data as Habit;
  },

  async updateHabit(id: string, patch: Partial<HabitInput & { position: number; active: boolean }>) {
    const { error } = await supabase.from("habits").update(patch).eq("id", id);
    if (error) throw error;
  },

  async deleteHabit(id: string) {
    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (error) throw error;
  },

  async reorderHabits(ordered: { id: string; position: number }[]) {
    await Promise.all(
      ordered.map(({ id, position }) =>
        supabase
          .from("habits")
          .update({ position })
          .eq("id", id)
          .then(({ error }) => {
            if (error) throw error;
          }),
      ),
    );
  },

  async listLogsByDate(date: string): Promise<HabitLog[]> {
    const { data, error } = await supabase.from("habit_logs").select("*").eq("date", date);
    if (error) throw error;
    return (data ?? []) as HabitLog[];
  },

  /** All logs inside an inclusive date range — one single query, never per cell. */
  async listLogsInRange(start: string, end: string): Promise<HabitLog[]> {
    const { data, error } = await supabase
      .from("habit_logs")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });
    if (error) throw error;
    return (data ?? []) as HabitLog[];
  },

  /** Creates or updates the log for a habit on a given date. */
  async saveLog(
    habitId: string,
    date: string,
    patch: { completed?: boolean; value?: number; note?: string | null },
  ): Promise<HabitLog> {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("habit_logs")
      .upsert(
        { user_id, habit_id: habitId, date, ...patch },
        { onConflict: "habit_id,date" },
      )
      .select()
      .single();
    if (error) throw error;
    return data as HabitLog;
  },

  /** Most recently touched logs — real activity, no mocks. */
  async recentLogs(limit = 6): Promise<HabitLog[]> {
    const { data, error } = await supabase
      .from("habit_logs")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as HabitLog[];
  },
};