import { supabase } from "@/integrations/supabase/client";
import {
  SNOOZE_MINUTES,
  appliesOn,
  localDateTime,
  normalizeTimes,
  type DoseStatus,
  type Medication,
  type MedicationDose,
  type MedicationInput,
} from "@/domain/health";

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("No hay sesión activa");
  return data.user.id;
}

function clean(input: Partial<MedicationInput>): Partial<MedicationInput> {
  return {
    ...input,
    ...(input.name !== undefined ? { name: input.name.trim().replace(/\s+/g, " ") } : {}),
    ...(input.times ? { times: normalizeTimes(input.times) } : {}),
  };
}

export const medicationsService = {
  async list(): Promise<Medication[]> {
    const { data, error } = await supabase
      .from("medications")
      .select("*")
      .order("active", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Medication[];
  },

  async create(input: MedicationInput): Promise<Medication> {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("medications")
      .insert({ ...(clean(input) as MedicationInput), user_id })
      .select()
      .single();
    if (error) throw error;
    return data as Medication;
  },

  async update(id: string, patch: Partial<MedicationInput>) {
    const { error } = await supabase.from("medications").update(clean(patch)).eq("id", id);
    if (error) throw error;
    // Drop still-open future doses whose time no longer exists; they are regenerated.
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await supabase
      .from("medication_doses")
      .delete()
      .eq("medication_id", id)
      .gte("dose_date", iso)
      .in("status", ["pending", "snoozed"]);
  },

  /**
   * Stop scheduling a medication without destroying its historical record.
   * Past medication_doses remain untouched.
   */
  async discontinue(id: string) {
    const now = new Date();
    const iso = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    const { error } = await supabase
      .from("medications")
      .update({ active: false, end_date: iso })
      .eq("id", id);
    if (error) throw error;

    // Only remove future pending doses. Taken/skipped/snoozed history is retained.
    const { error: doseError } = await supabase
      .from("medication_doses")
      .delete()
      .eq("medication_id", id)
      .gte("dose_date", iso)
      .eq("status", "pending");
    if (doseError) throw doseError;
  },

  /** Backward-compatible alias. Destructive medication deletion is disabled. */
  async remove(id: string) {
    return medicationsService.discontinue(id);
  },

  /**
   * Materializes the doses of a date (idempotent: unique per medication/date/time)
   * and returns them. Never creates duplicates.
   */
  async dosesFor(date: string): Promise<MedicationDose[]> {
    const user_id = await currentUserId();
    const meds = await medicationsService.list();
    const rows = meds
      .filter((m) => appliesOn(m, date))
      .flatMap((m) =>
        m.times.map((t) => ({
          user_id,
          medication_id: m.id,
          dose_date: date,
          scheduled_time: t,
          scheduled_at: localDateTime(date, t),
        })),
      );
    if (rows.length) {
      const { error } = await supabase
        .from("medication_doses")
        .upsert(rows, { onConflict: "medication_id,dose_date,scheduled_time", ignoreDuplicates: true });
      if (error) throw error;
    }
    const { data, error } = await supabase
      .from("medication_doses")
      .select("*")
      .eq("dose_date", date)
      .order("scheduled_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as MedicationDose[];
  },

  async history(fromDate: string, toDate: string): Promise<MedicationDose[]> {
    const { data, error } = await supabase
      .from("medication_doses")
      .select("*")
      .gte("dose_date", fromDate)
      .lte("dose_date", toDate)
      .order("scheduled_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as MedicationDose[];
  },

  /** Number of taken doses per medication (for remaining quantity). */
  async takenCounts(): Promise<Record<string, number>> {
    const { data, error } = await supabase.from("medication_doses").select("medication_id").eq("status", "taken");
    if (error) throw error;
    const out: Record<string, number> = {};
    for (const r of data ?? []) out[r.medication_id] = (out[r.medication_id] ?? 0) + 1;
    return out;
  },

  /** Water belongs to the dose row: changing it updates, never duplicates. */
  async setWater(id: string, glasses: number) {
    const { error } = await supabase.from("medication_doses").update({ water_glasses: glasses }).eq("id", id);
    if (error) throw error;
  },

  async setStatus(id: string, status: DoseStatus, water?: number, takenAt?: string) {
    const patch: { status: string; taken_at?: string | null; snoozed_until?: string | null; water_glasses?: number | null } = { status };
    if (status === "taken") {
      patch.taken_at = takenAt ?? new Date().toISOString();
      if (water !== undefined) patch.water_glasses = water;
    } else {
      patch.taken_at = null;
      patch.water_glasses = null; // un-taking reverts the water contribution
    }
    if (status === "snoozed") {
      // Same row, new reminder time: never duplicates the original dose.
      patch.snoozed_until = new Date(Date.now() + SNOOZE_MINUTES * 60_000).toISOString();
    } else if (status === "pending") {
      patch.snoozed_until = null;
    }
    patch.taken_time_source = takenAt ? "manual" : "recorded";
    const { error } = await supabase.from("medication_doses").update(patch).eq("id", id);
    if (error) throw error;
  },
};