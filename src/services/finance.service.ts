import { supabase } from "@/integrations/supabase/client";
import type { BalanceRow } from "@/lib/finance-math";
import type {
  AccountInput,
  CategoryInput,
  FinanceAccount,
  FinanceCategory,
  FinanceSettings,
  FinanceTransaction,
  TransactionInput,
  TransactionType,
} from "@/domain/finance";

const PHOTO_BUCKET = "finance-photos";

/** "  Comida " and "COMIDA" must be treated as the same category name. */
export function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Data-level guard for the tithe rules:
 * - only INCOME can count towards the tithe base;
 * - only an EXPENSE can be an actual tithe payment.
 * The UI hides the fields, but the truth is enforced here too.
 */
function normalizeTitheFlags<T extends Partial<TransactionInput>>(input: T): T {
  if (!input.type) return input;
  return {
    ...input,
    counts_for_tithe: input.type === "income" ? Boolean(input.counts_for_tithe) : false,
    is_tithe_payment: input.type === "expense" ? Boolean(input.is_tithe_payment) : false,
  };
}


async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("No hay sesión activa");
  return data.user.id;
}

export interface TransactionFilters {
  from: string;
  to: string;
  type?: TransactionType | "all";
  accountId?: string | "all";
  search?: string;
}

/**
 * Finance data service. Every read/write is scoped to the authenticated user;
 * RLS enforces the same rule server-side.
 */
