import { useEffect, useState } from "react";
import { MoonStar } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHealthMetricMutation } from "@/hooks/use-personal-domains";

const LAST_ACTIVE_KEY = "pos:sleep-detection:last-active:v1";
type Candidate = { start: Date; end: Date };

function localDate(value: Date) {
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
}
function localTime(value: Date) {
  return String(value.getHours()).padStart(2, "0") + ":" + String(value.getMinutes()).padStart(2, "0");
}
function isNightStart(value: Date) {
  const hour = value.getHours();
  return hour >= 18 || hour <= 3;
}
function isMorningReturn(value: Date) {
  const hour = value.getHours();
  return hour >= 4 && hour <= 12;
}
function durationLabel(start: Date, end: Date) {
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? hours + " h " + rest + " min" : hours + " h";
}

export function SleepAbsencePrompt() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [saving, setSaving] = useState(false);
  const saveMetric = useHealthMetricMutation();

  useEffect(() => {
    const now = new Date();
    try {
      const raw = localStorage.getItem(LAST_ACTIVE_KEY);
      const previous = raw ? new Date(Number(raw)) : null;
      if (previous && Number.isFinite(previous.getTime())) {
        const gapHours = (now.getTime() - previous.getTime()) / 3600000;
        if (gapHours >= 4.5 && gapHours <= 14 && isNightStart(previous) && isMorningReturn(now)) {
          setCandidate({ start: previous, end: now });
          setBedtime(localTime(previous));
          setWakeTime(localTime(now));
        }
      }
      localStorage.setItem(LAST_ACTIVE_KEY, String(now.getTime()));
    } catch {
      // If browser storage is unavailable, skip detection without interrupting POS.
    }

    const markActive = () => {
      try { localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch {}
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") markActive();
      else markActive();
    };
    window.addEventListener("pointerdown", markActive, { passive: true });
    window.addEventListener("keydown", markActive);
    window.addEventListener("touchstart", markActive, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", markActive);
    return () => {
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("touchstart", markActive);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", markActive);
    };
  }, []);

  const dismiss = () => setCandidate(null);

  const confirmSleep = async () => {
    if (!candidate || saving) return;
    if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(bedtime) || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(wakeTime) || bedtime === wakeTime) {
      toast.error("Revisa las horas de acostarte y levantarte.");
      return;
    }
    const [bh, bm] = bedtime.split(":").map(Number);
    const [wh, wm] = wakeTime.split(":").map(Number);
    let minutes = wh * 60 + wm - (bh * 60 + bm);
    if (minutes < 0) minutes += 1440;
    if (minutes < 60 || minutes > 1440) {
      toast.error("La duración calculada no parece válida. Ajusta las horas.");
      return;
    }
    setSaving(true);
    try {
      const metricDate = localDate(candidate.end);
      const { data: existing, error: readError } = await supabase
        .from("health_metrics")
        .select("notes")
        .eq("metric_date", metricDate)
        .maybeSingle();
      if (readError) throw readError;
      const marker = "__POS_BODY_MEASURES__";
      let body: Record<string, unknown> = {};
      let notes = "";
      if (existing?.notes) {
        try {
          const parsed = JSON.parse(existing.notes);
          if (parsed?.marker === marker) {
            body = parsed.body && typeof parsed.body === "object" ? parsed.body : {};
            notes = typeof parsed.notes === "string" ? parsed.notes : "";
          } else {
            notes = existing.notes;
          }
        } catch {
          notes = existing.notes;
        }
      }
      await saveMetric.mutateAsync({
        metric_date: metricDate,
        sleep_hours: Math.round((minutes / 60) * 100) / 100,
        notes: JSON.stringify({
          marker,
          body,
          notes,
          sleep: { bedtime, wakeTime, awakenings: null, napMinutes: null },
        }),
      });
      toast.success("Registro de sueño agregado.");
      dismiss();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el sueño.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(candidate)} onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <MoonStar className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>¿Estabas durmiendo?</DialogTitle>
          <DialogDescription>
            Detecté que estuviste ausente aproximadamente {candidate ? durationLabel(candidate.start, candidate.end) : ""}. ¿Quieres agregar este intervalo a tu registro de sueño?
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">
            Me acosté aproximadamente
            <Input className="mt-1" type="time" value={bedtime} onChange={(event) => setBedtime(event.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">
            Me levanté aproximadamente
            <Input className="mt-1" type="time" value={wakeTime} onChange={(event) => setWakeTime(event.target.value)} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">La ausencia es solo una estimación: confirma o corrige las horas. POS no guardará nada sin tu autorización.</p>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={dismiss} disabled={saving}>No, gracias</Button>
          <Button type="button" onClick={() => void confirmSleep()} disabled={saving || !bedtime || !wakeTime}>
            {saving ? "Guardando…" : "Sí, agregar a mi sueño"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
