import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/date";
import { HelpTip } from "@/components/common/HelpTip";
import {
  FREQUENCY_LABEL,
  REMIND_OFFSETS,
  DOSE_UNITS,
  durationDays,
  estimatedEndDate,
  normalizeTimes,
  type Medication,
  type MedicationFrequency,
  type MedicationInput,
} from "@/domain/health";

const empty = (): MedicationInput => ({
  name: "",
  dose: 1,
  unit: "Tableta",
  frequency: "daily",
  times: ["08:00"],
  start_date: todayISO(),
  end_date: null,
  active: true,
  notes: null,
  remind_offset_min: 0,
  total_quantity: null,
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
  pending: boolean;
  onSubmit: (input: MedicationInput) => Promise<void>;
}

export function MedicationDialog({ open, onOpenChange, medication, pending, onSubmit }: Props) {
  const [form, setForm] = useState<MedicationInput>(empty);

  useEffect(() => {
    if (!open) return;
    setForm(
      medication
        ? {
            name: medication.name,
            dose: medication.dose,
            unit: medication.unit,
            frequency: medication.frequency,
            times: medication.times.length ? medication.times : ["08:00"],
            start_date: medication.start_date,
            end_date: medication.end_date,
            active: medication.active,
            notes: medication.notes,
            remind_offset_min: medication.remind_offset_min,
            total_quantity: medication.total_quantity,
          }
        : empty(),
    );
  }, [open, medication]);

  const set = <K extends keyof MedicationInput>(k: K, v: MedicationInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const times = normalizeTimes(form.times);
  const valid = form.name.trim().length > 0 && times.length > 0 && (!form.end_date || form.end_date >= form.start_date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{medication ? "Editar medicamento" : "Nuevo medicamento"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            await onSubmit({ ...form, times });
            onOpenChange(false);
          }}
        >
          <div className="space-y-1.5" data-help="medication-name">
            <Label htmlFor="med-name">Nombre</Label>
            <Input id="med-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. Nifedipina" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="med-dose">Dosis</Label>
              <Input
                id="med-dose"
                inputMode="decimal"
                value={form.dose ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  set("dose", e.target.value === "" || Number.isNaN(n) ? null : n);
                }}
                placeholder="30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="med-unit">Unidad</Label>
              <select id="med-unit" className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.unit ?? "Tableta"} onChange={(e) => set("unit", e.target.value)}>
                {DOSE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="med-total" className="flex items-center gap-1">Cantidad total <HelpTip helpKey="medication.total" /></Label>
            <div className="flex items-center gap-2">
              <Input id="med-total" inputMode="decimal" className="w-28" value={form.total_quantity ?? ""} placeholder="60"
                onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); set("total_quantity", e.target.value === "" || Number.isNaN(n) ? null : n); }} />
              <span className="text-sm text-muted-foreground">{form.unit ?? ""}</span>
            </div>
            {(() => { const d = durationDays({ ...form, times }); const end = estimatedEndDate({ ...form, times }); return d ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="med-duration">Alcanza para {d} días · hasta {end} <HelpTip helpKey="medication.duration" /></p>
            ) : null; })()}
          </div>

          <div className="space-y-1.5" data-help="medication-frequency">
            <Label>Frecuencia</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FREQUENCY_LABEL) as MedicationFrequency[]).map((f) => (
                <Button key={f} type="button" variant={form.frequency === f ? "default" : "outline"} onClick={() => set("frequency", f)}>
                  {FREQUENCY_LABEL[f]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5" data-help="medication-times">
            <Label>Horarios</Label>
            <div className="space-y-2">
              {form.times.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="time"
                    aria-label={`Horario ${i + 1}`}
                    value={t}
                    onChange={(e) => set("times", form.times.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  {form.times.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" aria-label="Quitar horario" onClick={() => set("times", form.times.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => set("times", [...form.times, "20:00"])}>
                <Plus className="h-4 w-4" /> Agregar horario
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="med-start">Inicio</Label>
              <Input id="med-start" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value || todayISO())} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="med-end">Fin (opcional)</Label>
              <Input id="med-end" type="date" value={form.end_date ?? ""} onChange={(e) => set("end_date", e.target.value || null)} />
            </div>
          </div>

          <div className="space-y-1.5" data-help="medication-reminder">
            <Label>Aviso</Label>
            <div className="flex flex-wrap gap-2">
              {REMIND_OFFSETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set("remind_offset_min", m)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    form.remind_offset_min === m ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                  )}
                >
                  {m === 0 ? "A la hora" : `${m} min antes`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="med-notes">Notas (opcional)</Label>
            <Textarea id="med-notes" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
            <Label htmlFor="med-active">Activo</Label>
            <Switch id="med-active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!valid || pending}>
              {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}