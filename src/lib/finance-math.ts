import type { FinanceAccount, FinanceSettings, FinanceTransaction } from "@/domain/finance";

/**
 * Derived finance calculations. Record once, calculate always — nothing here is
 * stored twice in the database.
 */

export type BalanceRow = Pick<
  FinanceTransaction,
  "account_id" | "transfer_account_id" | "type" | "amount"
>;

/**
 * Ledger movement per account. Transfers move money between accounts, so they
 * subtract from the origin and add to the destination.
 */
export function accountBalances(rows: BalanceRow[]): Map<string, number> {
  const map = new Map<string, number>();
  const add = (id: string | null, delta: number) => {
    if (!id) return;
    map.set(id, (map.get(id) ?? 0) + delta);
  };
  for (const row of rows) {
    const amount = Number(row.amount);
    if (row.type === "transfer") {
      add(row.account_id, -amount);
      add(row.transfer_account_id, amount);
    } else {
      add(row.account_id, row.type === "income" ? amount : -amount);
    }
  }
  return map;
}

/** Real balance of one account: initial balance + ledger movement. */
export function balanceOf(account: FinanceAccount, balances: Map<string, number>): number {
  return Number(account.initial_balance ?? 0) + (balances.get(account.id) ?? 0);
}

export function totalBalance(accounts: FinanceAccount[], balances: Map<string, number>): number {
  return accounts
    .filter((account) => account.include_in_total)
    .reduce((sum, account) => sum + balanceOf(account, balances), 0);
}

/** Chronological sort key: movement date/time first, registration time last. */
function sortKey(tx: FinanceTransaction): [string, string, string] {
  return [tx.occurred_on, tx.occurred_time ?? "", tx.created_at];
}

/** Newest movement first, ordered by when it HAPPENED. */
export function sortByOccurrenceDesc(list: FinanceTransaction[]): FinanceTransaction[] {
  return [...list].sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    for (let i = 0; i < 3; i += 1) {
      const av = ka[i] as string;
      const bv = kb[i] as string;
      if (av !== bv) return av < bv ? 1 : -1;
    }
    return 0;
  });
}

/** Oldest first within a day: 3:00 p. m. before 8:00 p. m. */
export function sortByOccurrenceAsc(list: FinanceTransaction[]): FinanceTransaction[] {
  return sortByOccurrenceDesc(list).reverse();
}

export interface DayGroup {
  date: string;
  items: FinanceTransaction[];
}

/** Groups by day (newest day first), items ascending by clock time inside the day. */
export function groupByDay(list: FinanceTransaction[]): DayGroup[] {
  const map = new Map<string, FinanceTransaction[]>();
  for (const tx of list) {
    const bucket = map.get(tx.occurred_on);
    if (bucket) bucket.push(tx);
    else map.set(tx.occurred_on, [tx]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, items: sortByOccurrenceAsc(items) }));
}

export function sumBy(list: FinanceTransaction[], type: "expense" | "income"): number {
  return list
    .filter((tx) => tx.type === type)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
}

export function sumCosts(list: FinanceTransaction[]): number {
  return list
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + Number(tx.cost_amount), 0);
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  color: string;
  total: number;
}

export function byCategory(
  list: FinanceTransaction[],
  type: "expense" | "income",
  names: Map<string, { name: string; color: string }>,
): CategorySlice[] {
  const map = new Map<string, number>();
  for (const tx of list) {
    if (tx.type !== type) continue;
    const key = tx.category_id ?? "__none__";
    map.set(key, (map.get(key) ?? 0) + Number(tx.amount));
  }
  return [...map.entries()]
    .map(([key, total]) => {
      const meta = key === "__none__" ? undefined : names.get(key);
      return {
        categoryId: key === "__none__" ? null : key,
        name: meta?.name ?? "Sin categoría",
        color: meta?.color ?? "#64748b",
        total,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface DailyPoint {
  date: string;
  label: string;
  expense: number;
  income: number;
}

/** Expense/income totals per day inside the selected period, oldest first. */
export function dailySeries(list: FinanceTransaction[]): DailyPoint[] {
  const map = new Map<string, { expense: number; income: number }>();
  for (const tx of list) {
    if (tx.type === "transfer") continue;
    const bucket = map.get(tx.occurred_on) ?? { expense: 0, income: 0 };
    bucket[tx.type] += Number(tx.amount);
    map.set(tx.occurred_on, bucket);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, totals]) => ({
      date,
      label: date.slice(8, 10) + "/" + date.slice(5, 7),
      ...totals,
    }));
}

export interface TitheSummary {
  base: number;
  percent: number;
  calculated: number;
  paid: number;
  pending: number;
}

/** Tithe is never assumed — the base follows the user's configured criterion. */
export function titheSummary(
  list: FinanceTransaction[],
  settings: Pick<FinanceSettings, "tithe_basis" | "tithe_percent">,
): TitheSummary {
  const incomes = list.filter((tx) => tx.type === "income");
  let base = 0;
  switch (settings.tithe_basis) {
    case "all_income":
      base = incomes.reduce((sum, tx) => sum + Number(tx.amount), 0);
      break;
    case "net_income":
      base = incomes.reduce((sum, tx) => sum + Number(tx.amount) - Number(tx.cost_amount), 0);
      break;
    case "marked":
      base = incomes
        .filter((tx) => tx.counts_for_tithe)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      break;
    case "custom":
      base = incomes
        .filter((tx) => tx.counts_for_tithe)
        .reduce((sum, tx) => sum + Number(tx.amount) - Number(tx.cost_amount), 0);
      break;
  }
  base = Math.max(0, base);
  const percent = Number(settings.tithe_percent);
  const calculated = (base * percent) / 100;
  const paid = list
    .filter((tx) => tx.is_tithe_payment && tx.type === "expense")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  return { base, percent, calculated, paid, pending: Math.max(0, calculated - paid) };
}

export interface TitheLedger {
  percent: number;
  /** Net carried from before the period: >0 pending owed, <0 credit in favor. */
  opening: number;
  generated: number;
  paid: number;
  /** Opening pending + generated (what is owed before payments). */
  obligation: number;
  pending: number;
  credit: number;
}

/**
 * Running tithe balance. Everything generated minus everything paid up to the
 * period end, so pending and credit carry across months and are never lost.
 */
export function titheLedger(
  history: FinanceTransaction[],
  settings: Pick<FinanceSettings, "tithe_basis" | "tithe_percent">,
  periodStart: string,
  periodEnd: string,
): TitheLedger {
  const upTo = history.filter((tx) => tx.occurred_on <= periodEnd);
  const before = upTo.filter((tx) => tx.occurred_on < periodStart);
  const inside = upTo.filter((tx) => tx.occurred_on >= periodStart);
  const b = titheSummary(before, settings);
  const i = titheSummary(inside, settings);
  const opening = b.calculated - b.paid;
  const closing = opening + i.calculated - i.paid;
  return {
    percent: i.percent,
    opening,
    generated: i.calculated,
    paid: i.paid,
    obligation: Math.max(0, opening + i.calculated),
    pending: Math.max(0, closing),
    credit: Math.max(0, -closing),
  };
}