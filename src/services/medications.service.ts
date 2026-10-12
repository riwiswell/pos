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
    // Keep history: only remove still-open rows whose scheduled/snoozed time is in the future.
    const nowISO = new Date().toISOString();
    const { error: pendingError } = await supabase
      .from("medication_doses")
      .delete()
      .eq("medication_id", id)
      .eq("status", "pending")
      .gt("scheduled_at", nowISO);
    if (pendingError) throw pendingError;

    const { error: snoozedError } = await supabase
      .from("medication_doses")
      .delete()
      .eq("medication_id", id)
      .eq("status", "snoozed")
      .gt("snoozed_until", nowISO);
    if (snoozedError) throw snoozedError;
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

    // Preserve past records. Cancel only future scheduled doses and still-active snoozes.
    const nowISO = now.toISOString();
    const { error: pendingError } = await supabase
      .from("medication_doses")
      .delete()
      .eq("medication_id", id)
      .eq("status", "pending")
      .gt("scheduled_at", nowISO);
    if (pendingError) throw pendingError;

    const { error: snoozedError } = await supabase
      .from("medication_doses")
      .delete()
      .eq("medication_id", id)
      .eq("status", "snoozed")
      .gt("snoozed_until", nowISO);
    if (snoozedError) throw snoozedError;
  },

  /** Backward-compatible alias. Destructive medication deletion is disabled. */
  async remove(id: string) {
    return medicationsService.discontinue(id);
  },

  /**
   * Prepare a short rolling horizon so Worker push reminders exist even if the
   * user does not open Salud on the morning of every dose. Unique constraints
   * and ignoreDuplicates make the operation safe to repeat across page loads.
   */
  async prepareUpcomingDoses(horizonDays = 14): Promise<number> {
    const user_id = await currentUserId();
    const meds = (await medicationsService.list()).filter((med) => med.active);
    const horizon = Math.max(1, Math.min(30, Math.floor(horizonDays)));
    const today = new Date();
    const rows: {
      user_id: string;
      medication_id: string;
      dose_date: string;
      scheduled_time: string;
      scheduled_at: string;
    }[] = [];

    for (let offset = 0; offset < horizon; offset += 1) {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      const iso = [
        day.getFullYear(),
        String(day.getMonth() + 1).padStart(2, "0"),
        String(day.getDate()).padStart(2, "0"),
      ].join("-");
      for (const med of meds) {
        if (!appliesOn(med, iso)) continue;
        for (const time of med.times) {
          rows.push({
            user_id,
            medication_id: med.id,
            dose_date: iso,
            scheduled_time: time,
            scheduled_at: localDateTime(iso, time),
          });
        }
      }
    }

    const chunkSize = 500;
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      const { error } = await supabase
        .from("medication_doses")
        .upsert(rows.slice(offset, offset + chunkSize), {
          onConflict: "medication_id,dose_date,scheduled_time",
          ignoreDuplicates: true,
        });
      if (error) throw error;
    }
    return rows.length;
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
    // PostgREST applies a row limit. Page deterministically so older history isn't silently truncated.
    const pageSize = 1000;
    const rows: MedicationDose[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("medication_doses")
        .select("*")
        .gte("dose_date", fromDate)
        .lte("dose_date", toDate)
        .order("scheduled_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as MedicationDose[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  },

  /** Number of taken doses per medication (for remaining quantity). */
  async takenCounts(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("medication_doses")
        .select("id,medication_id")
        .eq("status", "taken")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = data ?? [];
      for (const row of page) out[row.medication_id] = (out[row.medication_id] ?? 0) + 1;
      if (page.length < pageSize) break;
    }
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
    const { error } = await supabase.from("medication_doses").update(patch).eq("id", id);
    if (error) throw error;
  },
};