import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, CheckCircle2, ChevronDown, Clock3, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { addDaysISO, todayISO } from "@/lib/date";
import { BIBLE_PLAN_MONTHS, BIBLE_READING_PLAN, biblePlanProgress } from "@/domain/bible-reading-plan";

const db = supabase as any;
type Cycle = {
  id: string;
  user_id: string;
  learning_item_id: string;
  mode: "annual_plan" | "free";
  start_date: string;
  status: "active" | "completed" | "paused";
  completed_at: string | null;
};
type DayProgress = {
  id: string;
  cycle_id: string;
  day_number: number;
  first_done: boolean;
  second_done: boolean;
  third_done: boolean;
  completed_at: string | null;
};
type FreeReading = { id: string; reading_date: string; passage: string; note: string | null };

function dayNumberForDate(startDate: string, date: string) {
  const start = new Date(startDate + "T12:00:00");
  const target = new Date(date + "T12:00:00");
  return Math.floor((target.getTime() - start.getTime()) / 86_400_000) + 1;
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(date + "T12:00:00")).replace(".", "");
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar tu lectura.";
}

export function BibleReadingPanel({ learningItemId }: { learningItemId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [passage, setPassage] = useState("");
  const [readingDate, setReadingDate] = useState(todayISO());
  const [note, setNote] = useState("");

  const cyclesQuery = useQuery({
    queryKey: ["bible-reading-cycles", learningItemId],
    queryFn: async () => {
      const { data, error } = await db.from("bible_reading_cycles").select("*")
        .eq("learning_item_id", learningItemId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Cycle[];
    },
    enabled: Boolean(user?.id),
  });
  const preferenceQuery = useQuery({
    queryKey: ["bible-reading-preference", user?.id],
    queryFn: async () => {
      if (!user?.id) return { mode: "annual_plan" as const };
      const { data, error } = await db.from("bible_reading_preferences")
        .select("mode").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return { mode: data?.mode === "free" ? "free" as const : "annual_plan" as const };
    },
    enabled: Boolean(user?.id),
  });
  const preferredMode = preferenceQuery.data?.mode ?? "annual_plan";
  const activeCycle = (cyclesQuery.data ?? []).find((cycle) => cycle.status === "active") ?? null;
  const latestCycle = (cyclesQuery.data ?? [])[0] ?? null;

  const progressQuery = useQuery({
    queryKey: ["bible-reading-progress", activeCycle?.id],
    queryFn: async () => {
      if (!activeCycle) return [] as DayProgress[];
      const { data, error } = await db.from("bible_reading_day_progress").select("*")
        .eq("cycle_id", activeCycle.id).order("day_number");
      if (error) throw error;
      return (data ?? []) as DayProgress[];
    },
    enabled: activeCycle?.mode === "annual_plan",
  });
  const freeReadingsQuery = useQuery({
    queryKey: ["bible-free-readings", learningItemId],
    queryFn: async () => {
      const { data, error } = await db.from("bible_free_readings").select("*")
        .eq("learning_item_id", learningItemId).order("reading_date", { ascending: false }).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as FreeReading[];
    },
    enabled: activeCycle?.mode === "free",
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["bible-reading-cycles", learningItemId] });
    void queryClient.invalidateQueries({ queryKey: ["bible-reading-progress"] });
    void queryClient.invalidateQueries({ queryKey: ["bible-free-readings", learningItemId] });
  };

  const createCycle = useMutation({
    mutationFn: async (mode: "annual_plan" | "free") => {
      if (!user?.id) throw new Error("Inicia sesión para guardar tu plan.");
      const { error: pauseError } = await db.from("bible_reading_cycles")
        .update({ status: "paused" }).eq("user_id", user.id).eq("learning_item_id", learningItemId).eq("status", "active");
      if (pauseError) throw pauseError;
      const { data, error } = await db.from("bible_reading_cycles").insert({
        user_id: user.id, learning_item_id: learningItemId, mode, start_date: todayISO(), status: "active",
      }).select("*").single();
      if (error) throw error;
      const { error: preferenceError } = await db.from("bible_reading_preferences")
        .upsert({ user_id: user.id, mode }, { onConflict: "user_id" });
      if (preferenceError) throw preferenceError;
      return data as Cycle;
    },
    onSuccess: (cycle) => {
      setSelectedMonth(0);
      void queryClient.invalidateQueries({ queryKey: ["bible-reading-cycles", learningItemId] });
      toast.success(cycle.mode === "annual_plan" ? "Plan anual activado. ¡Vamos día a día!" : "Lectura libre activada.");
    },
    onError: (error) => toast.error(message(error)),
  });

  const saveDay = useMutation({
    mutationFn: async ({ day, field, checked }: { day: number; field: "first_done" | "second_done" | "third_done"; checked: boolean }) => {
      if (!user?.id || !activeCycle) throw new Error("No hay un ciclo anual activo.");
      const existing = progressByDay.get(day);
      const values = {
        first_done: Boolean(existing?.first_done),
        second_done: Boolean(existing?.second_done),
        third_done: Boolean(existing?.third_done),
        [field]: checked,
      };
      const completed = values.first_done && values.second_done && values.third_done;
      const { error } = await db.from("bible_reading_day_progress").upsert({
        cycle_id: activeCycle.id, user_id: user.id, day_number: day,
        ...values, completed_at: completed ? new Date().toISOString() : null,
      }, { onConflict: "cycle_id,day_number" });
      if (error) throw error;
      return { completed };
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["bible-reading-progress", activeCycle?.id] }),
    onError: (error) => toast.error(message(error)),
  });

  const finishCycle = useMutation({
    mutationFn: async () => {
      if (!activeCycle) return;
      const { error } = await db.from("bible_reading_cycles").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", activeCycle.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (error) => toast.error(message(error)),
  });

  // La preferencia inicial de la base de datos es el plan anual.
  // Solo se crea automáticamente el primer ciclo; nunca se reinicia un historial existente.
  useEffect(() => {
    if (!user?.id || !cyclesQuery.isSuccess || !preferenceQuery.isSuccess) return;
    if ((cyclesQuery.data ?? []).length > 0 || preferredMode !== "annual_plan") return;
    if (!createCycle.isPending && !createCycle.isSuccess) createCycle.mutate("annual_plan");
  }, [
    user?.id,
    cyclesQuery.isSuccess,
    cyclesQuery.data?.length,
    preferenceQuery.isSuccess,
    preferredMode,
    createCycle.isPending,
    createCycle.isSuccess,
  ]);

  const addFreeReading = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Inicia sesión para guardar tu lectura.");
      if (!passage.trim()) throw new Error("Escribe el pasaje que leíste.");
      const { error } = await db.from("bible_free_readings").insert({
        user_id: user.id, learning_item_id: learningItemId, reading_date: readingDate,
        passage: passage.trim(), note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPassage("");
      setNote("");
      refresh();
      toast.success("Lectura guardada en tu historial.");
    },
    onError: (error) => toast.error(message(error)),
  });

  const progressRows = progressQuery.data ?? [];
  const progressByDay = useMemo(() => new Map(progressRows.map((row) => [row.day_number, row])), [progressRows]);
  const completedDays = progressRows.filter((row) => row.first_done && row.second_done && row.third_done).length;
  const partialDays = progressRows.filter((row) => Number(row.first_done) + Number(row.second_done) + Number(row.third_done) > 0 && !(row.first_done && row.second_done && row.third_done)).length;
  const percent = biblePlanProgress(completedDays);
  const currentDayNumber = activeCycle?.mode === "annual_plan" ? dayNumberForDate(activeCycle.start_date, todayISO()) : 0;
  const currentPlanMonth = BIBLE_READING_PLAN[Math.max(0, Math.min(364, currentDayNumber - 1))]?.monthIndex ?? 0;

  useEffect(() => {
    if (activeCycle?.mode === "annual_plan") setSelectedMonth(currentPlanMonth);
  }, [activeCycle?.id, currentPlanMonth]);

  useEffect(() => {
    if (activeCycle?.mode === "annual_plan" && completedDays === 365 && activeCycle.status === "active" && !finishCycle.isPending) {
      finishCycle.mutate();
    }
  }, [activeCycle?.id, activeCycle?.mode, activeCycle?.status, completedDays]);

  const todayPlanDay = activeCycle?.mode === "annual_plan" && currentDayNumber >= 1 && currentDayNumber <= 365
    ? BIBLE_READING_PLAN[currentDayNumber - 1]
    : undefined;
  const month = BIBLE_PLAN_MONTHS[selectedMonth];
  const monthProgress = month?.days.filter((day) => {
    const row = progressByDay.get(day.dayNumber);
    return row?.first_done && row?.second_done && row?.third_done;
  }).length ?? 0;

  if (cyclesQuery.isLoading || preferenceQuery.isLoading) return <div className="rounded-xl border p-3 text-sm text-muted-foreground">Cargando tu modo de lectura bíblica…</div>;
  if (cyclesQuery.isError || preferenceQuery.isError) return <div className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{message(cyclesQuery.error ?? preferenceQuery.error)}</div>;

  if (!activeCycle && !latestCycle && preferredMode === "annual_plan" && (createCycle.isPending || createCycle.isSuccess)) {
    return <div className="rounded-xl border p-3 text-sm text-muted-foreground">Preparando tu plan anual de lectura…</div>;
  }

  if (!activeCycle && latestCycle?.status === "completed") {
    return (
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary"/><h3 className="font-semibold">¡Completaste la lectura de la Biblia!</h3></div>
        <p className="mt-1 text-sm text-muted-foreground">Tu ciclo quedó guardado con sus 365 días. Puedes empezar otro año cuando quieras.</p>
        <Button className="mt-3" onClick={() => createCycle.mutate(latestCycle.mode)} disabled={createCycle.isPending}>Iniciar otro año de lectura</Button>
      </section>
    );
  }

  if (!activeCycle) {
    return (
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary"/><h3 className="font-semibold">¿Cómo quieres leer la Biblia?</h3></div>
        <p className="mt-1 text-sm text-muted-foreground">Puedes seguir el plan diario de un año, con tres pasajes al día, o llevar una lectura completamente libre.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" className="rounded-xl border bg-background p-3 text-left transition hover:border-primary" onClick={() => createCycle.mutate("annual_plan")} disabled={createCycle.isPending}>
            <span className="text-lg">📅</span><p className="mt-1 font-semibold">Plan de un año</p><p className="mt-1 text-xs text-muted-foreground">365 días · tres lecturas diarias · porcentaje anual.</p>
          </button>
          <button type="button" className="rounded-xl border bg-background p-3 text-left transition hover:border-primary" onClick={() => createCycle.mutate("free")} disabled={createCycle.isPending}>
            <span className="text-lg">📖</span><p className="mt-1 font-semibold">Lectura libre</p><p className="mt-1 text-xs text-muted-foreground">Registra el pasaje que leas, en el orden que quieras y sin calendario.</p>
          </button>
        </div>
      </section>
    );
  }

  if (activeCycle.mode === "free") {
    return (
      <section className="space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Modo libre</p><h3 className="font-semibold">Tu lectura bíblica</h3><p className="text-xs text-muted-foreground">Sin días obligatorios ni porcentaje anual.</p></div><Button size="sm" variant="outline" onClick={() => createCycle.mutate("annual_plan")} disabled={createCycle.isPending}>Cambiar al plan anual</Button></div>
        <div className="grid gap-2 sm:grid-cols-[150px_1fr]"><label className="text-xs text-muted-foreground">Fecha<Input className="mt-1" type="date" value={readingDate} onChange={(event) => setReadingDate(event.target.value)}/></label><label className="text-xs text-muted-foreground">Pasaje leído<Input className="mt-1" value={passage} onChange={(event) => setPassage(event.target.value)} placeholder="Ej. Génesis 1–3"/></label></div>
        <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota o reflexión (opcional)"/>
        <Button size="sm" disabled={!passage.trim() || addFreeReading.isPending} onClick={() => addFreeReading.mutate()}>Guardar lectura</Button>
        <div className="space-y-2 border-t pt-3"><h4 className="text-sm font-semibold">Historial libre</h4>{(freeReadingsQuery.data ?? []).map((entry) => <article key={entry.id} className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{entry.reading_date}</p><p className="font-medium">{entry.passage}</p>{entry.note && <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p>}</article>)}{(freeReadingsQuery.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Todavía no has guardado pasajes.</p>}</div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-cyan-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.15em] text-primary">Plan anual</p><h3 className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4"/>La Biblia en 365 días</h3><p className="mt-1 text-xs text-muted-foreground">Comenzaste el {activeCycle.start_date}. Cada día tiene tres pasajes; el día suma al porcentaje solo cuando completas los tres.</p></div>
        <div className="flex flex-col items-end gap-2"><div className="rounded-xl bg-background/80 px-3 py-2 text-right"><p className="text-2xl font-bold tabular-nums">{percent}%</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{completedDays}/365 días completos</p></div><Button size="sm" variant="outline" onClick={() => createCycle.mutate("free")} disabled={createCycle.isPending}>Cambiar a lectura libre</Button></div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: percent + "%" }}/></div>
      <div className="grid grid-cols-3 gap-2"><div className="rounded-xl border bg-background/70 p-2.5"><p className="text-lg font-semibold tabular-nums">{completedDays}</p><p className="text-[10px] text-muted-foreground">Días completos</p></div><div className="rounded-xl border bg-background/70 p-2.5"><p className="text-lg font-semibold tabular-nums">{partialDays}</p><p className="text-[10px] text-muted-foreground">Días empezados</p></div><div className="rounded-xl border bg-background/70 p-2.5"><p className="text-lg font-semibold tabular-nums">{365 - completedDays}</p><p className="text-[10px] text-muted-foreground">Días por completar</p></div></div>
      {todayPlanDay && <div className="rounded-2xl border border-primary/30 bg-background/80 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Lecturas de hoy · Día {todayPlanDay.dayNumber}</p><p className="text-xs text-muted-foreground">{displayDate(addDaysISO(activeCycle.start_date, currentDayNumber - 1))}</p></div><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Hoy</span></div><p className="mt-2 text-sm">{todayPlanDay.references.join(" · ")}</p></div>}
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary"/><h4 className="text-sm font-semibold">Plan completo</h4></div><span className="text-xs text-muted-foreground">{monthProgress}/{month?.days.length ?? 0} días del mes completos</span></div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-12">
        {BIBLE_PLAN_MONTHS.map((item, index) => <button key={item.name} type="button" onClick={() => setSelectedMonth(index)} className={"rounded-lg border px-1.5 py-2 text-xs transition " + (index === selectedMonth ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-background/70 text-muted-foreground hover:bg-accent")}>{item.name.slice(0,3)}</button>)}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          (month?.days ?? []).filter((day) => day.dayOfMonth <= 15),
          (month?.days ?? []).filter((day) => day.dayOfMonth >= 16),
        ].map((columnDays, columnIndex) => (
          <div key={columnIndex} className="min-w-0 space-y-1.5">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {columnIndex === 0 ? "Días 1–15" : "Días 16–31"}
            </p>
            {columnDays.map((day) => {
              const row = progressByDay.get(day.dayNumber);
              const flags = [Boolean(row?.first_done), Boolean(row?.second_done), Boolean(row?.third_done)];
              const completed = flags.every(Boolean);
              const partial = flags.some(Boolean);
              const doneCount = flags.filter(Boolean).length;
              const assignedDate = addDaysISO(activeCycle.start_date, day.dayNumber - 1);
              return (
                <article key={day.dayNumber} className={"flex min-w-0 gap-2 rounded-lg border p-2 " + (day.dayNumber === currentDayNumber ? "border-primary/50 bg-primary/5" : "bg-background/65")}>
                  <div className="w-[4.5rem] shrink-0">
                    <p className="text-xs font-semibold tabular-nums">Día {day.dayOfMonth}</p>
                    <p className="text-[10px] text-muted-foreground">{displayDate(assignedDate)}</p>
                    <span className={"mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium " + (completed ? "bg-emerald-500/10 text-emerald-600" : partial ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      {completed ? "Completo" : `${doneCount}/3`}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    {day.references.map((reference, index) => {
                      const field = (["first_done","second_done","third_done"] as const)[index]!;
                      return (
                        <label key={field} className={"flex min-w-0 items-start gap-1.5 rounded px-1.5 py-1 text-[11px] leading-snug transition " + (flags[index] ? "bg-primary/5" : "bg-muted/40 hover:bg-muted")}>
                          <Checkbox checked={flags[index]} disabled={saveDay.isPending} onCheckedChange={(checked) => saveDay.mutate({ day: day.dayNumber, field, checked: Boolean(checked) })}/>
                          <span className={"min-w-0 break-words " + (flags[index] ? "text-muted-foreground line-through" : "font-medium")}>{reference}</span>
                        </label>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      </div>
      <p className="flex items-start gap-2 text-[11px] text-muted-foreground"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0"/>No se pierde el avance si te atrasas: puedes marcar cualquier día y continuar a tu ritmo. El porcentaje cuenta días con las tres lecturas completas, no casillas sueltas.</p>
      {latestCycle?.status === "completed" && <Button onClick={() => createCycle.mutate("annual_plan")} disabled={createCycle.isPending}><Sparkles className="mr-1 h-4 w-4"/>Comenzar otro año</Button>}
    </section>
  );
}
