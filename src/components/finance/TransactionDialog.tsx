import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/common/RichTextEditor";
import { AmountInput } from "@/components/finance/AmountInput";
import { CategoryDialog } from "@/components/finance/CategoryDialog";
import { AccountDialog } from "@/components/finance/AccountDialog";
import { formatClock, toISODate } from "@/lib/date";
import { getIcon } from "@/lib/finance-icons";
import { cn } from "@/lib/utils";
import { financeService } from "@/services/finance.service";
import { useFinanceMutations } from "@/hooks/use-finance";
import { TRANSACTION_TYPE_LABEL } from "@/domain/finance";
import { categoryAppliesTo } from "@/domain/finance";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  TransactionInput,
  TransactionType,
} from "@/domain/finance";

const MONTHS_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** "1 sep · 10:24 p. m." — the moment the movement actually happened. */
function whenSummary(iso: string, time: string | null): string {
  const [y, m, d] = iso.split("-").map(Number);
  const day = `${d ?? 1} ${MONTHS_SHORT[(m ?? 1) - 1] ?? ""}`;
  const year = y && y !== new Date().getFullYear() ? ` ${y}` : "";
  if (!time) return `${day}${year}`;
  const [hh, mm] = time.split(":").map(Number);
  const hour = hh ?? 0;
  const suffix = hour < 12 ? "a. m." : "p. m.";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${day}${year} · ${h12}:${String(mm ?? 0).padStart(2, "0")} ${suffix}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Global date — used as the default "when it happened". */
  date: string;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  transaction?: FinanceTransaction | null;
  onSubmit: (input: TransactionInput) => void | Promise<void>;
  pending?: boolean;
}

function emptyInput(date: string, accountId: string | null): TransactionInput {
  return {
    type: "expense",
    amount: 0,
    cost_amount: 0,
    account_id: accountId,
    transfer_account_id: null,
    category_id: null,
    occurred_on: date,
    occurred_time: null,
    note: null,
    tags: [],
    photos: [],
    counts_for_tithe: true,
    is_tithe_payment: false,
  };
}

/**
 * Quick capture: amount + account are enough. Everything else is optional and
 * reachable without leaving the sheet.
 */
