import { useMemo, useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/States";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useHabits, useLogsRange } from "@/hooks/use-habits";
import { isHabitDone, isHabitPartial } from "@/domain/habits";
import { addDaysISO, fromISODate, toISODate } from "@/lib/date";
import type { Habit, HabitLog } from "@/domain/types";
import { cn } from "@/lib/utils";

type PresetKey = "month" | "prevMonth" | "d7" | "d30" | "d90" | "custom";
type MatrixScope = "both" | "habit" | "activity";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "month", label: "Este mes" },
  { key: "prevMonth", label: "Mes anterior" },
  { key: "d7", label: "Últimos 7 días" },
  { key: "d30", label: "Últimos 30 días" },
  { key: "d90", label: "Últimos 90 días" },
  { key: "custom", label: "Personalizado" },
];

const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"] as const;

function rangeFor(preset: PresetKey, anchor: string, custom: { start: string; end: string }) {
  const d = fromISODate(anchor);
  switch (preset) {
    case "month":
      return {
        start: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
        end: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
      };
    case "prevMonth":
      return {
        start: toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
        end: toISODate(new Date(d.getFullYear(), d.getMonth(), 0)),
      };
    case "d7":
      return { start: addDaysISO(anchor, -6), end: anchor };
    case "d30":
      return { start: addDaysISO(anchor, -29), end: anchor };
    case "d90":
      return { start: addDaysISO(anchor, -89), end: anchor };
    case "custom":
      return custom.start <= custom.end
        ? { start: custom.start, end: custom.end }
        : { start: custom.end, end: custom.start };
  }
}

function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 400) {
    out.push(cursor);
    cursor = addDaysISO(cursor, 1);
    guard += 1;
  }
  return out;
}

function MatrixTable({
  title,
  items,
  days,
  logMap,
}: {
  title: string;
  items: Habit[];
  days: string[];
  logMap: Map<string, HabitLog>;
}) {
  const rows = items.map((item) => {
    const cells = days.map((day) => {
      const log = logMap.get(item.id + "|" + day);
      return {
        day,
        done: isHabitDone(item, log),
        partial: isHabitPartial(item, log),
      };
    });
    return { item, cells, total: cells.filter((cell) => cell.done).length };
  });

  const grandTotal = rows.reduce((acc, row) => acc + row.total, 0);
  const perDayTotals = days.map((_, i) => rows.filter((row) => row.cells[i]?.done).length);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        No hay {title.toLowerCase()} para este período.
      </div>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[11rem] max-w-[17rem] bg-card/95 px-3 py-2 text-left text-xs font-semibold backdrop-blur">
                  {title}
                </th>
                {days.map((day) => {
                  const d = fromISODate(day);
                  return (
                    <th
                      key={day}
                      className="w-9 px-0 py-2 text-center text-[10px] font-medium text-muted-foreground"
                    >
                      <span className="block leading-none">{WEEKDAYS[d.getDay()]}</span>
                      <span className="block leading-tight text-foreground/70">{d.getDate()}</span>
                    </th>
                  );
                })}
                <th className="sticky right-0 z-20 w-14 bg-card/95 px-2 py-2 text-center text-[10px] font-semibold backdrop-blur">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.item.id}>
                  <td className="sticky left-0 z-10 max-w-[17rem] border-t border-border/50 bg-card/95 px-3 py-2 text-xs font-medium backdrop-blur">
                    <span className="block whitespace-normal break-words">{row.item.name}</span>
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.day} className="border-t border-border/50 px-0.5 py-1.5">
                      <span
                        title={row.item.name + " · " + cell.day}
                        className={cn(
                          "mx-auto flex h-6 w-6 items-center justify-center rounded-md text-[10px]",
                          cell.done
                            ? "bg-primary text-primary-foreground"
                            : cell.partial
                              ? "bg-primary/30 text-primary"
                              : "bg-muted/50 text-muted-foreground/40",
                        )}
                      >
                        {cell.done ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : cell.partial ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        ) : (
                          <Minus className="h-3 w-3" />
                        )}
                      </span>
                    </td>
                  ))}
                  <td className="sticky right-0 z-10 border-t border-border/50 bg-card/95 px-2 py-1.5 text-center text-xs font-semibold backdrop-blur">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 z-10 border-t border-border bg-card/95 px-3 py-2 text-xs font-semibold backdrop-blur">
                  Total del día
                </td>
                {perDayTotals.map((total, i) => (
                  <td
                    key={days[i]}
                    className="border-t border-border px-0.5 py-2 text-center text-[11px] tabular-nums text-muted-foreground"
                  >
                    {total || ""}
                  </td>
                ))}
                <td className="sticky right-0 z-10 border-t border-border bg-primary/15 px-2 py-2 text-center text-xs font-bold text-primary backdrop-blur">
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}

