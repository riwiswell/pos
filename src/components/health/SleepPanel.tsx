import { useEffect, useMemo, useState } from "react";
import { MoonStar, Save } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

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

  const history = useMemo(() => {
    return (historyQuery.data ?? [])
      .map((row) => {
        const details = readSleepDetails(row.notes);
        const hours =
          row.sleep_hours == null
            ? sleepDurationHours(details.bedtime, details.wakeTime)
            : Number(row.sleep_hours);
        return { date: row.metric_date, hours, details };
      })
      .filter((row): row is { date: string; hours: number; details: SleepDetails } =>
        row.hours !== null && Number.isFinite(row.hours) && row.hours > 0 && row.hours <= 24,
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map((row) => ({ ...row, label: shortDate(row.date) }));
  }, [historyQuery.data]);

  const average = history.length
    ? history.reduce((sum, row) => sum + row.hours, 0) / history.length
    : null;
  const latest = history.at(-1) ?? null;
  const maxHours = Math.max(10, Math.ceil(Math.max(...history.map((row) => row.hours), 0) + 1));

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
            <p className="text-[11px] text-muted-foreground">Registros graficados</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{history.length}</p>
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
        <div>
          <h3 className="font-semibold">Evolución del sueño</h3>
          <p className="text-xs text-muted-foreground">Hasta 30 registros recientes, ordenados por fecha.</p>
        </div>
        {historyQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando historial de sueño…</p>
        ) : historyQuery.isError ? (
          <p className="text-sm text-destructive">No se pudo cargar el historial de sueño.</p>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Todavía no hay duraciones de sueño para graficar. Guarda el primer registro y aparecerá aquí.
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
                <Bar dataKey="hours" name="Sueño" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} maxBarSize={48} />
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
          <label className="text-xs text-muted-foreground">
            Siesta (min)
            <Input className="mt-1" type="number" min="0" max="1440" step="5" value={sleepDetails.napMinutes} onChange={(event) => setSleepDetails((value) => ({ ...value, napMinutes: event.target.value }))} placeholder="0" />
          </label>
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
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cuando registres noches de sueño, aparecerán aquí.</p>
        ) : (
          <div className="space-y-2">
            {[...history].reverse().slice(0, 7).map((row) => (
              <article key={row.date} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{formatDayLabel(row.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.details.bedtime && row.details.wakeTime
                      ? `${row.details.bedtime} – ${row.details.wakeTime}`
                      : "Duración registrada manualmente"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{formatSleepHours(row.hours)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
