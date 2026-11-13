import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { MoonStar, Save, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useHealthMetricMutation, usePersonalDateList, usePersonalRecentList } from "@/hooks/use-personal-domains";
import { useProfile, useProfileMutations } from "@/hooks/use-profile";
import { formatDayLabel } from "@/lib/date";

const STRUCTURED_MARKER = "__POS_BODY_MEASURES__";

type SleepDetails = {
  bedtime: string;
  wakeTime: string;
  awakenings: string;
  napMinutes: string;
};

type HealthMetric = {
  id?: string;
  metric_date: string;
  sleep_hours: number | null;
  notes: string | null;
  [key: string]: unknown;
};

type StructuredNotes = {
  body: Record<string, unknown>;
  notes: string;
  sleep: Record<string, unknown>;
};

const EMPTY_SLEEP: SleepDetails = { bedtime: "", wakeTime: "", awakenings: "", napMinutes: "" };

function readStructuredNotes(note: string | null): StructuredNotes {
  if (!note) return { body: {}, notes: "", sleep: {} };
  try {
    const decoded = JSON.parse(note);
    if (decoded?.marker === STRUCTURED_MARKER) {
      return {
        body: decoded.body && typeof decoded.body === "object" ? decoded.body : {},
        notes: typeof decoded.notes === "string" ? decoded.notes : "",
        sleep: decoded.sleep && typeof decoded.sleep === "object" ? decoded.sleep : {},
      };
    }
  } catch {
    // Older plain-text notes are preserved as user notes.
  }
  return { body: {}, notes: note, sleep: {} };
}

function readSleepDetails(note: string | null): SleepDetails {
  const sleep = readStructuredNotes(note).sleep;
  return {
    bedtime: typeof sleep.bedtime === "string" ? sleep.bedtime : "",
    wakeTime: typeof sleep.wakeTime === "string" ? sleep.wakeTime : "",
    awakenings: sleep.awakenings == null ? "" : String(sleep.awakenings),
    napMinutes: sleep.napMinutes == null ? "" : String(sleep.napMinutes),
  };
}

