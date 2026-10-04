/**
 * Diario — domain types. One source of truth (journal_entries) for every entry
 * type; shopping lists live in their own checkable structure inside Diario.
 */
export type JournalType =
  | "diary"
  | "dream"
  | "thought"
  | "reflection"
  | "gratitude"
  | "idea"
  | "memory";

export interface JournalEntry {
  id: string;
  user_id: string;
  type: JournalType;
  title: string | null;
  content: string;
  /** For memories: the date of the memory itself. created_at = registration date. */
  entry_date: string;
  entry_time: string | null;
  /** Dreams: emotion / sensation. */
  mood: string | null;
  /** Dreams: extra notes. */
  notes: string | null;
  /** Gratitude reasons. */
  items: string[];
  /** Storage paths (reuses the existing private photo bucket). */
  photos: string[];
  created_at: string;
  updated_at: string;
}

export interface JournalEntryInput {
  type: JournalType;
  title: string | null;
  content: string;
  entry_date: string;
  entry_time: string | null;
  mood: string | null;
  notes: string | null;
  items: string[];
  photos: string[];
}

export interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ShoppingItem {
  id: string;
  user_id: string;
  list_id: string;
  name: string;
  checked: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface JournalTypeMeta {
  label: string;
  plural: string;
  emoji: string;
  color: string;
  /** Quick types open a minimal editor. */
  quick: boolean;
  contentLabel: string;
  placeholder: string;
}

export const JOURNAL_TYPES: JournalType[] = [
  "diary",
  "dream",
  "thought",
  "reflection",
  "gratitude",
  "idea",
  "memory",
];

export const JOURNAL_META: Record<JournalType, JournalTypeMeta> = {
  diary: {
    label: "Diario",
    plural: "Diario",
    emoji: "📔",
    color: "#7dd3fc",
    quick: false,
    contentLabel: "¿Qué pasó hoy?",
    placeholder: "Escribe libremente sobre tu día…",
  },
  dream: {
    label: "Sueño",
    plural: "Sueños",
    emoji: "🌙",
    color: "#a5b4fc",
    quick: false,
    contentLabel: "Descripción del sueño",
    placeholder: "¿Qué soñaste? Lugares, personas, lo que recuerdes…",
  },
  thought: {
    label: "Pensamiento",
    plural: "Pensamientos",
    emoji: "💭",
    color: "#f0abfc",
    quick: true,
    contentLabel: "Pensamiento",
    placeholder: "Algo que se te ocurrió…",
  },
  reflection: {
    label: "Reflexión",
    plural: "Reflexiones",
    emoji: "🪞",
    color: "#fcd34d",
    quick: false,
    contentLabel: "Reflexión",
    placeholder: "Escribe sin prisa, sin preguntas obligatorias…",
  },
  gratitude: {
    label: "Gratitud",
    plural: "Gratitud",
    emoji: "🙏",
    color: "#86efac",
    quick: true,
    contentLabel: "Nota (opcional)",
    placeholder: "Algo más que quieras añadir…",
  },
  idea: {
    label: "Idea",
    plural: "Ideas",
    emoji: "💡",
    color: "#fde047",
    quick: true,
    contentLabel: "Idea",
    placeholder: "Captura la idea antes de que se escape…",
  },
  memory: {
    label: "Recuerdo",
    plural: "Recuerdos",
    emoji: "📸",
    color: "#fda4af",
    quick: false,
    contentLabel: "Descripción",
    placeholder: "¿Qué recuerdas de ese momento?",
  },
};

export const DREAM_MOODS = ["Tranquilo", "Feliz", "Extraño", "Confuso", "Triste", "Angustia", "Miedo"];

/** Searchable text of an entry (title, content, gratitude items, dream notes). */
export function entryMatches(entry: JournalEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [entry.title, entry.content, entry.notes, ...entry.items]
    .filter(Boolean)
    .some((v) => (v as string).toLowerCase().includes(q));
}

export function entrySnippet(entry: JournalEntry, max = 140): string {
  const base =
    entry.type === "gratitude" && entry.items.length > 0
      ? entry.items.map((i) => `+ ${i}`).join("  ")
      : entry.content;
  const clean = base.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** Most recent first: date, then time (no time = end of list for that day), then creation. */
export function compareEntries(a: JournalEntry, b: JournalEntry): number {
  if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? 1 : -1;
  const at = a.entry_time ?? "";
  const bt = b.entry_time ?? "";
  if (at !== bt) return at < bt ? 1 : -1;
  return a.created_at < b.created_at ? 1 : -1;
}