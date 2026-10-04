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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Habit, HabitCategory, HabitInput, HabitKind, HabitType } from "@/domain/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: HabitCategory[];
  defaultCategoryId: string | null;
  habit: Habit | null;
  onSubmit: (input: HabitInput) => void;
  mode?: "habit" | "activity";
}

const NO_CATEGORY = "__none__";

export function HabitDialog({
  open,
  onOpenChange,
  categories,
  defaultCategoryId,
  habit,
  onSubmit,
  mode = "habit",
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<HabitType>("check");
  const [kind, setKind] = useState<HabitKind>("habit");
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY);
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [more, setMore] = useState(false);

  // Reset only when the dialog opens, never while the user types.
  useEffect(() => {
    if (!open) return;
    setName(habit?.name ?? "");
    setType(habit?.type ?? "check");
    setKind(habit?.kind ?? mode);
    setCategoryId(habit?.category_id ?? defaultCategoryId ?? NO_CATEGORY);
    setTarget(habit?.target != null ? String(habit.target) : "");
    setUnit(habit?.unit ?? "");
    setMore(Boolean(habit?.target || habit?.unit));
  }, [open, habit, defaultCategoryId, mode]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const parsedTarget = Number(target.replace(",", "."));
    onSubmit({
      name: name.trim(),
      type,
      kind: mode === "activity" ? "activity" : kind,
      category_id: categoryId === NO_CATEGORY ? null : categoryId,
      target: type === "counter" && Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : null,
      unit: type === "counter" && unit.trim() ? unit.trim() : null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {habit
              ? habit.kind === "activity" ? "Editar actividad" : "Editar hábito"
              : mode === "activity" ? "Nueva actividad" : "Nuevo hábito"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Nombre</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Caminar"
              autoFocus
              required
            />
          </div>

          {mode === "habit" && (
          <div className="space-y-1.5">
            <Label>¿Qué es?</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["habit", "activity"] as HabitKind[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setKind(option)}
                  className={
                    "rounded-xl border px-3 py-2 text-sm font-medium transition-colors " +
                    (kind === option
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent")
                  }
                >
                  {option === "habit" ? "Hábito" : "Actividad"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              El hábito mide constancia día a día; la actividad solo se registra cuando ocurre.
            </p>
          </div>
          )}

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as HabitType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="check">Check (hecho / no hecho)</SelectItem>
                <SelectItem value="counter">Contador (cantidad o tiempo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!more && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setMore(true)}
            >
              Más opciones
            </button>
          )}

          {more && (
            <div className="space-y-4 rounded-xl border border-border p-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "counter" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="habit-target">Meta</Label>
                    <Input
                      id="habit-target"
                      inputMode="decimal"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="habit-unit">Unidad</Label>
                    <Input
                      id="habit-unit"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="vasos, minutos..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="submit">{habit ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}