export function TransactionDialog({
  open,
  onOpenChange,
  date,
  accounts,
  categories,
  transaction,
  onSubmit,
  pending,
}: Props) {
  const mutations = useFinanceMutations();
  const [form, setForm] = useState<TransactionInput>(() => emptyInput(date, null));
  const [showDetails, setShowDetails] = useState(false);
  const [isNow, setIsNow] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setForm({
        type: transaction.type,
        amount: Number(transaction.amount),
        cost_amount: Number(transaction.cost_amount),
        account_id: transaction.account_id,
        transfer_account_id: transaction.transfer_account_id ?? null,
        category_id: transaction.category_id,
        occurred_on: transaction.occurred_on,
        occurred_time: transaction.occurred_time,
        note: transaction.note,
        tags: transaction.tags ?? [],
        photos: transaction.photos ?? [],
        counts_for_tithe: transaction.counts_for_tithe,
        is_tithe_payment: transaction.is_tithe_payment,
      });
      setShowDetails(true);
      setIsNow(false);
    } else {
      setForm(emptyInput(date, accounts[0]?.id ?? null));
      setShowDetails(false);
      setIsNow(false);
    }
  }, [open, transaction, date, accounts]);

  const visibleCategories = useMemo(
    () => categories.filter(
        (category) =>
          category.active &&
          (form.type === "expense" || form.type === "income") &&
          categoryAppliesTo(category.kind, form.type),
      ),
    [categories, form.type],
  );

  const isTransfer = form.type === "transfer";
  const canSave =
    form.amount > 0 &&
    Boolean(form.account_id) &&
    (!isTransfer ||
      (Boolean(form.transfer_account_id) && form.transfer_account_id !== form.account_id));

  /** "Ahora mismo": stamps the device date AND time as the moment it happened. */
  const applyNow = () => {
    const now = new Date();
    setForm((prev) => ({
      ...prev,
      occurred_on: toISODate(now),
      occurred_time: `${formatClock(now)}:00`,
    }));
    setIsNow(true);
  };

  const whenLabel = useMemo(
    () => whenSummary(form.occurred_on, form.occurred_time),
    [form.occurred_on, form.occurred_time],
  );

  const submit = async () => {
    if (!canSave) return;
    await onSubmit(form);
  };


  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const paths: string[] = [];
      for (const file of Array.from(files)) paths.push(await financeService.uploadPhoto(file));
      setForm((prev) => ({ ...prev, photos: [...prev.photos, ...paths] }));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{transaction ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(["expense", "income", "transfer"] as TransactionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      type,
                      category_id: null,
                      transfer_account_id: type === "transfer" ? prev.transfer_account_id : null,
                      cost_amount: type === "income" ? prev.cost_amount : 0,
                      counts_for_tithe: type === "income" ? prev.counts_for_tithe : false,
                      is_tithe_payment: type === "expense" ? prev.is_tithe_payment : false,
                    }))
                  }
                  className={cn(
                    "rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors",
                    form.type === type
                      ? type === "expense"
                        ? "border-destructive/60 bg-destructive/10 text-destructive"
                        : type === "income"
                          ? "border-success/60 bg-success/10 text-success"
                          : "border-primary/60 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {TRANSACTION_TYPE_LABEL[type]}
                </button>
              ))}
            </div>

            <AmountInput
              autoFocus
              value={form.amount}
              onChange={(amount) => setForm((prev) => ({ ...prev, amount }))}
              onEnter={() => void submit()}
            />

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {isTransfer ? "Cuenta origen" : "Cuenta"}
              </Label>
              <div className="flex flex-wrap gap-2">
                {accounts.map((account) => {
                  const Icon = getIcon(account.icon);
                  const selected = form.account_id === account.id;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, account_id: account.id }))}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: account.color }} />
                      {account.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setNewAccountOpen(true)}
                  className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> Cuenta
                </button>
              </div>
            </div>

            {isTransfer && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Cuenta destino
                </Label>
                <div className="flex flex-wrap gap-2">
                  {accounts
                    .filter((account) => account.id !== form.account_id)
                    .map((account) => {
                      const Icon = getIcon(account.icon);
                      const selected = form.transfer_account_id === account.id;
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({ ...prev, transfer_account_id: account.id }))
                          }
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                            selected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground hover:bg-accent",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color: account.color }} />
                          {account.name}
                        </button>
                      );
                    })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Una transferencia mueve dinero entre tus cuentas: no es gasto ni ingreso.
                </p>
              </div>
            )}

            {!isTransfer && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Categoría <span className="normal-case tracking-normal">(opcional)</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {visibleCategories.map((category) => {
                  const Icon = getIcon(category.icon);
                  const selected = form.category_id === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          category_id: selected ? null : category.id,
                        }))
                      }
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: category.color }} />
                      {category.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setNewCategoryOpen(true)}
                  className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> Categoría
                </button>
              </div>
            </div>
            )}

            {/* Cuándo ocurrió: siempre visible, nunca detrás de "Más detalles". */}
            <div className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Cuándo ocurrió
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant={isNow ? "default" : "outline"}
                  className="h-8 gap-1 rounded-full text-xs"
                  onClick={applyNow}
                >
                  <Clock className="h-3.5 w-3.5" /> Ahora mismo
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha</Label>
                  <Input
                    type="date"
                    value={form.occurred_on}
                    onChange={(event) =>
                      {
                        setIsNow(false);
                        setForm((prev) => ({ ...prev, occurred_on: event.target.value }));
                      }
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hora (opcional)</Label>
                  <Input
                    type="time"
                    value={form.occurred_time?.slice(0, 5) ?? ""}
                    onChange={(event) =>
                      {
                        setIsNow(false);
                        setForm((prev) => ({
                          ...prev,
                          occurred_time: event.target.value ? `${event.target.value}:00` : null,
                        }));
                      }
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {whenLabel}
                {form.occurred_time ? "" : " · sin hora"}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Nota <span className="normal-case tracking-normal">(opcional)</span>
              </Label>
              <RichTextEditor value={form.note ?? ""} onChange={(value) => setForm((prev) => ({ ...prev, note: value || null }))} placeholder="¿En qué fue?" />
            </div>

            {/* El diezmo nunca se infiere del nombre de la categoría: se marca aquí. */}
            {form.type === "income" && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <Label className="text-sm font-normal">
                  Este ingreso cuenta para el diezmo
                </Label>
                <Switch
                  checked={form.counts_for_tithe}
                  onCheckedChange={(counts_for_tithe) =>
                    setForm((prev) => ({ ...prev, counts_for_tithe }))
                  }
                />
              </div>
            )}
            {form.type === "expense" && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <div className="min-w-0">
                  <Label className="text-sm font-normal">
                    Este movimiento es pago de diezmo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Descuenta de la cuenta y reduce el diezmo pendiente.
                  </p>
                </div>
                <Switch
                  checked={form.is_tithe_payment}
                  onCheckedChange={(is_tithe_payment) =>
                    setForm((prev) => ({ ...prev, is_tithe_payment }))
                  }
                />
              </div>
            )}

            {!showDetails && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowDetails(true)}
              >
                Más detalles
              </Button>
            )}

            {showDetails && (
              <div className="space-y-4 rounded-xl border border-border p-3">
                {form.type === "income" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Costo asociado (opcional)</Label>
                    <AmountInput
                      value={form.cost_amount}
                      onChange={(cost_amount) => setForm((prev) => ({ ...prev, cost_amount }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Se usa para calcular la ganancia real del ingreso.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Fotos</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {form.photos.map((path) => (
                      <span
                        key={path}
                        className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                      >
                        {path.split("/").pop()?.slice(0, 8)}
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              photos: prev.photos.filter((item) => item !== path),
                            }))
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adjuntar"}
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(event) => void uploadPhotos(event.target.files)}
                    />
                  </div>
                </div>
              </div>
            )}

          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()} disabled={!canSave || pending}>
              <Check className="mr-1 h-4 w-4" />
              {transaction ? "Guardar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoryDialog
        open={newCategoryOpen}
        onOpenChange={setNewCategoryOpen}
        defaultKind={form.type === "income" ? "income" : "expense"}
        pending={mutations.createCategory.isPending}
        onSubmit={async (input) => {
          const created = await mutations.createCategory.mutateAsync({
            input,
            position: categories.length,
          });
          setForm((prev) => ({ ...prev, category_id: created.category.id }));
          setNewCategoryOpen(false);
        }}
      />

      <AccountDialog
        open={newAccountOpen}
        onOpenChange={setNewAccountOpen}
        pending={mutations.createAccount.isPending}
        onSubmit={async (input) => {
          const created = await mutations.createAccount.mutateAsync({
            input,
            position: accounts.length,
          });
          setForm((prev) => ({ ...prev, account_id: created.id }));
          setNewAccountOpen(false);
        }}
      />
    </>
  );
}