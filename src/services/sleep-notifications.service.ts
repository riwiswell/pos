import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type SleepReminderResult = "scheduled" | "push-not-enabled" | "cleared";

function bogotaDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function nextReminderAt(bedtime: string, minutesBefore: number, now = new Date()): Date {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(bedtime)) {
    throw new Error("La hora habitual de acostarse no es válida.");
  }
  if (![15, 20, 30].includes(minutesBefore)) {
    throw new Error("El aviso debe programarse 15, 20 o 30 minutos antes.");
  }
  let target = new Date(bogotaDate(now) + "T" + bedtime + ":00-05:00");
  if (target.getTime() <= now.getTime()) {
    target = new Date(addDays(bogotaDate(now), 1) + "T" + bedtime + ":00-05:00");
  }
  const fireAt = new Date(target.getTime() - minutesBefore * 60_000);
  // When someone saves after the reminder moment, send the first notice now
  // rather than postponing it by a whole day.
  return fireAt.getTime() <= now.getTime() ? new Date(now.getTime() + 5_000) : fireAt;
}

/** Synchronize the owner's daily bedtime reminder with the persistent Web Push queue. */
export async function syncSleepScheduleReminder(
  bedtime: string | null,
  minutesBefore: number | null,
): Promise<SleepReminderResult> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw authError ?? new Error("No hay sesión activa.");

  const removePending = async () => {
    const { error } = await db.from("notification_jobs")
      .delete()
      .eq("user_id", user.id)
      .eq("source_type", "sleep_schedule")
      .eq("source_id", user.id)
      .eq("status", "pending");
    if (error) throw error;
  };

  if (!bedtime || minutesBefore === null) {
    await removePending();
    return "cleared";
  }

  const { data: subscriptions, error: subscriptionError } = await db.from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);
  if (subscriptionError) throw subscriptionError;

  if (!subscriptions?.length) {
    await removePending();
    return "push-not-enabled";
  }

  await removePending();
  const fireAt = nextReminderAt(bedtime, minutesBefore);
  const { error: insertError } = await db.from("notification_jobs").insert({
    user_id: user.id,
    source_type: "sleep_schedule",
    source_id: user.id,
    fire_at: fireAt.toISOString(),
    title: "🌙 Prepárate para dormir",
    body: "En " + minutesBefore + " minutos quieres acostarte. Apaga pantallas, organiza lo necesario y prepárate para descansar.",
    payload: {
      kind: "sleep_schedule_reminder",
      bedtime,
      reminder_minutes: minutesBefore,
      repeat_rule: "daily",
      timezone: "America/Bogota",
    },
    status: "pending",
  });
  if (insertError) throw insertError;
  return "scheduled";
}
