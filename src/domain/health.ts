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
  stock_unit: string;
  units_per_dose: number;
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
  stock_unit: string;
  units_per_dose: number;
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

/**
 * Human-readable daily schedule summary.
 * units_per_dose is physical inventory consumed at each scheduled time;
 * dose/unit may instead describe the medication strength (for example, 50 mg).
 */
export function medicationScheduleLabel(
  med: Pick<Medication, "dose" | "unit" | "times" | "frequency" | "stock_unit" | "units_per_dose">,
): string {
  const times = normalizeTimes(med.times ?? []);
  const perDose = Number(med.units_per_dose ?? 1);
  const dailyQuantity = Math.max(0, perDose * times.length);
  const rawUnit = String(med.stock_unit || med.unit || "unidades").trim();
  const key = rawUnit.toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
  const plural: Record<string, string> = {
    tableta: "tabletas",
    pastilla: "pastillas",
    capsula: "capsulas",
    comprimido: "comprimidos",
    sobre: "sobres",
    gota: "gotas",
    aplicacion: "aplicaciones",
    puff: "puffs",
    unidad: "unidades",
    cucharadita: "cucharaditas",
    cucharada: "cucharadas",
  };
  const stockUnit = plural[key] ?? rawUnit;
  const quantity = dailyQuantity.toLocaleString("es-CO", { maximumFractionDigits: 3 });
  const frequencyText = med.frequency === "alternate"
    ? `${quantity} ${stockUnit} en cada día de toma`
    : `${quantity} ${stockUnit} al día`;

  const strengthUnit = String(med.unit ?? "").toLocaleLowerCase("es-CO");
  const isPhysicalDoseUnit = [
    "tableta", "pastilla", "cápsula", "comprimido", "sobre", "gota",
    "aplicación", "puff", "cucharadita", "cucharada", "otro",
  ].includes(strengthUnit);
  const strength = !isPhysicalDoseUnit && med.dose != null
    ? `${doseLabel(med)} por toma · `
    : "";

  return `${strength}${frequencyText}${times.length ? ` · ${times.join(", ")}` : ""}`;
}

export function normalizeTimes(times: string[]): string[] {
  return Array.from(new Set(times.filter((t) => /^\d{2}:\d{2}$/.test(t)))).sort();
}

export const DOSE_UNITS = [
  "Tableta", "Pastilla", "Cápsula", "Comprimido", "Sobre", "Gota", "ml", "mg", "g",
  "Aplicación", "Puff", "Cucharadita", "Cucharada", "Otro",
] as const;

export const WATER_OPTIONS = [0, 0.5, 1, 1.5, 2] as const;

export const STOCK_UNITS = ["Tabletas", "Cápsulas", "Comprimidos", "Sobres", "ml", "Gotas", "Aplicaciones", "Puffs", "Unidades"] as const;

export type BeverageType = "water" | "coffee" | "tea" | "milk" | "other";
export interface HydrationEntry {
  id: string;
  user_id: string;
  consumed_on: string;
  consumed_at: string;
  beverage_type: BeverageType;
  amount_ml: number;
  note: string | null;
  created_at: string;
}

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
  med: Pick<Medication, "times" | "frequency" | "total_quantity"> & Partial<Pick<Medication, "units_per_dose">>,
): number | null {
  const per = Number(med.units_per_dose ?? 1) * dosesPerDay(med);
  if (med.total_quantity == null || med.total_quantity <= 0 || per <= 0) return null;
  return Math.floor(med.total_quantity / per);
}

/** Last day with doses derived from the quantity (start counts as day 1). */
export function estimatedEndDate(
  med: Pick<Medication, "times" | "frequency" | "total_quantity" | "start_date"> & Partial<Pick<Medication, "units_per_dose">>,
): string | null {
  const days = durationDays(med);
  if (!days) return null;
  const d = new Date(`${med.start_date}T00:00:00`);
  d.setDate(d.getDate() + days - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A medication stays scheduled until the user sets an explicit end date or pauses it. */
export function effectiveEndDate(med: Medication): string | null {
  return med.end_date;
}

export function remainingQuantity(
  med: Pick<Medication, "total_quantity"> & Partial<Pick<Medication, "units_per_dose">>,
  takenCount: number,
  restocked = 0,
): number | null {
  if (med.total_quantity == null) return null;
  const consumed = Math.max(0, takenCount) * Number(med.units_per_dose ?? 1);
  return Math.max(0, Number(med.total_quantity) + Math.max(0, restocked) - consumed);
}

/** Water drunk with doses that are currently marked as taken. */
export function medicationWater(doses: MedicationDose[]): number {
  return doses.reduce((s, d) => s + (d.status === "taken" ? Number(d.water_glasses ?? 0) : 0), 0);
}