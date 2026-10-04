import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGlobalDate } from "@/hooks/use-global-date";
import {
  formatClock,
  formatDayLabel,
  fromISODate,
  nextDayLabel,
  previousDayLabel,
  relativeLabel,
  toISODate,
} from "@/lib/date";

interface Props {
  /** Show the "next day" shortcut (planning domains need it). */
  allowFuture?: boolean;
}

/**
 * Reusable global date header. Every PERSONAL OS domain uses this component —
 * there are no per-module date pickers.
 */
export function GlobalDateHeader({ allowFuture = true }: Props) {
  const { date, setDate, shiftDate, goToday } = useGlobalDate();
  const [now, setNow] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const relative = relativeLabel(date);

  return (
    <header className="glass rounded-2xl px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
          {relative}
        </span>
        {relative !== "HOY" && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={goToday}>
            Ir a hoy
          </Button>
        )}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 gap-1 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => shiftDate(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="text-sm">{previousDayLabel(date)}</span>
        </Button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir calendario"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <CalendarDays className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={fromISODate(date)}
              defaultMonth={fromISODate(date)}
              onSelect={(selected) => {
                if (!selected) return;
                setDate(toISODate(selected));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>

        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-lg font-semibold leading-tight">{formatDayLabel(date)}</p>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            {now ? formatClock(now) : "--:--"}
          </p>
        </div>

        {allowFuture && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 shrink-0 gap-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => shiftDate(1)}
          >
            <span className="hidden text-sm sm:inline">{nextDayLabel(date)}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}