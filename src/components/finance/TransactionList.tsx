import { ArrowLeftRight } from "lucide-react";

import { getIcon } from "@/lib/finance-icons";
import { formatFullDate, formatTime } from "@/lib/period";
import { groupByDay } from "@/lib/finance-math";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { FinanceAccount, FinanceCategory, FinanceTransaction } from "@/domain/finance";

interface Props {
  transactions: FinanceTransaction[];
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  /** Tap a movement to open its detail view. */
  onOpen: (tx: FinanceTransaction) => void;
  /** Privacy mode: amounts are masked but the ledger stays usable. */
  hideAmounts?: boolean;
}

/**
 * Chronological ledger. Days go newest first; inside a day, movements follow the
 * clock time they happened at — never the moment they were typed in.
 */
export function TransactionList({
  transactions,
  accounts,
  categories,
  onOpen,
  hideAmounts = false,
}: Props) {
  const money = (value: number) => (hideAmounts ? "••••" : formatMoney(value));
  const groups = groupByDay(transactions);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const dayTotal = group.items.reduce((sum, tx) => {
          if (tx.type === "transfer") return sum;
          return sum + (tx.type === "income" ? Number(tx.amount) : -Number(tx.amount));
        }, 0);
        return (
          <section key={group.date} className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {formatFullDate(group.date)}
              </h3>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  dayTotal >= 0 ? "text-success" : "text-muted-foreground",
                )}
              >
                {dayTotal >= 0 ? "+" : "−"}
                {money(Math.abs(dayTotal))}
              </span>
            </div>

            <ul className="glass divide-y divide-border/60 overflow-hidden rounded-2xl">
              {group.items.map((tx) => {
                const category = tx.category_id ? categoryById.get(tx.category_id) : undefined;
                const account = tx.account_id ? accountById.get(tx.account_id) : undefined;
                const target = tx.transfer_account_id
                  ? accountById.get(tx.transfer_account_id)
                  : undefined;
                const isTransfer = tx.type === "transfer";
                const Icon = isTransfer
                  ? ArrowLeftRight
                  : getIcon(category?.icon ?? account?.icon ?? "Circle");
                const time = formatTime(tx.occurred_time);
                return (
                  <li key={tx.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(tx)}
                      className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${category?.color ?? account?.color ?? "#64748b"}22` }}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={{ color: category?.color ?? account?.color ?? "#94a3b8" }}
                        />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {isTransfer
                            ? "Transferencia"
                            : (category?.name ??
                              tx.note ??
                              (tx.type === "income" ? "Ingreso" : "Gasto"))}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            isTransfer
                              ? `${account?.name ?? "—"} → ${target?.name ?? "—"}`
                              : account?.name,
                            time,
                            isTransfer ? tx.note : category && tx.note ? tx.note : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            tx.type === "income"
                              ? "text-success"
                              : isTransfer
                                ? "text-muted-foreground"
                                : "text-foreground",
                          )}
                        >
                          {isTransfer ? "" : tx.type === "income" ? "+" : "−"}
                          {money(Number(tx.amount))}
                        </p>
                        {tx.type === "income" && Number(tx.cost_amount) > 0 && (
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            neto {money(Number(tx.amount) - Number(tx.cost_amount))}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}