export const financeService = {
  /* ---------------------------------------------------------------- accounts */
  async listAccounts(): Promise<FinanceAccount[]> {
    const { data, error } = await supabase
      .from("finance_accounts")
      .select("*")
      .eq("archived", false)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as FinanceAccount[];
  },

  /**
   * Guarantees the user always has at least one usable account.
   * New users get "Efectivo" from the database trigger; this is the safety net.
   */
  async ensureDefaultAccount(): Promise<FinanceAccount[]> {
    const accounts = await financeService.listAccounts();
    if (accounts.length > 0) return accounts;
    const created = await financeService.createAccount(
      {
        name: "Efectivo",
        icon: "Banknote",
        color: "#34d399",
        note: null,
        initial_balance: 0,
        include_in_total: true,
      },
      0,
    );
    return [created];
  },

  async createAccount(input: AccountInput, position: number): Promise<FinanceAccount> {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("finance_accounts")
      .insert({ ...input, position, user_id })
      .select()
      .single();
    if (error) throw error;
    return data as FinanceAccount;
  },

  async updateAccount(id: string, patch: Partial<AccountInput & { position: number }>) {
    const { error } = await supabase.from("finance_accounts").update(patch).eq("id", id);
    if (error) throw error;
  },

  async deleteAccount(id: string) {
    const { error } = await supabase.from("finance_accounts").delete().eq("id", id);
    if (error) throw error;
  },

  async reorderAccounts(ordered: { id: string; position: number }[]) {
    for (const { id, position } of ordered) {
      const { error } = await supabase.from("finance_accounts").update({ position }).eq("id", id);
      if (error) throw error;
    }
  },

  /* -------------------------------------------------------------- categories */
  async listCategories(): Promise<FinanceCategory[]> {
    const { data, error } = await supabase
      .from("finance_categories")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as FinanceCategory[];
  },

  /**
   * Creates a category, reusing an equivalent one when it already exists.
   * Equivalence = same user (RLS) + same kind + same normalized name.
   */
  async createCategory(
    input: CategoryInput,
    position: number,
  ): Promise<{ category: FinanceCategory; reused: boolean }> {
    const user_id = await currentUserId();
    const existing = await financeService.listCategories();
    const sameName = existing.filter(
      (category) => normalizeName(category.name) === normalizeName(input.name),
    );

    // Exact scope already exists -> reuse (reactivate if hidden).
    const exact = sameName.find(
      (category) => category.kind === input.kind || category.kind === "both",
    );
    if (exact) {
      if (!exact.active) {
        await financeService.updateCategory(exact.id, { active: true });
        return { category: { ...exact, active: true }, reused: true };
      }
      return { category: exact, reused: true };
    }

    // Same name in the opposite scope -> widen it to "both" instead of duplicating.
    const opposite = sameName.find((category) => category.kind !== input.kind);
    if (opposite) {
      await financeService.updateCategory(opposite.id, { kind: "both", active: true });
      return { category: { ...opposite, kind: "both", active: true }, reused: true };
    }

    const { data, error } = await supabase
      .from("finance_categories")
      .insert({ ...input, name: input.name.trim(), position, user_id })
      .select()
      .single();
    if (error) throw error;
    return { category: data as FinanceCategory, reused: false };
  },

  async updateCategory(
    id: string,
    patch: Partial<CategoryInput & { position: number; active: boolean }>,
  ) {
    if (patch.name !== undefined || patch.kind !== undefined) {
      const existing = await financeService.listCategories();
      const current = existing.find((category) => category.id === id);
      const kind = patch.kind ?? current?.kind;
      const name = patch.name ?? current?.name ?? "";
      const clash = existing.find(
        (category) =>
          category.id !== id &&
          normalizeName(category.name) === normalizeName(name) &&
          (category.kind === kind || category.kind === "both" || kind === "both"),
      );
      if (clash) throw new Error(`Ya existe la categoría "${clash.name}" en ese ámbito.`);
      if (patch.name !== undefined) patch = { ...patch, name: patch.name.trim() };
    }
    const { error } = await supabase.from("finance_categories").update(patch).eq("id", id);
    if (error) throw error;
  },


  async deleteCategory(id: string) {
    const { error } = await supabase.from("finance_categories").delete().eq("id", id);
    if (error) throw error;
  },

  async reorderCategories(ordered: { id: string; position: number }[]) {
    for (const { id, position } of ordered) {
      const { error } = await supabase.from("finance_categories").update({ position }).eq("id", id);
      if (error) throw error;
    }
  },

  /* ------------------------------------------------------------ transactions */
  async listTransactions(filters: TransactionFilters): Promise<FinanceTransaction[]> {
    let query = supabase
      .from("finance_transactions")
      .select("*")
      .gte("occurred_on", filters.from)
      .lte("occurred_on", filters.to);

    if (filters.type && filters.type !== "all") query = query.eq("type", filters.type);
    if (filters.accountId && filters.accountId !== "all") {
      query = query.eq("account_id", filters.accountId);
    }
    if (filters.search?.trim()) query = query.ilike("note", `%${filters.search.trim()}%`);

    const { data, error } = await query
      .order("occurred_on", { ascending: false })
      .order("occurred_time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as FinanceTransaction[];
  },

  /** Minimal projection used to derive account balances from the ledger. */
  async listBalanceRows(): Promise<BalanceRow[]> {
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("account_id, transfer_account_id, type, amount");
    if (error) throw error;
    return (data ?? []) as BalanceRow[];
  },

  async createTransaction(input: TransactionInput): Promise<FinanceTransaction> {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("finance_transactions")
      .insert({ ...normalizeTitheFlags(input), user_id })
      .select()
      .single();
    if (error) throw error;
    return data as FinanceTransaction;
  },

  async updateTransaction(id: string, patch: Partial<TransactionInput>) {
    const { error } = await supabase
      .from("finance_transactions")
      .update(normalizeTitheFlags(patch))
      .eq("id", id);
    if (error) throw error;
  },


  async deleteTransaction(id: string) {
    const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
    if (error) throw error;
  },

  /* ----------------------------------------------------------------- settings */
  async getSettings(): Promise<FinanceSettings> {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("finance_settings")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as FinanceSettings;

    const { data: created, error: insertError } = await supabase
      .from("finance_settings")
      .insert({ user_id })
      .select()
      .single();
    if (insertError) throw insertError;
    return created as FinanceSettings;
  },

  async updateSettings(
    patch: Partial<
      Pick<
        FinanceSettings,
        "tithe_percent" | "tithe_basis" | "tithe_custom_note" | "show_money_in_dashboard"
      >
    >,
  ) {
    const user_id = await currentUserId();
    const { error } = await supabase
      .from("finance_settings")
      .update(patch)
      .eq("user_id", user_id);
    if (error) throw error;
  },

  /* -------------------------------------------------------------------- fotos */
  async uploadPhoto(file: File): Promise<string> {
    const user_id = await currentUserId();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user_id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    return path;
  },

  async photoUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  async removePhoto(path: string) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  },
};