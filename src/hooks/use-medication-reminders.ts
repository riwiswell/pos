import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { todayISO } from "@/lib/date";
import { lastWater, useDoses, useMedicationMutations, useMedications } from "@/hooks/use-medications";
import { doseLabel, effectiveDueAt, formatGlasses, formatTime12, isOpen, type DoseStatus } from "@/domain/health";
import { subscribeToBackgroundPush } from "@/services/push.service";

const FIRED_KEY = "personal-os:med-fired";
const WINDOW_MS = 30 * 60_000; // don't notify for doses due more than 30 min ago

function readFired(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}") as Record<string, true>;
  } catch {
    return {};
  }
}

export type NotifPermission = NotificationPermission | "unsupported";

export function getPermission(): NotifPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotifPermission> {
  if (getPermission() === "unsupported") return "unsupported";
  return Notification.requestPermission();
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

/**
 * Real medication reminders while Personal OS is open (any page):
 * system notification (with Tomada / Posponer actions where the browser
 * supports them) + in-app toast with the same actions.
 */
export function useMedicationReminders() {
  const today = todayISO();
  const meds = useMedications();
  const doses = useDoses(today);
  const { setStatus } = useMedicationMutations();
  const [tick, setTick] = useState(0);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);
  const actRef = useRef(setStatus.mutate);
  actRef.current = setStatus.mutate;

  useEffect(() => {
    void registration().then((r) => (regRef.current = r));
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; action?: string; doseId?: string };
      if (d?.type !== "medication-action" || !d.doseId) return;
      const status: DoseStatus | null =
        d.action === "take" ? "taken" : d.action === "snooze" ? "snoozed" : null;
      if (status) actRef.current({ id: d.doseId, status });
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    const id = window.setInterval(() => setTick((t) => t + 1), 20_000);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMsg);
      window.clearInterval(id);
    };
  }, []);

  const byId = useMemo(() => new Map((meds.data ?? []).map((m) => [m.id, m])), [meds.data]);

  useEffect(() => {
    if (!doses.data) return;
    const now = Date.now();
    const fired = readFired();
    let changed = false;
    for (const dose of doses.data) {
      if (!isOpen(dose)) continue;
      const med = byId.get(dose.medication_id);
      if (!med) continue;
      const due = effectiveDueAt(dose);
      const notifyAt = due.getTime() - med.remind_offset_min * 60_000;
      const key = `${dose.id}@${due.toISOString()}`;
      if (fired[key] || now < notifyAt || now - due.getTime() > WINDOW_MS) continue;
      fired[key] = true;
      changed = true;

      const title = `💊 ${med.name}`;
      const body = [formatTime12(due), doseLabel(med), `💧 ${formatGlasses(lastWater())}`].filter(Boolean).join("\n");
      if (getPermission() === "granted") {
        const opts: NotificationOptions & { actions?: { action: string; title: string }[] } = {
          body,
          tag: key,
          requireInteraction: true,
          data: { doseId: dose.id },
          actions: [
            { action: "take", title: "Tomada" },
            { action: "snooze", title: "Posponer" },
          ],
        };
        if (regRef.current) void regRef.current.showNotification(title, opts);
        else {
          delete opts.actions;
          new Notification(title, opts);
        }
      }
      toast(title, {
        description: body,
        duration: 60_000,
        action: { label: "Tomada", onClick: () => actRef.current({ id: dose.id, status: "taken" }) },
        cancel: { label: "Posponer", onClick: () => actRef.current({ id: dose.id, status: "snoozed" }) },
      });
    }
    if (changed) localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  }, [doses.data, byId, tick]);
}