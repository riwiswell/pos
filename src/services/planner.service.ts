import { supabase } from "@/integrations/supabase/client";
import type {
  PlannerCategory,
  PlannerCategoryInput,
  PlannerItem,
  PlannerItemInput,
} from "@/domain/planner";

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("No hay sesión activa");
  return data.user.id;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Planner data service. Every read/write is scoped to the authenticated user
 * and RLS enforces the same rule server-side.
 */
export const plannerService = {
  async listCategories(): Promise<PlannerCategory[]> {
    const { data, error } = await supabase
      .from("planner_categories")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as PlannerCategory[];
  },

  async createCategory(input: PlannerCategoryInput): Promise<PlannerCategory> {
    const user_id = await currentUserId();
    const name = normalizeName(input.name);

    // Reuse an equivalent category instead of creating a duplicate.
    const existing = await plannerService.listCategories();
    const match = existing.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    if (match) return match;

    const { data, error } = await supabase
      .from("planner_categories")
      .insert({ user_id, name, color: input.color, position: existing.length })
      .select()
      .single();
    if (error) throw error;
    return data as PlannerCategory;
  },

  async updateCategory(id: string, patch: Partial<PlannerCategoryInput>) {
    const next = { ...patch, ...(patch.name ? { name: normalizeName(patch.name) } : {}) };
    const { error } = await supabase.from("planner_categories").update(next).eq("id", id);
    if (error) throw error;
  },

  async deleteCategory(id: string) {
    const { error } = await supabase.from("planner_categories").delete().eq("id", id);
    if (error) throw error;
  },

  /** Items for one calendar day (the global date). */
  async listByDate(date: string): Promise<PlannerItem[]> {
    const { data, error } = await supabase
      .from("planner_items")
      .select("*")
      .eq("scheduled_on", date)
      .order("start_time", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as PlannerItem[];
  },

  async createItem(input: PlannerItemInput): Promise<PlannerItem> {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("planner_items")
      .insert({ ...input, title: input.title.trim(), user_id })
      .select()
      .single();
    if (error) throw error;
    return data as PlannerItem;
  },

  async updateItem(id: string, patch: Partial<PlannerItemInput>) {
    const { error } = await supabase.from("planner_items").update(patch).eq("id", id);
    if (error) throw error;
  },

  async setStatus(id: string, done: boolean) {
    const { error } = await supabase
      .from("planner_items")
      .update({ status: done ? "done" : "pending", completed_at: done ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) throw error;
  },

  async deleteItem(id: string) {
    const { error } = await supabase.from("planner_items").delete().eq("id", id);
    if (error) throw error;
  },
};