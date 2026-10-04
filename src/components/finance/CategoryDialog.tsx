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
import { ColorPicker, IconPicker } from "@/components/finance/Pickers";
import { cn } from "@/lib/utils";
import type { CategoryInput, CategoryKind, FinanceCategory } from "@/domain/finance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: FinanceCategory | null;
  defaultKind?: CategoryKind;
  defaultName?: string;
  onSubmit: (input: CategoryInput) => void | Promise<void>;
  pending?: boolean;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  defaultKind = "expense",
  defaultName = "",
  onSubmit,
  pending,
}: Props) {
  const [form, setForm] = useState<CategoryInput>({
    name: defaultName,
    kind: defaultKind,
    icon: "Tag",
    color: "#fb923c",
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      category
        ? {
            name: category.name,
            kind: category.kind,
            icon: category.icon,
            color: category.color,
          }
        : { name: defaultName, kind: defaultKind, icon: "Tag", color: "#fb923c" },
    );
  }, [open, category, defaultName, defaultKind]);

  const submit = async () => {
    if (!form.name.trim()) return;
    await onSubmit({ ...form, name: form.name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["expense", "income", "both"] as CategoryKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, kind }))}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  form.kind === kind
                    ? kind === "expense"
                      ? "border-destructive/60 bg-destructive/10 text-destructive"
                      : kind === "income"
                        ? "border-success/60 bg-success/10 text-success"
                        : "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {kind === "expense" ? "Gastos" : kind === "income" ? "Ingresos" : "Ambos"}
              </button>
            ))}
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            «Ambos» deja la categoría disponible en gastos e ingresos sin duplicarla.
          </p>


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
                placeholder="Comida, Transporte, Salario..."
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker value={form.color} onChange={(color) => setForm((p) => ({ ...p, color }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!form.name.trim() || pending}>
            {category ? "Guardar" : "Crear categoría"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}