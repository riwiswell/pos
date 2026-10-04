import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/common/HelpTip";
import { TITHE_BASIS_HELP } from "@/domain/help";
import { TITHE_BASIS_LABEL, type FinanceSettings, type TitheBasis } from "@/domain/finance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: FinanceSettings;
  pending?: boolean;
  onSubmit: (patch: { tithe_percent: number; tithe_basis: TitheBasis }) => void | Promise<void>;
}

/** Tithe criterion lives in finance_settings; the summary is always derived from it. */
export function TitheSettingsDialog({ open, onOpenChange, settings, pending, onSubmit }: Props) {
  const [percent, setPercent] = useState(String(settings.tithe_percent));
  const [basis, setBasis] = useState<TitheBasis>(settings.tithe_basis);

  useEffect(() => {
    if (!open) return;
    setPercent(String(settings.tithe_percent));
    setBasis(settings.tithe_basis);
  }, [open, settings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Diezmo</DialogTitle>
          <DialogDescription>
            Define el porcentaje y qué ingresos forman la base del cálculo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Porcentaje</Label>
            <Input
              inputMode="decimal"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">Criterio <HelpTip helpKey="tithe.basis" /></Label>
            <div className="space-y-2">
              {(Object.keys(TITHE_BASIS_LABEL) as TitheBasis[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBasis(value)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    basis === value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  <span className="block">{TITHE_BASIS_LABEL[value]}</span>
                  <span className="block text-xs text-muted-foreground">{TITHE_BASIS_HELP[value]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              const parsed = Number(percent.replace(",", "."));
              void onSubmit({
                tithe_percent: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                tithe_basis: basis,
              });
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}