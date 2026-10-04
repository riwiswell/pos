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
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("entry_time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data ?? []) as JournalEntry[];
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
    const { data, error } = await supabase
      .from("shopping_lists")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ShoppingList[];
  },

  async listItems(): Promise<ShoppingItem[]> {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ShoppingItem[];
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