function sleepDurationHours(bedtime: string, wakeTime: string): number | null {
  if (!bedtime || !wakeTime || bedtime === wakeTime) return null;
  const [bedHour, bedMinute] = bedtime.split(":").map(Number);
  const [wakeHour, wakeMinute] = wakeTime.split(":").map(Number);
  if ([bedHour, bedMinute, wakeHour, wakeMinute].some((value) => !Number.isFinite(value))) return null;
  let minutes = wakeHour * 60 + wakeMinute - (bedHour * 60 + bedMinute);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

function formatSleepHours(value: number): string {
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" })
    .format(new Date(date + "T12:00:00"))
    .replace(".", "");
}

export function SleepPanel() {
  const { date } = useGlobalDate();
  const navigate = useNavigate();
  const currentQuery = usePersonalDateList<HealthMetric>("health_metrics", "metric_date", date);
  const historyQuery = usePersonalRecentList<HealthMetric>("health_metrics", "metric_date", 100);
  const saveMetric = useHealthMetricMutation();
  const profileQuery = useProfile();
  const profileMutations = useProfileMutations();

  const current = currentQuery.data?.[0];
  const [sleepDetails, setSleepDetails] = useState<SleepDetails>(EMPTY_SLEEP);
  const [manualHours, setManualHours] = useState("");
  const [schedule, setSchedule] = useState({ bedtime: "", wakeTime: "" });

  useEffect(() => {
    setSleepDetails(readSleepDetails(current?.notes ?? null));
    setManualHours(current?.sleep_hours == null ? "" : String(current.sleep_hours));
  }, [current?.id, current?.metric_date, current?.notes, current?.sleep_hours]);

  useEffect(() => {
    const stored = profileQuery.data?.notification_preferences?.sleep_schedule;
    setSchedule({
      bedtime: typeof stored?.bedtime === "string" ? stored.bedtime : "",
      wakeTime: typeof stored?.wake_time === "string" ? stored.wake_time : "",
    });
  }, [profileQuery.data]);

  const calculatedHours = sleepDurationHours(sleepDetails.bedtime, sleepDetails.wakeTime);
  const hoursValue = calculatedHours ?? (manualHours.trim() ? Number(manualHours.replace(",", ".")) : null);

  // Keep every row that actually contains sleep information, even when its
  // duration is incomplete. The chart uses valid durations; the visible
  // history still shows incomplete records so a saved night is never hidden.
  const allSleepRecords = useMemo(() => {
    return (historyQuery.data ?? [])
      .map((row) => {
        const details = readSleepDetails(row.notes);
        const storedHours = row.sleep_hours == null ? null : Number(row.sleep_hours);
        const hasValidStoredHours =
          storedHours !== null && Number.isFinite(storedHours) && storedHours > 0 && storedHours <= 24;
        const recoveredHours = hasValidStoredHours
          ? storedHours
          : sleepDurationHours(details.bedtime, details.wakeTime);
        const hasSleepData =
          row.sleep_hours !== null && row.sleep_hours !== undefined ||
          Boolean(details.bedtime || details.wakeTime || details.awakenings || details.napMinutes);
        const hours = recoveredHours !== null && Number.isFinite(recoveredHours) &&
          recoveredHours > 0 && recoveredHours <= 24 ? recoveredHours : null;
        return { date: row.metric_date, hours, details, hasSleepData };
      })
      .filter((row) => row.hasSleepData)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map((row) => ({ ...row, label: shortDate(row.date) }));
  }, [historyQuery.data]);

  const history = useMemo(
    () => allSleepRecords.filter(
      (row): row is { date: string; hours: number; details: SleepDetails; hasSleepData: boolean; label: string } =>
        row.hours !== null,
    ),
    [allSleepRecords],
  );

  const average = history.length
    ? history.reduce((sum, row) => sum + row.hours, 0) / history.length
    : null;

  const weeklyComparison = useMemo(() => {
    const shiftDate = (offset: number) => {
      const value = new Date(date + "T12:00:00");
      value.setDate(value.getDate() + offset);
      return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
    };
    const currentStart = shiftDate(-6);
    const previousStart = shiftDate(-13);
    const currentWeek = history.filter((row) => row.date >= currentStart && row.date <= date);
    const previousWeek = history.filter((row) => row.date >= previousStart && row.date < currentStart);
    const mean = (rows: typeof history) => rows.length ? rows.reduce((sum, row) => sum + row.hours, 0) / rows.length : null;
    const currentAverage = mean(currentWeek);
    const previousAverage = mean(previousWeek);
    return {
      currentAverage,
      previousAverage,
      difference: currentAverage !== null && previousAverage !== null ? currentAverage - previousAverage : null,
      currentCount: currentWeek.length,
      previousCount: previousWeek.length,
    };
  }, [history, date]);
  const latest = history.at(-1) ?? null;
  const maxHours = Math.max(10, Math.ceil(Math.max(...history.map((row) => row.hours), 0) + 1));
  const sleepFingerprint = history.map((row) => row.date + ":" + row.hours.toFixed(2)).join("|");
  const personalSleepTarget = sleepDurationHours(schedule.bedtime, schedule.wakeTime);

  // The assistant reads the owner's Health + Diary records and reports only
  // patterns supported by dated sleep entries. The result is cached per data
  // fingerprint, so switching tabs does not call the model repeatedly.
  const sleepInsight = useQuery({
    queryKey: ["assistant", "sleep-insight", sleepFingerprint, personalSleepTarget ?? "no-personal-target"],
    enabled: !historyQuery.isLoading && !profileQuery.isLoading && history.length >= 3,
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        throw new Error("Tu sesión no está disponible para consultar la IA.");
      }

      const targetContext = personalSleepTarget === null
        ? "No he definido una duración objetivo; no etiquetes mis noches como buenas o malas. Describe solo tendencias y promedios reales."
        : "Mi horario habitual equivale a " + formatSleepHours(personalSleepTarget) + ". Puedes señalar noches consecutivas por debajo de mi propia referencia, pero no conviertas eso en un diagnóstico.";

      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer " + data.session.access_token,
        },
        body: JSON.stringify({
          message:
            "Dame una lectura proactiva y breve de mi descanso de los últimos 14 días. Cruza Salud con Diario y mis registros de sueños si aportan contexto. " +
            "Cuenta únicamente noches con fecha y duración válidas; nunca conviertas una fecha sin registro en cero ni inventes datos. " +
            "Indica cuántas noches consecutivas están por debajo de mi horario habitual solo si las fechas lo demuestran. " +
            targetContext +
            " Compara semanas solo cuando haya datos suficientes; si no, dilo. Ofrece un siguiente paso amable, sin alarmismo ni diagnóstico.",
          history: [],
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { answer?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo generar el análisis del descanso.");
      if (!result.answer?.trim()) throw new Error("La IA no devolvió una recomendación.");
      return result.answer.trim();
    },
  });

  const saveSleep = async () => {
    if (Boolean(sleepDetails.bedtime) !== Boolean(sleepDetails.wakeTime)) {
      throw new Error("Completa la hora de acostarte y la de levantarte.");
    }
    if (sleepDetails.bedtime && sleepDetails.bedtime === sleepDetails.wakeTime) {
      throw new Error("La hora de acostarte y la de levantarte no pueden ser iguales.");
    }
    if (!sleepDetails.bedtime && !sleepDetails.wakeTime && !manualHours.trim()) {
      throw new Error("Registra las horas de acostarte y levantarte, o indica la duración.");
    }

    const integers = [
      ["despertares", sleepDetails.awakenings, 0, 30],
      ["minutos de siesta", sleepDetails.napMinutes, 0, 1440],
    ] as const;
    for (const [label, raw, min, max] of integers) {
      if (!raw.trim()) continue;
      const value = Number(raw);
      if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`Revisa ${label}: debe estar entre ${min} y ${max}.`);
      }
    }
    if (calculatedHours === null && manualHours.trim()) {
      const manual = Number(manualHours.replace(",", "."));
      if (!Number.isFinite(manual) || manual <= 0 || manual > 24) {
        throw new Error("La duración debe ser un número mayor que 0 y máximo de 24 horas.");
      }
    }
    if (hoursValue === null || !Number.isFinite(hoursValue) || hoursValue <= 0 || hoursValue > 24) {
      throw new Error("No se pudo calcular una duración válida.");
    }

    const previous = readStructuredNotes(current?.notes ?? null);
    const notes = JSON.stringify({
      marker: STRUCTURED_MARKER,
      body: previous.body,
      notes: previous.notes,
      sleep: {
        bedtime: sleepDetails.bedtime || null,
        wakeTime: sleepDetails.wakeTime || null,
        awakenings: sleepDetails.awakenings === "" ? null : Number(sleepDetails.awakenings),
        napMinutes: sleepDetails.napMinutes === "" ? null : Number(sleepDetails.napMinutes),
      },
    });

    const preserved = Object.fromEntries(
      Object.entries(current ?? {}).filter(
        ([key]) => !["id", "user_id", "created_at", "updated_at"].includes(key),
      ),
    );

    await saveMetric.mutateAsync({
      ...preserved,
      metric_date: date,
      sleep_hours: hoursValue,
      notes,
    });
    toast.success("Registro de sueño guardado.");
  };

  const saveSchedule = async () => {
    const bedtime = schedule.bedtime.trim();
    const wakeTime = schedule.wakeTime.trim();
    if (Boolean(bedtime) !== Boolean(wakeTime)) {
      throw new Error("Completa las dos horas del horario habitual.");
    }
    if (bedtime && bedtime === wakeTime) {
      throw new Error("Las dos horas del horario habitual no pueden ser iguales.");
    }
    const notificationPreferences = {
      ...(profileQuery.data?.notification_preferences ?? {}),
      sleep_schedule: bedtime && wakeTime ? { bedtime, wake_time: wakeTime } : null,
    };
    await profileMutations.save.mutateAsync({ notification_preferences: notificationPreferences });
    toast.success(bedtime ? "Horario habitual guardado." : "Horario habitual eliminado.");
  };

  return (
    <div className="space-y-4">
      <section className="glass space-y-4 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10">
            <MoonStar className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h2 className="font-semibold">Sueño y descanso</h2>
            <p className="text-xs text-muted-foreground">
              Registra cada noche y revisa cómo cambia tu descanso con el paso de los días.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-background/60 p-3">
            <p className="text-[11px] text-muted-foreground">Promedio registrado</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {average === null ? "—" : `${average.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h`}
            </p>
          </div>
          <div className="rounded-xl border bg-background/60 p-3">
            <p className="text-[11px] text-muted-foreground">Registros recientes</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{allSleepRecords.length}</p>
            <p className="text-[10px] text-muted-foreground">{history.length} con duración válida</p>
          </div>
          <div className="rounded-xl border bg-background/60 p-3 col-span-2 sm:col-span-1">
            <p className="text-[11px] text-muted-foreground">Último registro</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {latest ? formatSleepHours(latest.hours) : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">{latest ? latest.date : "Aún sin datos"}</p>
          </div>
        </div>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div><h3 className="font-semibold">Comparación semanal</h3><p className="text-xs text-muted-foreground">Promedio de las últimas 7 noches frente a las 7 anteriores, hasta la fecha seleccionada.</p></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border bg-background/60 p-3"><p className="text-[11px] text-muted-foreground">Últimos 7 días</p><p className="mt-1 text-xl font-semibold tabular-nums">{weeklyComparison.currentAverage===null?"—":formatSleepHours(weeklyComparison.currentAverage)}</p><p className="text-[10px] text-muted-foreground">{weeklyComparison.currentCount} registros</p></div>
          <div className="rounded-xl border bg-background/60 p-3"><p className="text-[11px] text-muted-foreground">7 días anteriores</p><p className="mt-1 text-xl font-semibold tabular-nums">{weeklyComparison.previousAverage===null?"—":formatSleepHours(weeklyComparison.previousAverage)}</p><p className="text-[10px] text-muted-foreground">{weeklyComparison.previousCount} registros</p></div>
        </div>
        {weeklyComparison.difference!==null?<p className="text-xs text-muted-foreground">{weeklyComparison.difference>0.05?"Estás durmiendo en promedio "+formatSleepHours(weeklyComparison.difference)+" más por noche.":weeklyComparison.difference< -0.05?"Estás durmiendo en promedio "+formatSleepHours(Math.abs(weeklyComparison.difference))+" menos por noche.":"Tu promedio se mantiene prácticamente igual."}</p>:<p className="text-xs text-muted-foreground">Registra noches en ambos periodos para comparar las semanas.</p>}
      </section>

      <section className="glass space-y-3 rounded-2xl border border-primary/20 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-semibold">Lectura inteligente del descanso</h3>
            <p className="text-xs text-muted-foreground">La IA contrasta tus noches registradas con tu horario habitual y consulta el Diario cuando hay sueños que aportan contexto.</p>
          </div>
        </div>
        {history.length < 3 ? (
          <p className="text-sm text-muted-foreground">Aún hacen falta al menos 3 noches con duración válida para buscar una tendencia. Las fechas sin registro no se cuentan como cero.</p>
        ) : sleepInsight.isLoading ? (
          <p className="text-sm text-muted-foreground">Analizando tus registros de Salud y Diario…</p>
        ) : sleepInsight.isError ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{sleepInsight.error instanceof Error ? sleepInsight.error.message : "No se pudo generar el análisis."}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void sleepInsight.refetch()}>
              Volver a analizar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="whitespace-pre-wrap text-sm leading-6">{sleepInsight.data}</p>
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="ghost" onClick={() => void sleepInsight.refetch()}>
                Actualizar análisis
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div>
          <h3 className="font-semibold">Evolución del sueño</h3>
          <p className="text-xs text-muted-foreground">Hasta 30 noches con duración válida. Las noches incompletas siguen visibles en el historial.</p>
        </div>
        {historyQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando historial de sueño…</p>
        ) : historyQuery.isError ? (
          <p className="text-sm text-destructive">No se pudo cargar el historial de sueño.</p>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            {allSleepRecords.length > 0
              ? `Hay ${allSleepRecords.length} registro(s) de sueño guardados, pero falta una duración válida para graficarlos. Revisa “Últimos registros” y completa las horas.`
              : "Todavía no hay duraciones de sueño para graficar. Guarda el primer registro y aparecerá aquí."}
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, maxHours]}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value: number) => `${value} h`}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                  formatter={(value: number) => [formatSleepHours(Number(value)), "Duración"]}
                />
                <Bar dataKey="hours" name="Sueño" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} barSize={26} maxBarSize={26} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="glass space-y-4 rounded-2xl p-4">
        <div>
          <h3 className="font-semibold">Registrar sueño</h3>
          <p className="text-xs text-muted-foreground">
            Fecha seleccionada: {formatDayLabel(date)}. Si dormiste después de medianoche, el sistema calcula el cruce de día.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs text-muted-foreground">
            Me acosté
            <Input className="mt-1" type="time" value={sleepDetails.bedtime} onChange={(event) => setSleepDetails((value) => ({ ...value, bedtime: event.target.value }))} />
          </label>
          <label className="text-xs text-muted-foreground">
            Me levanté
            <Input className="mt-1" type="time" value={sleepDetails.wakeTime} onChange={(event) => setSleepDetails((value) => ({ ...value, wakeTime: event.target.value }))} />
          </label>
          <label className="text-xs text-muted-foreground">
            Duración (horas)
            <Input className="mt-1" inputMode="decimal" value={calculatedHours !== null ? calculatedHours.toFixed(2) : manualHours} readOnly={calculatedHours !== null} onChange={(event) => setManualHours(event.target.value)} placeholder="Ej. 7,5" />
          </label>
          <label className="text-xs text-muted-foreground">
            Despertares
            <Input className="mt-1" type="number" min="0" max="30" step="1" value={sleepDetails.awakenings} onChange={(event) => setSleepDetails((value) => ({ ...value, awakenings: event.target.value }))} placeholder="0" />
          </label>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <label className="min-w-0 text-xs text-muted-foreground">
              Siesta (min)
              <Input className="mt-1" type="number" min="0" max="1440" step="5" value={sleepDetails.napMinutes} onChange={(event) => setSleepDetails((value) => ({ ...value, napMinutes: event.target.value }))} placeholder="0" />
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 whitespace-nowrap px-2 text-xs"
              onClick={() => void navigate({ to: "/diario", search: { capture: "dream" } })}
            >
              <MoonStar className="mr-1 h-3.5 w-3.5" />
              Sueño (soñar)
            </Button>
          </div>
        </div>
        {hoursValue !== null && Number.isFinite(hoursValue) && hoursValue > 0 && (
          <p className="text-xs text-muted-foreground">Duración calculada: {formatSleepHours(hoursValue)}</p>
        )}
        <Button
          disabled={currentQuery.isLoading || currentQuery.isError || saveMetric.isPending}
          onClick={() => void saveSleep().catch((error) => toast.error(error instanceof Error ? error.message : "No se pudo guardar el registro de sueño."))}
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMetric.isPending ? "Guardando…" : "Guardar registro de sueño"}
        </Button>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div>
          <h3 className="font-semibold">Mi horario habitual</h3>
          <p className="text-xs text-muted-foreground">Es tu referencia diaria, independiente de las horas reales que registres.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">
            Quiero acostarme a
            <Input className="mt-1" type="time" value={schedule.bedtime} onChange={(event) => setSchedule((value) => ({ ...value, bedtime: event.target.value }))} />
          </label>
          <label className="text-xs text-muted-foreground">
            Quiero levantarme a
            <Input className="mt-1" type="time" value={schedule.wakeTime} onChange={(event) => setSchedule((value) => ({ ...value, wakeTime: event.target.value }))} />
          </label>
          <div className="flex flex-col justify-end rounded-lg border bg-background px-3 py-2">
            <span className="text-[11px] text-muted-foreground">Descanso previsto</span>
            <span className="text-base font-semibold tabular-nums">
              {sleepDurationHours(schedule.bedtime, schedule.wakeTime)?.toLocaleString("es-CO", { maximumFractionDigits: 1 }) ?? "—"} h
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={profileQuery.isLoading || profileMutations.save.isPending} onClick={() => void saveSchedule().catch((error) => toast.error(error instanceof Error ? error.message : "No se pudo guardar el horario habitual."))}>
            {profileMutations.save.isPending ? "Guardando…" : "Guardar horario habitual"}
          </Button>
          {(schedule.bedtime || schedule.wakeTime) && (
            <Button size="sm" variant="ghost" onClick={() => setSchedule({ bedtime: "", wakeTime: "" })}>Limpiar</Button>
          )}
        </div>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h3 className="font-semibold">Últimos registros</h3>
        {allSleepRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cuando registres noches de sueño, aparecerán aquí.</p>
        ) : (
          <div className="space-y-2">
            {[...allSleepRecords].reverse().slice(0, 7).map((row) => (
              <article key={row.date} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatDayLabel(row.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.details.bedtime && row.details.wakeTime
                      ? `${row.details.bedtime} – ${row.details.wakeTime}`
                      : row.details.bedtime
                        ? `Me acosté a las ${row.details.bedtime} · falta la hora de levantarse`
                        : row.details.wakeTime
                          ? `Me levanté a las ${row.details.wakeTime} · falta la hora de acostarse`
                          : row.hours !== null
                            ? "Duración registrada manualmente"
                            : "Duración no registrada"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {row.hours === null ? <span className="text-xs font-medium text-amber-600">Incompleto</span> : formatSleepHours(row.hours)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
