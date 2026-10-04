import { useEffect, useState } from "react";
import { Check, Minus, Plus, StickyNote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Habit, HabitLog } from "@/domain/types";

interface Props {
  habit: Habit;
  log: HabitLog | undefined;
  color: string;
  onToggle: (completed: boolean) => void;
  onValue: (value: number) => void;
  onNote: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}

export function HabitRow({
  habit,
  log,
  color,
  onToggle,
  onValue,
  onNote,
  onEdit,
  onDelete,
  onMove,
}: Props) {
  const value = log?.value ?? 0;
  const completed = habit.type === "check" ? (log?.completed ?? false) : value > 0;
  const target = habit.target ?? 0;
  const percent = target > 0 ? Math.round((value / target) * 100) : 0;

  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  // Keep the input in sync with server state unless the user is typing.
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  function commit(next: string) {
    const parsed = Number(next.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed !== value) onValue(parsed);
    else setDraft(String(value));
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/40 px-3 py-2.5">
      <span
        aria-hidden
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: color, opacity: completed ? 1 : 0.35 }}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "line-clamp-2 text-sm font-medium",
            completed && habit.type === "check" && "text-muted-foreground line-through",
          )}
        >
          {habit.name}
          {habit.kind === "activity" && (
            <span className="ml-2 rounded-full bg-secondary px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Actividad
            </span>
          )}
        </p>
        {habit.type === "counter" && (
          <p className="text-xs text-muted-foreground">
            {value}
            {target > 0 ? ` / ${target}` : ""} {habit.unit ?? ""}
            {target > 0 && <span className="ml-1 opacity-70">· {percent}%</span>}
          </p>
        )}
        {habit.type === "counter" && target > 0 && (
          <div
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.min(100, percent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${Math.min(100, percent)}%`, backgroundColor: color }}
            />
          </div>
        )}
        {log?.note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{log.note}</p>}
      </div>

      {habit.type === "check" ? (
        <Button
          type="button"
          variant={completed ? "default" : "outline"}
          size="icon"
          aria-label={completed ? "Marcar como no completado" : "Marcar como completado"}
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={() => onToggle(!completed)}
        >
          <Check className="h-4 w-4" />
        </Button>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Restar"
            className="h-8 w-8 rounded-full"
            onClick={() => onValue(Math.max(0, value - 1))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            inputMode="decimal"
            aria-label={`Valor de ${habit.name}`}
            value={draft}
            onFocus={() => setEditing(true)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              commit(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="h-8 w-14 px-1 text-center text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Sumar"
            className="h-8 w-8 rounded-full"
            onClick={() => onValue(value + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Nota del día"
        className={cn("h-8 w-8 shrink-0", log?.note ? "text-primary" : "text-muted-foreground")}
        onClick={onNote}
      >
        <StickyNote className="h-4 w-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Opciones de ${habit.name}`}
            className="h-8 w-8 shrink-0 text-muted-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>Editar hábito</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove(-1)}>Subir</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove(1)}>Bajar</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={onDelete}
            className="text-destructive focus:text-destructive"
          >
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}