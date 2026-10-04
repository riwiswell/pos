import { useMemo, useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/States";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useHabits, useLogsRange } from "@/hooks/use-habits";
import { isHabitDone, isHabitPartial } from "@/domain/habits";
import { addDaysISO, fromISODate, toISODate } from "@/lib/date";
import type { HabitLog } from "@/domain/types";
import { cn } from "@/lib/utils";

type PresetKey = "month" | "prevMonth" | "d7" | "d30" | "d90" | "custom";

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

/**
 * Read-only completion matrix: habits (rows) x days (columns), with per-habit
 * and global totals. Activities are excluded on purpose.
 */
export function HabitMatrix() {
  const { date } = useGlobalDate();
  const [preset, setPreset] = useState<PresetKey>("month");
  const [custom, setCustom] = useState({ start: addDaysISO(date, -13), end: date });
  const [selected, setSelected] = useState<string[] | null>(null); // null = todos

  const range = rangeFor(preset, date, custom);
  const habitsQuery = useHabits();
  const logsQuery = useLogsRange(range.start, range.end);

  const habits = useMemo(
    () => (habitsQuery.data ?? []).filter((h) => h.kind === "habit"),
    [habitsQuery.data],
  );

  const visible = useMemo(
    () => (selected === null ? habits : habits.filter((h) => selected.includes(h.id))),
    [habits, selected],
  );

  const days = useMemo(() => daysBetween(range.start, range.end), [range.start, range.end]);

  const logMap = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const log of logsQuery.data ?? []) map.set(`${log.habit_id}|${log.date}`, log);
    return map;
  }, [logsQuery.data]);

  const rows = useMemo(
    () =>
      visible.map((habit) => {
        const cells = days.map((day) => {
          const log = logMap.get(`${habit.id}|${day}`);
          return {
            day,
            done: isHabitDone(habit, log),
            partial: isHabitPartial(habit, log),
          };
        });
        return { habit, cells, total: cells.filter((c) => c.done).length };
      }),
    [visible, days, logMap],
  );

  const grandTotal = rows.reduce((acc, r) => acc + r.total, 0);
  const perDayTotals = days.map(
    (_, i) => rows.filter((r) => r.cells[i]?.done).length,
  );

  function toggleHabit(id: string) {
    const current = selected ?? habits.map((h) => h.id);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setSelected(next.length === habits.length ? null : next);
  }

  const selectionLabel =
    selected === null
      ? "Todos los hábitos"
      : selected.length === 1
        ? (habits.find((h) => h.id === selected[0])?.name ?? "1 hábito")
        : `${selected.length} hábitos`;

  if (habitsQuery.isLoading) return <LoadingState />;
  if (habitsQuery.error || logsQuery.error)
    return <ErrorState message={((habitsQuery.error ?? logsQuery.error) as Error).message} />;
  if (habits.length === 0)
    return (
      <EmptyState
        title="Todavía no hay hábitos que analizar"
        description="Crea un hábito (no una actividad) para ver su matriz de cumplimiento."
      />
    );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1 pb-1">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={preset === p.key ? "default" : "outline"}
              className="h-8 shrink-0 rounded-full text-xs"
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1 rounded-full text-xs">
              {selectionLabel}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-80 w-64 overflow-y-auto">
            <div className="mb-2 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 flex-1 text-xs"
                onClick={() => setSelected(null)}
              >
                Todos
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 flex-1 text-xs"
                onClick={() => setSelected([])}
              >
                Ninguno
              </Button>
            </div>
            <div className="space-y-2">
              {habits.map((habit) => {
                const checked = selected === null || selected.includes(habit.id);
                return (
                  <label key={habit.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={checked} onCheckedChange={() => toggleHabit(habit.id)} />
                    <span className="min-w-0 flex-1 truncate">{habit.name}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
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

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[9.5rem] max-w-[12rem] bg-card/95 px-3 py-2 text-left text-xs font-semibold backdrop-blur">
                  Hábito
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
                <tr key={row.habit.id} className="group">
                  <td className="sticky left-0 z-10 max-w-[12rem] truncate border-t border-border/50 bg-card/95 px-3 py-1.5 text-xs font-medium backdrop-blur">
                    {row.habit.name}
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.day} className="border-t border-border/50 px-0.5 py-1.5">
                      <span
                        title={`${row.habit.name} · ${cell.day}`}
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
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={days.length + 2}
                    className="border-t border-border/50 px-3 py-6 text-center text-xs text-muted-foreground"
                  >
                    Selecciona al menos un hábito.
                  </td>
                </tr>
              )}
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

      <p className="text-xs text-muted-foreground">
        {days.length} días · {rows.length} hábitos · {grandTotal} completaciones
      </p>
    </section>
  );
}