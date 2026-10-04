/** Health · Medications domain. */

export type MedicationFrequency = "daily" | "alternate";
export type DoseStatus = "pending" | "taken" | "skipped" | "snoozed";

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dose: number | null;
  unit: string | null;
  frequency: MedicationFrequency;
  times: string[]; // "HH:MM"
  start_date: string;
  end_date: string | null;
  active: boolean;
  notes: string | null;
  remind_offset_min: number;
  total_quantity: number | null;
  created_at: string;
  updated_at: string;
}

export interface MedicationInput {
  name: string;
  dose: number | null;
  unit: string | null;
  frequency: MedicationFrequency;
  times: string[];
  start_date: string;
  end_date: string | null;
  active: boolean;
  notes: string | null;
  remind_offset_min: number;
  total_quantity: number | null;
}

export interface MedicationDose {
  id: string;
  user_id: string;
  medication_id: string;
  dose_date: string;
  scheduled_time: string;
  scheduled_at: string;
  status: DoseStatus;
  taken_at: string | null;
  snoozed_until: string | null;
  water_glasses: number | null;
  created_at: string;
  updated_at: string;
}

export const DOSE_STATUS_LABEL: Record<DoseStatus, string> = {
  pending: "Pendiente",
  taken: "Tomada",
  skipped: "Omitida",
  snoozed: "Pospuesta",
};

export const FREQUENCY_LABEL: Record<MedicationFrequency, string> = {
  daily: "Todos los días",
  alternate: "Día por medio",
};

export const REMIND_OFFSETS = [0, 5, 10, 15, 30] as const;
export const SNOOZE_MINUTES = 10;

/** Does this medication have doses on the given ISO date? */
export function appliesOn(med: Medication, iso: string): boolean {
  if (!med.active) return false;
  if (iso < med.start_date) return false;
  const end = effectiveEndDate(med);
  if (end && iso > end) return false;
  if (med.frequency === "alternate") {
    const a = new Date(`${med.start_date}T00:00:00`).getTime();
    const b = new Date(`${iso}T00:00:00`).getTime();
    return Math.round((b - a) / 86_400_000) % 2 === 0;
  }
  return true;
}

/** Local date + "HH:MM" → ISO timestamp. */
export function localDateTime(iso: string, time: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0).toISOString();
}

/** When the dose is effectively due (snooze moves it). */
export function effectiveDueAt(dose: MedicationDose): Date {
  return new Date(dose.status === "snoozed" && dose.snoozed_until ? dose.snoozed_until : dose.scheduled_at);
}

export function isOpen(dose: MedicationDose) {
  return dose.status === "pending" || dose.status === "snoozed";
}

export function formatTime12(date: Date): string {
  return date.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function doseLabel(med: Pick<Medication, "dose" | "unit">): string {
  if (med.dose == null) return med.unit ?? "";
  return `${med.dose}${med.unit ? ` ${med.unit}` : ""}`;
}

export function normalizeTimes(times: string[]): string[] {
  return Array.from(new Set(times.filter((t) => /^\d{2}:\d{2}$/.test(t)))).sort();
}

export const DOSE_UNITS = [
  "Tableta", "Pastilla", "Cápsula", "Comprimido", "Sobre", "Gota", "ml", "mg", "g",
  "Aplicación", "Puff", "Cucharadita", "Cucharada", "Otro",
] as const;

export const WATER_OPTIONS = [0, 0.5, 1, 1.5, 2] as const;

export function formatGlasses(n: number): string {
  const v = String(n).replace(".", ",");
  return `${v} ${n === 1 ? "vaso" : "vasos"}`;
}

/** Average doses per day (alternate-day schedules count half). */
export function dosesPerDay(med: Pick<Medication, "times" | "frequency">): number {
  return med.times.length / (med.frequency === "alternate" ? 2 : 1);
}

/** Days the total quantity lasts: total / (dose × doses per day). Null when not derivable. */
export function durationDays(
  med: Pick<Medication, "times" | "frequency" | "dose" | "total_quantity">,
): number | null {
  const per = (med.dose ?? 0) * dosesPerDay(med);
  if (!med.total_quantity || med.total_quantity <= 0 || per <= 0) return null;
  return Math.floor(med.total_quantity / per);
}

/** Last day with doses derived from the quantity (start counts as day 1). */
export function estimatedEndDate(
  med: Pick<Medication, "times" | "frequency" | "dose" | "total_quantity" | "start_date">,
): string | null {
  const days = durationDays(med);
  if (!days) return null;
  const d = new Date(`${med.start_date}T00:00:00`);
  d.setDate(d.getDate() + days - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Manual end date wins; otherwise the one derived from the quantity. */
export function effectiveEndDate(med: Medication): string | null {
  return med.end_date ?? estimatedEndDate(med);
}

export function remainingQuantity(med: Pick<Medication, "total_quantity" | "dose">, takenCount: number): number | null {
  if (med.total_quantity == null) return null;
  return Math.max(0, med.total_quantity - takenCount * (med.dose ?? 0));
}

/** Water drunk with doses that are currently marked as taken. */
export function medicationWater(doses: MedicationDose[]): number {
  return doses.reduce((s, d) => s + (d.status === "taken" ? Number(d.water_glasses ?? 0) : 0), 0);
}