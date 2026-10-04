import { supabase } from "@/integrations/supabase/client";
import type { DailyFocus, DailyFocusInput } from "@/domain/focus";

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("No hay sesión activa");
  return data.user.id;
}

/**
 * Daily focus service. One row per user and date (unique constraint), so
 * setting a focus is always an upsert and never duplicates a date.
 */
export const focusService = {
  async getByDate(date: string): Promise<DailyFocus | null> {
    const { data, error } = await supabase
      .from("daily_focus")
      .select("*")
      .eq("focus_date", date)
      .maybeSingle();
    if (error) throw error;
    return (data as DailyFocus | null) ?? null;
  },

  async setFocus(input: DailyFocusInput): Promise<DailyFocus> {
    const user_id = await currentUserId();
    const row = {
      user_id,
      focus_date: input.focus_date,
      source: input.source,
      habit_id: input.source === "habit" ? input.habit_id : null,
      planner_item_id: input.source === "planner" ? input.planner_item_id : null,
      text: input.source === "free" ? (input.text?.trim() ?? null) : null,
    };
    const { data, error } = await supabase
      .from("daily_focus")
      .upsert(row, { onConflict: "user_id,focus_date" })
      .select()
      .single();
    if (error) throw error;
    return data as DailyFocus;
  },

  async clear(date: string) {
    const { error } = await supabase.from("daily_focus").delete().eq("focus_date", date);
    if (error) throw error;
  },
};