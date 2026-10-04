import { useEffect, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker, IconPicker } from "@/components/finance/Pickers";
import { AmountInput } from "@/components/finance/AmountInput";
import type { AccountInput, FinanceAccount } from "@/domain/finance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: FinanceAccount | null;
  onSubmit: (input: AccountInput) => void | Promise<void>;
  pending?: boolean;
}

const EMPTY: AccountInput = {
  name: "",
  icon: "Wallet",
  color: "#38bdf8",
  note: null,
  initial_balance: 0,
  include_in_total: true,
};

export function AccountDialog({ open, onOpenChange, account, onSubmit, pending }: Props) {
  const [form, setForm] = useState<AccountInput>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      account
        ? {
            name: account.name,
            icon: account.icon,
            color: account.color,
            note: account.note,
            initial_balance: Number(account.initial_balance ?? 0),
            include_in_total: account.include_in_total,
          }
        : EMPTY,
    );
  }, [open, account]);


  const submit = async () => {
    if (!form.name.trim()) return;
    await onSubmit({ ...form, name: form.name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <div className="flex gap-2">
              <IconPicker
                value={form.icon}
                color={form.color}
                onChange={(icon) => setForm((prev) => ({ ...prev, icon }))}
              />
              <Input
                autoFocus
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nequi, Daviplata, Bancolombia..."
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker value={form.color} onChange={(color) => setForm((p) => ({ ...p, color }))} />
          </div>

          <div className="space-y-2">
            <Label>Nota</Label>
            <Textarea
              value={form.note ?? ""}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, note: event.target.value || null }))
              }
              placeholder="Opcional"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Saldo inicial</Label>
            <AmountInput
              value={form.initial_balance}
              onChange={(initial_balance) => setForm((prev) => ({ ...prev, initial_balance }))}
            />
            <p className="text-xs text-muted-foreground">
              El dinero que ya tenías en esta cuenta antes de empezar a registrar movimientos.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Incluir en balance total</p>
              <p className="text-xs text-muted-foreground">
                Si lo desactivas, la cuenta conserva sus movimientos pero no suma al total.
              </p>
            </div>
            <Switch
              checked={form.include_in_total}
              onCheckedChange={(include_in_total) =>
                setForm((prev) => ({ ...prev, include_in_total }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!form.name.trim() || pending}>
            {account ? "Guardar" : "Crear cuenta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}