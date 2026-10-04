/**
 * Date utilities for the PERSONAL OS global date.
 * All dates are handled as local calendar days serialized as YYYY-MM-DD.
 */

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const parsed = fromISODate(value);
  return !Number.isNaN(parsed.getTime()) && toISODate(parsed) === value;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Difference in whole calendar days: target - today. */
export function offsetFromToday(iso: string): number {
  const a = fromISODate(iso).getTime();
  const b = fromISODate(todayISO()).getTime();
  return Math.round((a - b) / 86_400_000);
}

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

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

export function dayName(iso: string): string {
  return DAYS[fromISODate(iso).getDay()] ?? "";
}

/** "Jueves, 7" when in the current month/year, otherwise "Jueves, 23 de julio". */
export function formatDayLabel(iso: string): string {
  const date = fromISODate(iso);
  const now = new Date();
  const sameMonth =
    date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const base = `${dayName(iso)}, ${date.getDate()}`;
  if (sameMonth) return base;
  const withMonth = `${base} de ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear()
    ? withMonth
    : `${withMonth} de ${date.getFullYear()}`;
}

/** HOY / AYER / MAÑANA / FECHA */
export function relativeLabel(iso: string): string {
  const offset = offsetFromToday(iso);
  if (offset === 0) return "HOY";
  if (offset === -1) return "AYER";
  if (offset === 1) return "MAÑANA";
  return "FECHA";
}

/** Label for the "previous day" shortcut, relative to the current view. */
export function previousDayLabel(iso: string): string {
  const offset = offsetFromToday(iso);
  if (offset === 0) return "Ayer";
  if (offset === -1) return "Anteayer";
  if (offset === 1) return "Hoy";
  return "Día anterior";
}

/** Label for the "next day" shortcut, relative to the current view. */
export function nextDayLabel(iso: string): string {
  const offset = offsetFromToday(iso);
  if (offset === -1) return "Hoy";
  if (offset === 0) return "Mañana";
  return "Día siguiente";
}

export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 6) return "Buenas noches";
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}