import { useEffect, useMemo, useState } from "react";
import { Check, Crosshair, ListTodo, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDailyFocus, useDailyFocusMutations } from "@/hooks/use-focus";
import { useHabits } from "@/hooks/use-habits";
import { usePlannerItems } from "@/hooks/use-planner";
import type { DailyFocus } from "@/domain/focus";
import type { PlannerItem } from "@/domain/planner";
import type { Habit } from "@/domain/types";
import { cn } from "@/lib/utils";
import { shortTime } from "@/domain/planner";

type Source = DailyFocus["source"];

interface Props {
  date: string;
}

function focusLabel(focus: DailyFocus | null, habits: Habit[], plannerItems: PlannerItem[]) {
  if (!focus) return null;
  if (focus.source === "free") return focus.text?.trim() || "Enfoque libre";
  if (focus.source === "habit") return habits.find((habit) => habit.id === focus.habit_id)?.name ?? focus.text ?? "Hábito";
  const item = plannerItems.find((entry) => entry.id === focus.planner_item_id);
  return item ? (item.start_time ? `${shortTime(item.start_time)} · ${item.title}` : item.title) : focus.text ?? "Actividad del planeador";
}

export function DailyFocusPicker({ date }: Props) {
  const focusQuery = useDailyFocus(date);
  const habitsQuery = useHabits();
  const plannerQuery = usePlannerItems(date);
  const mutations = useDailyFocusMutations(date);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source>("habit");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");

  const habits = useMemo(
    () => (habitsQuery.data ?? []).filter((item) => item.kind === "habit"),
    [habitsQuery.data],
  );
  const plannerItems = useMemo(
    () => (plannerQuery.data ?? []).filter((item) => item.status !== "done"),
    [plannerQuery.data],
  );
  const current = focusQuery.data ?? null;
  const currentLabel = focusLabel(current, habits, plannerItems);

  useEffect(() => {
    if (!open) return;
    setSource(current?.source ?? "habit");
    setSelectedId(
      current?.source === "habit"
        ? current.habit_id
        : current?.source === "planner"
          ? current.planner_item_id
          : null,
    );
    setText(current?.source === "free" ? current.text ?? "" : "");
  }, [open, current]);

  function chooseSource(next: Source) {
    setSource(next);
    setSelectedId(null);
  }

  async function save() {
    if (source === "habit" && !selectedId) return;
    if (source === "planner" && !selectedId) return;
    if (source === "free" && !text.trim()) return;

    await mutations.setFocus.mutateAsync({
      focus_date: date,
      source,
      habit_id: source === "habit" ? selectedId : null,
      planner_item_id: source === "planner" ? selectedId : null,
      text: source === "free" ? text.trim() : null,
    });
    setOpen(false);
  }

  async function clear() {
    await mutations.clearFocus.mutateAsync();
    setOpen(false);
  }

  return (
    <>
      <section className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Crosshair className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Enfoque del día</h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {current ? "Cambiar" : "Elegir enfoque"}
          </Button>
        </div>

        {currentLabel ? (
          <p className="mt-3 text-base font-medium">{currentLabel}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Elige una sola prioridad para hoy. Puede ser un hábito, algo del Planeador o una frase libre.
          </p>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enfoque del {date}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2">
            {([
              ["habit", "Hábito", Target],
              ["planner", "Planeador", ListTodo],
              ["free", "Libre", Crosshair],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => chooseSource(key)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  source === key
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="mt-1 block text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>

          {source === "habit" && (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
              {habits.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No tienes hábitos disponibles.</p>
              ) : (
                habits.map((habit) => (
                  <button
                    key={habit.id}
                    type="button"
                    onClick={() => setSelectedId(habit.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left",
                      selectedId === habit.id ? "bg-primary/10 text-foreground" : "hover:bg-accent",
                    )}
                  >
                    <span>{habit.name}</span>
                    {selectedId === habit.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))
              )}
            </div>
          )}

          {source === "planner" && (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
              {plannerItems.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No hay tareas o eventos pendientes para hoy.</p>
              ) : (
                plannerItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left",
                      selectedId === item.id ? "bg-primary/10 text-foreground" : "hover:bg-accent",
                    )}
                  >
                    <span>
                      {item.start_time ? `${shortTime(item.start_time)} · ` : ""}
                      {item.title}
                    </span>
                    {selectedId === item.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))
              )}
            </div>
          )}

          {source === "free" && (
            <div className="space-y-2">
              <label htmlFor="daily-focus-text" className="text-sm font-medium">
                ¿Qué quieres priorizar?
              </label>
              <Input
                id="daily-focus-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Ej. Terminar el proyecto de Personal OS"
              />
            </div>
          )}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void clear()}
              disabled={!current || mutations.clearFocus.isPending}
            >
              Quitar enfoque
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={
                mutations.setFocus.isPending ||
                (source !== "free" && !selectedId) ||
                (source === "free" && !text.trim())
              }
            >
              Guardar enfoque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