export function HabitMatrix() {
  const { date } = useGlobalDate();
  const [preset, setPreset] = useState<PresetKey>("month");
  const [scope, setScope] = useState<MatrixScope>("both");
  const [custom, setCustom] = useState({ start: addDaysISO(date, -13), end: date });
  const [selected, setSelected] = useState<string[] | null>(null);

  const range = rangeFor(preset, date, custom);
  const habitsQuery = useHabits();
  const logsQuery = useLogsRange(range.start, range.end);

  const all = habitsQuery.data ?? [];
  const items = scope === "both" ? all : all.filter((item) => item.kind === scope);
  const days = useMemo(() => daysBetween(range.start, range.end), [range.start, range.end]);
  const logMap = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const log of logsQuery.data ?? []) map.set(log.habit_id + "|" + log.date, log);
    return map;
  }, [logsQuery.data]);

  const selectedItems =
    selected === null ? items : items.filter((item) => selected.includes(item.id));
  const selectedHabits = selectedItems.filter((item) => item.kind === "habit");
  const selectedActivities = selectedItems.filter((item) => item.kind === "activity");

  const toggleItem = (id: string) => {
    const universe = items.map((item) => item.id);
    const current = selected ?? universe;
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    setSelected(next.length === universe.length ? null : next);
  };

  const selectionLabel =
    selected === null
      ? scope === "both"
        ? "Todos"
        : scope === "habit"
          ? "Todos los hábitos"
          : "Todas las actividades"
      : selected.length + " seleccionados";

  if (habitsQuery.isLoading || logsQuery.isLoading) return <LoadingState />;
  if (habitsQuery.error || logsQuery.error) {
    const error = habitsQuery.error ?? logsQuery.error;
    return <ErrorState message={error instanceof Error ? error.message : "No se pudo cargar la matriz."} />;
  }
  if (all.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay hábitos o actividades"
        description="Crea un registro en Hábitos para ver la matriz."
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full border border-border p-1">
          {([
            ["both", "Ambos"],
            ["habit", "Hábitos"],
            ["activity", "Actividades"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={scope === key}
              onClick={() => {
                setScope(key);
                setSelected(null);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium",
                scope === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 gap-1 overflow-x-auto">
          {PRESETS.map((presetItem) => (
            <Button
              key={presetItem.key}
              size="sm"
              variant={preset === presetItem.key ? "default" : "outline"}
              className="h-8 shrink-0 rounded-full text-xs"
              onClick={() => setPreset(presetItem.key)}
            >
              {presetItem.label}
            </Button>
          ))}
        </div>

        {items.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1 rounded-full text-xs">
                {selectionLabel}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-80 w-72 overflow-y-auto">
              <div className="mb-2 flex gap-2">
                <Button size="sm" variant="ghost" className="h-7 flex-1 text-xs" onClick={() => setSelected(null)}>
                  Todos
                </Button>
                <Button size="sm" variant="ghost" className="h-7 flex-1 text-xs" onClick={() => setSelected([])}>
                  Ninguno
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <label key={item.id} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={selected === null || selected.includes(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <span className="min-w-0 flex-1 whitespace-normal">
                      {item.name}
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {item.kind === "activity" ? "Actividad" : "Hábito"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={custom.start}
              className="h-9 w-40"
              onChange={(e) => setCustom((prev) => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={custom.end}
              className="h-9 w-40"
              onChange={(e) => setCustom((prev) => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>
      )}

      {scope === "both" ? (
        <div className="space-y-6">
          <MatrixTable title="Hábitos" items={selectedHabits} days={days} logMap={logMap} />
          <MatrixTable title="Actividades" items={selectedActivities} days={days} logMap={logMap} />
        </div>
      ) : (
        <MatrixTable
          title={scope === "habit" ? "Hábitos" : "Actividades"}
          items={selectedItems}
          days={days}
          logMap={logMap}
        />
      )}

      <p className="text-xs text-muted-foreground">
        {days.length} días · {selectedItems.length} registros · "Ambos" muestra hábitos y actividades por separado.
      </p>
    </section>
  );
}
