import { ArrowLeftRight, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhotoStrip } from "@/components/finance/PhotoStrip";
import { getIcon } from "@/lib/finance-icons";
import { formatFullDate, formatTime } from "@/lib/period";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { TRANSACTION_TYPE_LABEL } from "@/domain/finance";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
} from "@/domain/finance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: FinanceTransaction | null;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  hideAmounts?: boolean;
  onEdit: (tx: FinanceTransaction) => void;
  onDelete: (tx: FinanceTransaction) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

/**
 * Read-only view of one movement. Editing and deleting happen from here via
 * the existing TransactionDialog and ConfirmDialog — nothing is duplicated.
 */
export function TransactionDetail({
  open,
  onOpenChange,
  transaction,
  accounts,
  categories,
  hideAmounts = false,
  onEdit,
  onDelete,
}: Props) {
  if (!transaction) return null;

  const account = accounts.find((item) => item.id === transaction.account_id);
  const target = accounts.find((item) => item.id === transaction.transfer_account_id);
  const category = categories.find((item) => item.id === transaction.category_id);
  const isTransfer = transaction.type === "transfer";
  const money = (value: number) => (hideAmounts ? "••••" : formatMoney(value));
  const Icon = isTransfer
    ? ArrowLeftRight
    : getIcon(category?.icon ?? account?.icon ?? "Circle");
  const color = category?.color ?? account?.color ?? "#94a3b8";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: `${color}22` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </span>
            <span>{TRANSACTION_TYPE_LABEL[transaction.type]}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p
            className={cn(
              "text-center text-3xl font-semibold tabular-nums",
              transaction.type === "income"
                ? "text-success"
                : isTransfer
                  ? "text-muted-foreground"
                  : "text-foreground",
            )}
          >
            {isTransfer ? "" : transaction.type === "income" ? "+" : "−"}
            {money(Number(transaction.amount))}
          </p>

          <div className="space-y-2.5 rounded-xl border border-border p-3">
            {isTransfer ? (
              <>
                <Row label="Cuenta origen" value={account?.name ?? "—"} />
                <Row label="Cuenta destino" value={target?.name ?? "—"} />
              </>
            ) : (
              <>
                <Row label="Cuenta" value={account?.name ?? "—"} />
                {category && <Row label="Categoría" value={category.name} />}
              </>
            )}
            <Row label="Fecha" value={formatFullDate(transaction.occurred_on)} />
            <Row label="Hora" value={formatTime(transaction.occurred_time) ?? "Sin hora"} />
            {transaction.type === "income" && Number(transaction.cost_amount) > 0 && (
              <Row
                label="Costo asociado"
                value={`${money(Number(transaction.cost_amount))} · neto ${money(
                  Number(transaction.amount) - Number(transaction.cost_amount),
                )}`}
              />
            )}
            {transaction.type === "expense" && transaction.is_tithe_payment && (
              <Row label="Diezmo" value="Pago de diezmo" />
            )}
            {transaction.type === "income" && !transaction.counts_for_tithe && (
              <Row label="Diezmo" value="No cuenta para el diezmo" />
            )}
          </div>

          {transaction.tags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Etiquetas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {transaction.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2.5 py-1 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {transaction.note && (
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Nota</p>
              <p className="whitespace-pre-wrap text-sm">{transaction.note}</p>
            </div>
          )}

          <PhotoStrip paths={transaction.photos ?? []} />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="gap-1 text-destructive hover:text-destructive"
            onClick={() => {
              onOpenChange(false);
              onDelete(transaction);
            }}
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
          <Button
            className="gap-1"
            onClick={() => {
              onOpenChange(false);
              onEdit(transaction);
            }}
          >
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}