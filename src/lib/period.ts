import { addDaysISO, fromISODate, toISODate } from "@/lib/date";

/**
 * Finance periods are always derived from the PERSONAL OS global date.
 * There is no second date state anywhere in the module.
 */
export type PeriodKind = "day" | "week" | "month" | "year" | "custom";

export interface PeriodRange {
  kind: PeriodKind;
  /** Inclusive ISO date. */
  start: string;
  /** Inclusive ISO date. */
  end: string;
}

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const PERIOD_LABEL: Record<PeriodKind, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  year: "Año",
  custom: "Período",
};

/** Monday-first week start. */
export function startOfWeekISO(iso: string): string {
  const date = fromISODate(iso);
  const day = (date.getDay() + 6) % 7;
  return addDaysISO(iso, -day);
}

export function buildPeriod(kind: PeriodKind, anchor: string, custom?: { start: string; end: string }): PeriodRange {
  const date = fromISODate(anchor);
  switch (kind) {
    case "day":
      return { kind, start: anchor, end: anchor };
    case "week": {
      const start = startOfWeekISO(anchor);
      return { kind, start, end: addDaysISO(start, 6) };
    }
    case "month": {
      const start = toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
      const end = toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
      return { kind, start, end };
    }
    case "year": {
      const start = toISODate(new Date(date.getFullYear(), 0, 1));
      const end = toISODate(new Date(date.getFullYear(), 11, 31));
      return { kind, start, end };
    }
    case "custom": {
      const start = custom?.start ?? anchor;
      const end = custom?.end ?? anchor;
      return start <= end ? { kind, start, end } : { kind, start: end, end: start };
    }
  }
}

function shortDate(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]?.slice(0, 3)}`;
}

export function formatPeriod(period: PeriodRange): string {
  const start = fromISODate(period.start);
  switch (period.kind) {
    case "day":
      return `${DAYS[start.getDay()]}, ${start.getDate()} de ${MONTHS[start.getMonth()]}`;
    case "week":
      return `${shortDate(period.start)} – ${shortDate(period.end)}`;
    case "month":
      return `${(MONTHS[start.getMonth()] ?? "").replace(/^./, (c) => c.toUpperCase())} ${start.getFullYear()}`;
    case "year":
      return `${start.getFullYear()}`;
    case "custom": {
      const end = fromISODate(period.end);
      return `${shortDate(period.start)} – ${shortDate(period.end)} ${end.getFullYear()}`;
    }
  }
}

/** Human label for a transactions-list day header. */
export function formatFullDate(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

/** "3:00 p. m." from a HH:MM(:SS) string. Returns null when there is no time. */
export function formatTime(value: string | null): string | null {
  if (!value) return null;
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw ?? 0);
  if (Number.isNaN(h)) return null;
  const suffix = h < 12 ? "a. m." : "p. m.";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}