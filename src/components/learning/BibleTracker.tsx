import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, CheckCircle2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/common/States";
import { useAuth } from "@/hooks/use-auth";
import { BIBLE_PLAN_MONTHS, BIBLE_READING_PLAN } from "@/data/bible-reading-plan";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
type ReadingMode = "annual_plan" | "free";

function localDateISO() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function BibleTracker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const [month, setMonth] = useState(BIBLE_PLAN_MONTHS[0] ?? "Enero");
  const [cycleStartDate, setCycleStartDate] = useState(localDateISO());
  const [readingDate, setReadingDate] = useState(localDateISO());
  const [scriptureReference, setScriptureReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const preferenceQuery = useQuery({
    queryKey: ["bible-reading", userId, "preference"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await db
        .from("bible_reading_preferences")
        .select("user_id,mode")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as { user_id: string; mode: ReadingMode } | null;
    },
  });

  const cycleQuery = useQuery({
    queryKey: ["bible-reading", userId, "active-cycle"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await db
        .from("bible_reading_cycles")
        .select("id,user_id,start_date,status,created_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; user_id: string; start_date: string; status: string } | null;
    },
  });

  const cycleId = cycleQuery.data?.id;
  const completionsQuery = useQuery({
    queryKey: ["bible-reading", userId, "completions", cycleId],
    enabled: Boolean(userId && cycleId),
    queryFn: async () => {
      const { data, error } = await db
        .from("bible_reading_completions")
        .select("day_number,completed_at")
        .eq("user_id", userId)
        .eq("cycle_id", cycleId);
      if (error) throw error;
      return (data ?? []) as Array<{ day_number: number; completed_at: string }>;
    },
  });

  const freeReadingsQuery = useQuery({
    queryKey: ["bible-reading", userId, "free-readings"],
    enabled: Boolean(userId && preferenceQuery.data?.mode === "free"),
    queryFn: async () => {
      const { data, error } = await db
        .from("bible_free_readings")
        .select("id,reading_date,scripture_reference,notes,created_at")
        .eq("user_id", userId)
        .order("reading_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        reading_date: string;
        scripture_reference: string;
        notes: string | null;
      }>;
    },
  });

  const completedDays = useMemo(
    () => new Set((completionsQuery.data ?? []).map((item) => Number(item.day_number))),
    [completionsQuery.data],
  );
  const completedCount = completedDays.size;
  const progress = Math.round((completedCount / 365) * 1000) / 10;
  const visibleDays = useMemo(
    () => BIBLE_READING_PLAN.filter((item) => item.month === month),
    [month],
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bible-reading", userId, "preference"] }),
      queryClient.invalidateQueries({ queryKey: ["bible-reading", userId, "active-cycle"] }),
      queryClient.invalidateQueries({ queryKey: ["bible-reading", userId, "completions"] }),
      queryClient.invalidateQueries({ queryKey: ["bible-reading", userId, "free-readings"] }),
    ]);
  };

  const saveMode = async (mode: ReadingMode) => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await db.from("bible_reading_preferences").upsert(
        { user_id: userId, mode },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      if (mode === "annual_plan" && !cycleQuery.data) {
        const { error: cycleError } = await db.from("bible_reading_cycles").insert({
          user_id: userId,
          start_date: cycleStartDate || localDateISO(),
          status: "active",
        });
        if (cycleError) throw cycleError;
      }
      await refresh();
      toast.success(mode === "annual_plan" ? "Plan anual activado." : "Lectura libre activada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar tu modalidad.");
    } finally {
      setSaving(false);
    }
  };

  const startNewCycle = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      if (cycleQuery.data) {
        const { error: finishError } = await db
          .from("bible_reading_cycles")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", cycleQuery.data.id)
          .eq("user_id", userId);
        if (finishError) throw finishError;
      }
      const { error } = await db.from("bible_reading_cycles").insert({
        user_id: userId,
        start_date: cycleStartDate || localDateISO(),
        status: "active",
      });
      if (error) throw error;
      await refresh();
      toast.success("Nuevo ciclo bíblico iniciado. Tu historial anterior se conserva.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar el ciclo.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = async (dayNumber: number, checked: boolean) => {
    if (!userId || !cycleId) return;
    try {
      if (checked) {
        const { error } = await db.from("bible_reading_completions").upsert(
          { user_id: userId, cycle_id: cycleId, day_number: dayNumber },
          { onConflict: "cycle_id,day_number" },
        );
        if (error) throw error;
      } else {
        const { error } = await db
          .from("bible_reading_completions")
          .delete()
          .eq("user_id", userId)
          .eq("cycle_id", cycleId)
          .eq("day_number", dayNumber);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({
        queryKey: ["bible-reading", userId, "completions", cycleId],
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el día.");
    }
  };

  const saveFreeReading = async () => {
    if (!userId || !scriptureReference.trim()) return;
    setSaving(true);
    try {
      const { error } = await db.from("bible_free_readings").insert({
        user_id: userId,
        reading_date: readingDate || localDateISO(),
        scripture_reference: scriptureReference.trim(),
        notes: notes.trim() || null,
      });
      if (error) throw error;
      setScriptureReference("");
      setNotes("");
      await queryClient.invalidateQueries({
        queryKey: ["bible-reading", userId, "free-readings"],
      });
      toast.success("Lectura registrada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la lectura.");
    } finally {
      setSaving(false);
    }
  };

  const loading =
    preferenceQuery.isLoading ||
    cycleQuery.isLoading ||
    (Boolean(cycleId) && completionsQuery.isLoading);
  const error =
    preferenceQuery.error ||
    cycleQuery.error ||
    completionsQuery.error ||
    freeReadingsQuery.error;

  if (error) {
    return <ErrorState message={error instanceof Error ? error.message : "No se pudo cargar el seguimiento bíblico."} />;
  }

  if (!userId || loading) {
    return <section className="glass rounded-2xl p-4 text-sm text-muted-foreground">Cargando el seguimiento de La Biblia…</section>;
  }

  const mode = preferenceQuery.data?.mode;

  return (
    <section className="glass space-y-4 rounded-2xl p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">La Biblia</h2>
          <p className="text-xs text-muted-foreground">
            Tu lectura y tu historial son personales. Puedes seguir el plan anual o leer libremente.
          </p>
        </div>
        {mode === "annual_plan" && (
          <Button size="sm" variant="outline" disabled={saving} onClick={() => void saveMode("free")}>
            Cambiar a lectura libre
          </Button>
        )}
        {mode === "free" && (
          <Button size="sm" variant="outline" disabled={saving} onClick={() => void saveMode("annual_plan")}>
            Activar plan anual
          </Button>
        )}
      </div>

      {!mode && (
        <div className="space-y-3 rounded-xl border p-3">
          <h3 className="font-medium">¿Cómo te gustaría leer La Biblia?</h3>
          <p className="text-sm text-muted-foreground">
            Puedes seguir el plan de 365 días con tres citas diarias o registrar tus lecturas a tu propio ritmo.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg bg-muted/40 p-3">
              <p className="font-medium text-sm">Plan de un año</p>
              <p className="text-xs text-muted-foreground">365 días, tres citas por día y avance anual.</p>
              <Input
                type="date"
                aria-label="Fecha de inicio del plan"
                value={cycleStartDate}
                onChange={(event) => setCycleStartDate(event.target.value)}
              />
              <Button size="sm" className="w-full" disabled={saving} onClick={() => void saveMode("annual_plan")}>
                Seguir el plan anual
              </Button>
            </div>
            <div className="space-y-2 rounded-lg bg-muted/40 p-3">
              <p className="font-medium text-sm">Lectura libre</p>
              <p className="text-xs text-muted-foreground">Registra pasajes, fechas y notas sin calendario obligatorio.</p>
              <Button size="sm" variant="outline" className="w-full" disabled={saving} onClick={() => void saveMode("free")}>
                Prefiero leer libremente
              </Button>
            </div>
          </div>
        </div>
      )}

      {mode === "annual_plan" && !cycleQuery.data && (
        <div className="space-y-3 rounded-xl border p-3">
          <p className="text-sm text-muted-foreground">Tu plan anual está seleccionado. Elige cuándo quieres comenzar este ciclo.</p>
          <Input
            type="date"
            aria-label="Fecha de inicio del ciclo"
            value={cycleStartDate}
            onChange={(event) => setCycleStartDate(event.target.value)}
          />
          <Button size="sm" disabled={saving} onClick={() => void startNewCycle()}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Iniciar ciclo de 365 días
          </Button>
        </div>
      )}

      {mode === "annual_plan" && cycleQuery.data && (
        <>
          <div className="space-y-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Progreso del ciclo</p>
                <p className="text-xs text-muted-foreground">
                  Inicio: {cycleQuery.data.start_date} · {completedCount} de 365 días completados
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{progress.toFixed(1)}%</p>
            </div>
            <Progress value={progress} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{365 - completedCount} días pendientes</span>
              <span>100% = 365 días</span>
            </div>
            {completedCount === 365 && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                ¡Completaste las 365 jornadas de este ciclo!
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium" htmlFor="bible-plan-month">Mes</label>
            <select
              id="bible-plan-month"
              className="h-9 min-w-36 rounded-md border bg-background px-3 text-sm"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {BIBLE_PLAN_MONTHS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              disabled={saving}
              onClick={() => {
                setCycleStartDate(localDateISO());
                void startNewCycle();
              }}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Nuevo ciclo
            </Button>
          </div>

          <div className="space-y-2">
            {visibleDays.map((item) => {
              const checked = completedDays.has(item.day);
              return (
                <div
                  key={item.day}
                  className={"flex items-start gap-3 rounded-xl border p-3 " + (checked ? "border-primary/30 bg-primary/5" : "")}
                >
                  <Checkbox
                    id={"bible-day-" + item.day}
                    checked={checked}
                    onCheckedChange={(value) => void toggleDay(item.day, value === true)}
                    aria-label={"Marcar día " + item.day + " como leído"}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <label htmlFor={"bible-day-" + item.day} className="cursor-pointer text-sm font-medium">
                      Día {item.day} · {item.month} {item.dayOfMonth}
                    </label>
                    <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-3">
                      {item.readings.map((reference, index) => (
                        <p key={index}>
                          <span className="text-xs font-medium text-foreground/70">Cita {index + 1}: </span>
                          {reference}
                        </p>
                      ))}
                    </div>
                    {checked && <p className="text-xs text-primary">Jornada marcada como leída</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Cada casilla representa una jornada completa con sus tres citas. El porcentaje se calcula sobre 365 jornadas, no sobre páginas ni minutos.
          </p>
        </>
      )}

      {mode === "free" && (
        <>
          <div className="rounded-xl border p-3">
            <h3 className="font-medium">Registrar lectura libre</h3>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              Anota el pasaje que leíste. No hay calendario ni porcentaje anual obligatorio.
            </p>
            <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
              <Input
                type="date"
                aria-label="Fecha de lectura"
                value={readingDate}
                onChange={(event) => setReadingDate(event.target.value)}
              />
              <Input
                placeholder="Ej. Salmos 23, Juan 3:1-21…"
                value={scriptureReference}
                onChange={(event) => setScriptureReference(event.target.value)}
              />
            </div>
            <textarea
              className="mt-2 min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="Notas o reflexiones (opcional)…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <Button
              className="mt-2"
              size="sm"
              disabled={saving || !scriptureReference.trim()}
              onClick={() => void saveFreeReading()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Guardar lectura
            </Button>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Historial de lectura libre</h3>
            {(freeReadingsQuery.data ?? []).length === 0 && (
              <p className="rounded-lg border p-3 text-sm text-muted-foreground">Todavía no tienes lecturas registradas.</p>
            )}
            {(freeReadingsQuery.data ?? []).map((item) => (
              <article key={item.id} className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">{item.reading_date}</p>
                <p className="font-medium text-sm">{item.scripture_reference}</p>
                {item.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p>}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
