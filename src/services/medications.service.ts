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
    const { data: before, error: readError } = await supabase
      .from("medications")
      .select("frequency,times,start_date,end_date,active")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!before) throw new Error("No encontramos el medicamento que intentas editar.");

    const normalized = clean(patch);
    const scheduleChanged =
      (normalized.frequency !== undefined && normalized.frequency !== before.frequency) ||
      (normalized.times !== undefined && JSON.stringify(normalizeTimes(normalized.times)) !== JSON.stringify(normalizeTimes(before.times ?? []))) ||
      (normalized.start_date !== undefined && normalized.start_date !== before.start_date) ||
      (normalized.end_date !== undefined && normalized.end_date !== before.end_date) ||
      (normalized.active !== undefined && normalized.active !== before.active);

    const { error } = await supabase.from("medications").update(normalized).eq("id", id);
    if (error) throw error;
    if (!scheduleChanged) return;

    // Preserve taken/skipped history and unchanged schedules. Rebuild only future open doses when scheduling settings change.
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

  async historyPage(
    fromDate: string,
    toDate: string,
    page = 0,
    pageSize = 50,
  ): Promise<{ rows: MedicationDose[]; total: number }> {
    const safePage = Math.max(0, Math.floor(page));
    const safeSize = Math.max(1, Math.min(100, Math.floor(pageSize) || 50));

    // History is for confirmed actions only. A past scheduled dose that was
    // never marked taken/skipped is not a medication-history event.
    const medications = await medicationsService.list();
    const cycleFilters = medications
      .filter((med) => Boolean(med.id && med.start_date))
      .map((med) => `and(medication_id.eq.${med.id},dose_date.gte.${med.start_date})`);

    if (cycleFilters.length === 0) return { rows: [], total: 0 };

    // A medication whose course was restarted must not leak doses from its
    // previous course into the current history list.
    const { data, error, count } = await supabase
      .from("medication_doses")
      .select("*", { count: "exact" })
      .gte("dose_date", fromDate)
      .lte("dose_date", toDate)
      .in("status", ["taken", "skipped"])
      .or(cycleFilters.join(","))
      .order("scheduled_at", { ascending: false })
      .order("id", { ascending: false })
      .range(safePage * safeSize, safePage * safeSize + safeSize - 1);
    if (error) throw error;
    return { rows: (data ?? []) as MedicationDose[], total: count ?? 0 };
  },

  /**
   * Number of taken doses in the current medication cycle.
   *
   * total_quantity is the physical stock counted when the current start_date
   * was set. Older taken doses belong to a previous course and must not be
   * deducted again after the medication is reactivated or its stock is reset.
   */
  async takenCounts(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    const medications = await medicationsService.list();
    if (medications.length === 0) return out;

    const startByMedication = new Map(
      medications.map((med) => [med.id, med.start_date]),
    );
    const startDates = medications
      .map((med) => med.start_date)
      .filter((date): date is string => Boolean(date))
      .sort();
    const firstStartDate = startDates[0];
    if (!firstStartDate) return out;

    const medicationIds = medications.map((med) => med.id);
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("medication_doses")
        .select("id,medication_id,dose_date")
        .in("medication_id", medicationIds)
        .eq("status", "taken")
        .gte("dose_date", firstStartDate)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = data ?? [];
      for (const row of page) {
        const cycleStart = startByMedication.get(row.medication_id);
        if (!cycleStart || row.dose_date < cycleStart) continue;
        out[row.medication_id] = (out[row.medication_id] ?? 0) + 1;
      }
      if (page.length < pageSize) break;
    }
    return out;
  },

  /** Sum of explicit stock additions per medication. Original quantity stays on the medication record. */
  async stockTotals(): Promise<Record<string, number>> {
    const totals: Record<string, number> = {};
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("medication_stock_movements")
        .select("id,medication_id,quantity")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = data ?? [];
      for (const row of page) {
        totals[row.medication_id] = (totals[row.medication_id] ?? 0) + Number(row.quantity ?? 0);
      }
      if (page.length < pageSize) break;
    }
    return totals;
  },

  /** A refill is an append-only movement; it never overwrites the initial stock or dose history. */
  async addStock(medicationId: string, quantity: number, note?: string): Promise<void> {
    const user_id = await currentUserId();
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
      throw new Error("La cantidad para reponer debe ser mayor que cero.");
    }
    const { data: medication, error: medicationError } = await supabase
      .from("medications")
      .select("id")
      .eq("id", medicationId)
      .eq("user_id", user_id)
      .maybeSingle();
    if (medicationError) throw medicationError;
    if (!medication) throw new Error("No encontramos el medicamento para reponer su inventario.");
    const { error } = await supabase.from("medication_stock_movements").insert({
      user_id,
      medication_id: medicationId,
      quantity,
      movement_type: "restock",
      note: note?.trim() || null,
    });
    if (error) throw error;
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
    } else {
      patch.snoozed_until = null;
    }
    const { error } = await supabase.from("medication_doses").update(patch).eq("id", id);
    if (error) throw error;
  },
};