import { supabase } from "@/integrations/supabase/client";
import type {
  JournalEntry,
  JournalEntryInput,
  ShoppingItem,
  ShoppingList,
} from "@/domain/journal";

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("No hay sesión activa");
  return data.user.id;
}

function clean(input: JournalEntryInput): JournalEntryInput {
  const opt = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    ...input,
    title: opt(input.title),
    content: input.content.trim(),
    mood: opt(input.mood),
    notes: opt(input.notes),
    entry_time: input.entry_time || null,
    items: input.items.map((i) => i.trim()).filter(Boolean),
  };
}

/** Diario data service. Writes only to Diario tables — never to other modules. */
export const journalService = {
  async listEntries(): Promise<JournalEntry[]> {
    // Global search must see the whole journal, not just PostgREST's first page.
    const pageSize = 1000;
    const rows: JournalEntry[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("entry_time", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as JournalEntry[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  },

  async createEntry(input: JournalEntryInput): Promise<JournalEntry> {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({ ...clean(input), user_id } as any)
      .select()
      .single();
    if (error) throw error;
    return data as JournalEntry;
  },

  async updateEntry(id: string, input: JournalEntryInput) {
    const { error } = await supabase.from("journal_entries").update(clean(input) as any).eq("id", id);
    if (error) throw error;
  },

  async deleteEntry(id: string) {
    const { error } = await supabase.from("journal_entries").delete().eq("id", id);
    if (error) throw error;
  },

  /* ------------------------------------------------------------ compras */
  async listLists(): Promise<ShoppingList[]> {
    const pageSize = 1000;
    const rows: ShoppingList[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as ShoppingList[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  },

  async listItems(): Promise<ShoppingItem[]> {
    const pageSize = 1000;
    const rows: ShoppingItem[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as ShoppingItem[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  },

  async createList(name: string, position: number): Promise<ShoppingList> {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ user_id, name: name.trim(), position })
      .select()
      .single();
    if (error) throw error;
    return data as ShoppingList;
  },

  async renameList(id: string, name: string) {
    const { error } = await supabase.from("shopping_lists").update({ name: name.trim() }).eq("id", id);
    if (error) throw error;
  },

  async deleteList(id: string) {
    const { error } = await supabase.from("shopping_lists").delete().eq("id", id);
    if (error) throw error;
  },

  async addItem(list_id: string, name: string, position: number) {
    const user_id = await currentUserId();
    const { error } = await supabase
      .from("shopping_items")
      .insert({ user_id, list_id, name: name.trim(), position });
    if (error) throw error;
  },

  async updateItem(id: string, patch: { name?: string; checked?: boolean }) {
    const next = patch.name !== undefined ? { ...patch, name: patch.name.trim() } : patch;
    const { error } = await supabase.from("shopping_items").update(next).eq("id", id);
    if (error) throw error;
  },

  async deleteItem(id: string) {
    const { error } = await supabase.from("shopping_items").delete().eq("id", id);
    if (error) throw error;
  },
};