/**
 * PERSONAL OS — Finanzas domain types.
 *
 * Single source of truth for the finance module. The UI never depends on
 * Supabase row shapes directly.
 */

export type TransactionType = "expense" | "income" | "transfer";
/** Categories only classify money that enters or leaves; transfers never do.
 * "both" makes a category usable for expenses and income alike. */
export type CategoryKind = "expense" | "income" | "both";

/** Does a category apply to a given movement type? */
export function categoryAppliesTo(kind: CategoryKind, type: "expense" | "income") {
  return kind === "both" || kind === type;
}

/** How the tithe base is derived from income. Configured by the user. */
export type TitheBasis = "all_income" | "net_income" | "marked" | "custom";

export interface FinanceAccount {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  note: string | null;
  /** Money already in the account before Personal OS started tracking it. */
  initial_balance: number;
  include_in_total: boolean;
  position: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceCategory {
  id: string;
  user_id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  position: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  cost_amount: number;
  account_id: string | null;
  /** Destination account for transfers. Null for expenses and incomes. */
  transfer_account_id: string | null;
  category_id: string | null;
  /** When it actually happened (YYYY-MM-DD). */
  occurred_on: string;
  /** Optional clock time (HH:MM:SS). Never invented. */
  occurred_time: string | null;
  note: string | null;
  tags: string[];
  /** Storage paths inside the private finance-photos bucket. */
  photos: string[];
  counts_for_tithe: boolean;
  is_tithe_payment: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceSettings {
  user_id: string;
  tithe_percent: number;
  tithe_basis: TitheBasis;
  tithe_custom_note: string | null;
  show_money_in_dashboard: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountInput {
  name: string;
  icon: string;
  color: string;
  note: string | null;
  initial_balance: number;
  include_in_total: boolean;
}

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  cost_amount: number;
  account_id: string | null;
  transfer_account_id: string | null;
  category_id: string | null;
  occurred_on: string;
  occurred_time: string | null;
  note: string | null;
  tags: string[];
  photos: string[];
  counts_for_tithe: boolean;
  is_tithe_payment: boolean;
}

export const TITHE_BASIS_LABEL: Record<TitheBasis, string> = {
  all_income: "Todos los ingresos (bruto)",
  net_income: "Ingresos después de costos (neto)",
  marked: "Solo ingresos marcados (bruto)",
  custom: "Criterio personalizado (marcados, después de costos)",
};

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transferencia",
};