import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useProfile } from "@/hooks/use-profile";

type HydrationPreferences = {
  enabled?: boolean;
  start_time?: string;
  end_time?: string;
  interval_minutes?: number;
  amount_ml?: number;
  background_push?: boolean;
};

const DEFAULTS = {
  enabled: true,
  start_time: "08:00",
  end_time: "21:30",
  interval_minutes: 90,
  amount_ml: 250,
};

function bogotaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function scheduledTimes(start: string, end: string, interval: number) {
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const first = toMinutes(start);
  const last = toMinutes(end);
  if (!Number.isFinite(first) || !Number.isFinite(last) || interval <= 0 || last <= first) return [];
  const times: string[] = [];
  for (let minute = first; minute <= last; minute += interval) {
    times.push(String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0"));
  }
  return times;
}

/**
 * In-app hydration fallback. When a Web Push subscription exists, the Worker
 * delivers the persistent server-side jobs instead and this local path stays
 * silent to avoid duplicate alerts.
 */
export function useHydrationReminders() {
  const profile = useProfile();
  const [tick, setTick] = useState(0);
  const preferences = (profile.data?.notification_preferences?.hydration ?? DEFAULTS) as HydrationPreferences;
  const config = {
    enabled: preferences.enabled ?? DEFAULTS.enabled,
    start_time: preferences.start_time ?? DEFAULTS.start_time,
    end_time: preferences.end_time ?? DEFAULTS.end_time,
    interval_minutes: preferences.interval_minutes ?? DEFAULTS.interval_minutes,
    amount_ml: preferences.amount_ml ?? DEFAULTS.amount_ml,
    background_push: preferences.background_push ?? false,
  };
  const times = useMemo(
    () => scheduledTimes(config.start_time, config.end_time, config.interval_minutes),
    [config.start_time, config.end_time, config.interval_minutes],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 20_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (profile.isLoading || !config.enabled || times.length === 0) return;
    const now = bogotaNow();
    const date = `${now.year}-${now.month}-${now.day}`;
    const currentMinute = Number(now.hour) * 60 + Number(now.minute);
    const due = [...times].reverse().find((time) => {
      const [hour, minute] = time.split(":").map(Number);
      const elapsed = currentMinute - (hour * 60 + minute);
      return elapsed >= 0 && elapsed <= 4;
    });
    if (!due) return;

    const storageKey = `personal-os:hydration-reminders:${profile.data?.id ?? "guest"}`;
    let fired: string[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as unknown;
      if (Array.isArray(parsed)) fired = parsed.filter((value): value is string => typeof value === "string");
    } catch {
      fired = [];
    }
    const key = date + "@" + due;
    if (fired.includes(key)) return;

    const notify = async () => {
      // Only suppress the local reminder when the server confirms that Web Push
      // is fully configured. A stale browser subscription alone is not enough.
      if (config.background_push) return;

      const title = "💧 Pausa de hidratación";
      const body = `Toma ${config.amount_ml} ml de agua y regístralos en Salud.`;
      toast(title, { description: body, duration: 60_000 });
      if ("Notification" in window && Notification.permission === "granted") {
        try { new Notification(title, { body, tag: `pos:hydration:${date}:${due}` }); } catch { /* The in-app toast remains available. */ }
      }
      const next = [...fired, key].slice(-120);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // The toast still provides the reminder if local storage is unavailable.
      }
    };
    void notify();
  }, [config.amount_ml, config.enabled, config.interval_minutes, config.start_time, config.end_time, config.background_push, profile.data?.id, profile.isLoading, tick, times]);
}
