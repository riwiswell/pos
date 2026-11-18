import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, MoonStar, Pencil, Save, Sparkles, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useDeleteSleepSessionMutation, usePersonalRecentList, useSleepSessionsMutation, useUpdateSleepSessionMutation } from "@/hooks/use-personal-domains";
import { useProfile, useProfileMutations } from "@/hooks/use-profile";
import { addDaysISO, formatDayLabel } from "@/lib/date";
import { describeError } from "@/lib/error-message";
import { subscribeToBackgroundPush } from "@/services/push.service";
import { syncSleepScheduleReminder } from "@/services/sleep-notifications.service";

const STRUCTURED_MARKER = "__POS_BODY_MEASURES__";

type SleepSession = { id:string; startDate:string; bedtime:string; endDate:string; wakeTime:string; kind:"sleep"|"nap" };

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

function createEmptySleepSession(date:string):SleepSession {
 return {id:typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"?crypto.randomUUID():`sleep-${Date.now()}-${Math.random().toString(36).slice(2)}`,startDate:date,bedtime:"",endDate:date,wakeTime:"",kind:"sleep"};
}
function sleepSessionDurationHours(session:SleepSession):number|null {
 const dp=/^(\d{4})-(\d{2})-(\d{2})$/,tp=/^(\d{2}):(\d{2})$/;
 const sd=dp.exec(session.startDate),ed=dp.exec(session.endDate),st=tp.exec(session.bedtime),et=tp.exec(session.wakeTime);
 if(!sd||!ed||!st||!et)return null;
 const mins=(d:RegExpExecArray,t:RegExpExecArray)=>{
  const y=+d[1],m=+d[2],day=+d[3],h=+t[1],minute=+t[2];
  if(m<1||m>12||h>23||minute>59)return null;
  const ms=Date.UTC(y,m-1,day,h,minute),check=new Date(ms);
  if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==day)return null;
  return Math.floor(ms/60000);
 };
 const a=mins(sd,st),b=mins(ed,et);
 if(a===null||b===null||b<=a||b-a>1440)return null;
 return Math.round(((b-a)/60)*100)/100;
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
  const historyQuery = usePersonalRecentList<HealthMetric>("health_metrics", "metric_date", 100);
  const saveSessions = useSleepSessionsMutation();
  const deleteSleepSession = useDeleteSleepSessionMutation();
  const updateSleepSession = useUpdateSleepSessionMutation();
  const [sessionPendingDelete, setSessionPendingDelete] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<{ key: string; metricDate: string; session: SleepSession } | null>(null);
  const profileQuery = useProfile();
  const profileMutations = useProfileMutations({ quietSave: true });
  const [schedule,setSchedule]=useState({bedtime:"",wakeTime:"",reminderMinutes:20});
  const [pushBusy,setPushBusy]=useState(false);
  const [pendingSessions,setPendingSessions]=useState<SleepSession[]>(()=>[createEmptySleepSession(date)]);
  useEffect(()=>{
    setPendingSessions(items=>items.length===1&&!items[0].bedtime&&!items[0].wakeTime?[createEmptySleepSession(date)]:items);
  },[date]);
  const enteredSessions=pendingSessions.filter(s=>s.bedtime||s.wakeTime);
  const pendingDurations=enteredSessions.map(sleepSessionDurationHours);
  const calculatedHours=pendingDurations.length>0&&pendingDurations.every(v=>v!==null)
    ?Math.round(pendingDurations.reduce((sum,v)=>sum+(v??0),0)*100)/100:null;

  useEffect(() => {
    const stored = profileQuery.data?.notification_preferences?.sleep_schedule;
    setSchedule({
      bedtime: typeof stored?.bedtime === "string" ? stored.bedtime : "",
      wakeTime: typeof stored?.wake_time === "string" ? stored.wake_time : "",
      reminderMinutes: [15, 20, 30].includes(Number(stored?.reminder_minutes)) ? Number(stored?.reminder_minutes) : 20,
    });
  }, [profileQuery.data]);

  const allSleepRecords = useMemo(() => {
    return (historyQuery.data ?? []).map((row) => {
      const details=readSleepDetails(row.notes),sleep=readStructuredNotes(row.notes).sleep;
      const storedHours=row.sleep_hours==null?null:Number(row.sleep_hours);
      const hasValidStoredHours=storedHours!==null&&Number.isFinite(storedHours)&&storedHours>0&&storedHours<=24;
      const raw=Array.isArray(sleep.sessions)?sleep.sessions:[];
      const sessions:SleepSession[]=raw.length?raw.map((item:any,index:number)=>{
        const bedtime=typeof item?.bedtime==="string"?item.bedtime:"",wakeTime=typeof item?.wakeTime==="string"?item.wakeTime:"";
        const startDate=typeof item?.startDate==="string"?item.startDate:typeof item?.start_date==="string"?item.start_date:row.metric_date;
        const endDate=typeof item?.endDate==="string"?item.endDate:typeof item?.end_date==="string"?item.end_date:bedtime&&wakeTime&&wakeTime<bedtime?addDaysISO(startDate,1):startDate;
        return {id:typeof item?.id==="string"?item.id:`legacy-${row.metric_date}-${index}`,startDate,bedtime,endDate,wakeTime,kind:item?.kind==="nap"?"nap" as const:"sleep" as const};
      }).filter(s=>s.bedtime&&s.wakeTime):details.bedtime&&details.wakeTime?[{
        id:`legacy-${row.metric_date}-main`,startDate:row.metric_date,bedtime:details.bedtime,
        endDate:details.wakeTime<details.bedtime?addDaysISO(row.metric_date,1):row.metric_date,
        wakeTime:details.wakeTime,kind:"sleep" as const,
      }]:[];
      const sessionTotal=sessions.length?sessions.reduce((sum,s)=>sum+(sleepSessionDurationHours(s)??0),0):null;
      const recovered=hasValidStoredHours?storedHours:sessionTotal!==null?sessionTotal:sleepDurationHours(details.bedtime,details.wakeTime);
      const hasSleepData=row.sleep_hours!==null&&row.sleep_hours!==undefined||
        Boolean(details.bedtime||details.wakeTime||details.awakenings||details.napMinutes)||(Array.isArray(sleep.sessions)&&sleep.sessions.length>0);
      const hours=recovered!==null&&Number.isFinite(recovered)&&recovered>0&&recovered<=24?recovered:null;
      return {date:row.metric_date,hours,details,sessions,hasSleepData};
    }).filter(row=>row.hasSleepData).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30).map(row=>({...row,label:shortDate(row.date)}));
  },[historyQuery.data]);

  const history = useMemo(
    () => allSleepRecords.filter(
      (row): row is { date: string; hours: number; details: SleepDetails; sessions: SleepSession[]; hasSleepData: boolean; label: string } =>
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

  const saveSleep=async()=>{
    const sessions=pendingSessions.filter(s=>s.bedtime||s.wakeTime);
    if(!sessions.length)throw new Error("Añade al menos un periodo de sueño con hora de inicio y fin.");
    for(const [index,session] of sessions.entries()){
      if(!session.startDate||!session.endDate||!session.bedtime||!session.wakeTime)throw new Error(`Completa las fechas y horas del periodo ${index+1}.`);
      if(sleepSessionDurationHours(session)===null)throw new Error(`Revisa el periodo ${index+1}: la finalización debe ser posterior al inicio y no superar 24 horas.`);
    }
    await saveSessions.mutateAsync(sessions);
    setPendingSessions([createEmptySleepSession(date)]);
    toast.success("Sesión guardada. Los registros anteriores se conservaron.");
  };

  const saveEditedSession = async () => {
    if (!editingSession) return;
    const { metricDate, session } = editingSession;
    if (!session.startDate || !session.endDate || !session.bedtime || !session.wakeTime) {
      throw new Error("Completa las fechas y horas del periodo.");
    }
    if (sleepSessionDurationHours(session) === null) {
      throw new Error("Revisa el periodo: la finalización debe ser posterior al inicio y no superar 24 horas.");
    }
    await updateSleepSession.mutateAsync({ metricDate, sessionId: session.id, session });
    setEditingSession(null);
    setSessionPendingDelete(null);
    toast.success(metricDate === session.startDate
      ? "Periodo de sueño actualizado."
      : "Periodo actualizado y trasladado a la fecha correcta.");
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
    if (bedtime && ![15, 20, 30].includes(schedule.reminderMinutes)) {
      throw new Error("Elige un aviso de 15, 20 o 30 minutos.");
    }
    const notificationPreferences = {
      ...(profileQuery.data?.notification_preferences ?? {}),
      sleep_schedule: bedtime && wakeTime ? {
        bedtime,
        wake_time: wakeTime,
        reminder_minutes: schedule.reminderMinutes,
      } : null,
    };
    await profileMutations.save.mutateAsync({ notification_preferences: notificationPreferences });
    try {
      const result = await syncSleepScheduleReminder(bedtime || null, bedtime ? schedule.reminderMinutes : null);
      if (result === "scheduled") {
        toast.success("Horario guardado. Te avisaré " + schedule.reminderMinutes + " minutos antes de acostarte.");
      } else if (result === "push-not-enabled") {
        toast.warning("Horario guardado. Activa las notificaciones en este dispositivo para recibir el aviso.");
      } else {
        toast.success("Horario habitual eliminado y aviso cancelado.");
      }
    } catch (error) {
      toast.error("Horario guardado, pero no se pudo programar el aviso: " + describeError(error, "Error de notificaciones."), { duration: 10000 });
    }
  };

  const activateSleepNotifications = async () => {
    setPushBusy(true);
    try {
      const result = await subscribeToBackgroundPush();
      if (result !== "subscribed") {
        const messages: Record<string, string> = {
          unsupported: "Este navegador no admite notificaciones push.",
          "permission-denied": "Permite las notificaciones del navegador para continuar.",
          "missing-key": "Falta configurar las claves VAPID en Cloudflare.",
          "no-session": "Tu sesión ha caducado. Inicia sesión e inténtalo de nuevo.",
          failed: "No se pudo registrar este dispositivo para notificaciones.",
        };
        throw new Error(messages[result] ?? "No se pudieron activar las notificaciones.");
      }
      if (Boolean(schedule.bedtime) !== Boolean(schedule.wakeTime)) {
        throw new Error("Completa las dos horas del horario habitual antes de activar el aviso.");
      }
      if (schedule.bedtime && schedule.wakeTime) {
        // Persist the latest edited hours and offset before creating the push job;
        // the Worker checks that queued reminders still match the saved profile.
        await saveSchedule();
      } else {
        toast.success("Notificaciones activadas en este dispositivo. Define tu horario habitual para programar el aviso diario.");
      }
    } catch (error) {
      toast.error(describeError(error, "No se pudieron activar los avisos."), { duration: 10000 });
    } finally {
      setPushBusy(false);
    }
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
                <Bar dataKey="hours" name="Sueño" fill="var(--chart-bar, var(--primary))" radius={[5, 5, 0, 0]} barSize={26} maxBarSize={26} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="glass space-y-4 rounded-2xl p-4">
        <div>
          <h3 className="font-semibold">Registrar sesiones de sueño</h3>
          <p className="text-xs text-muted-foreground">Cada periodo se guarda por separado con su propia fecha y hora. Puedes registrar varios periodos de días distintos. Añadir una sesión nunca reemplaza las anteriores.</p>
        </div>
        <div className="space-y-3">
          {pendingSessions.map((session,index)=>{
            const duration=sleepSessionDurationHours(session);
            return <div key={session.id} className="space-y-3 rounded-xl border bg-background/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Periodo {index+1}</p>
                <div className="flex items-center gap-2">
                  {duration!==null&&<span className="text-xs text-muted-foreground">{formatSleepHours(duration)}</span>}
                  {pendingSessions.length>1&&<Button type="button" size="icon" variant="ghost" aria-label={`Quitar periodo ${index+1}`} onClick={()=>setPendingSessions(items=>items.filter(item=>item.id!==session.id))}>×</Button>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <label className="text-xs text-muted-foreground">Tipo
                  <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={session.kind}
                    onChange={event=>setPendingSessions(items=>items.map(item=>item.id===session.id?{...item,kind:event.target.value as "sleep"|"nap"}:item))}>
                    <option value="sleep">Sueño</option><option value="nap">Siesta</option>
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">Fecha de inicio
                  <Input className="mt-1" type="date" value={session.startDate} onChange={event=>setPendingSessions(items=>items.map(item=>item.id===session.id?{...item,startDate:event.target.value}:item))}/>
                </label>
                <label className="text-xs text-muted-foreground">Hora de inicio
                  <Input className="mt-1" type="time" value={session.bedtime} onChange={event=>setPendingSessions(items=>items.map(item=>item.id===session.id?{...item,bedtime:event.target.value}:item))}/>
                </label>
                <label className="text-xs text-muted-foreground">Fecha de finalización
                  <Input className="mt-1" type="date" value={session.endDate} onChange={event=>setPendingSessions(items=>items.map(item=>item.id===session.id?{...item,endDate:event.target.value}:item))}/>
                </label>
                <label className="text-xs text-muted-foreground">Hora de finalización
                  <Input className="mt-1" type="time" value={session.wakeTime} onChange={event=>setPendingSessions(items=>items.map(item=>item.id===session.id?{...item,wakeTime:event.target.value}:item))}/>
                </label>
              </div>
            </div>;
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" size="sm" variant="outline" onClick={()=>setPendingSessions(items=>[...items,createEmptySleepSession(date)])}>Añadir otra sesión</Button>
          {calculatedHours!==null&&<p className="text-xs text-muted-foreground">Total de los periodos: {formatSleepHours(calculatedHours)}</p>}
        </div>
        <Button disabled={historyQuery.isLoading||historyQuery.isError||saveSessions.isPending}
          onClick={()=>void saveSleep().catch(error=>toast.error(error instanceof Error?error.message:"No se pudieron guardar las sesiones."))}>
          <Save className="mr-2 h-4 w-4"/>{saveSessions.isPending?"Guardando…":"Guardar sesiones de sueño"}
        </Button>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div>
          <h3 className="font-semibold">Mi horario habitual</h3>
          <p className="text-xs text-muted-foreground">Es tu referencia diaria, independiente de las horas reales que registres.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs text-muted-foreground">
            Quiero acostarme a
            <Input className="mt-1" type="time" value={schedule.bedtime} onChange={(event) => setSchedule((value) => ({ ...value, bedtime: event.target.value }))} />
          </label>
          <label className="text-xs text-muted-foreground">
            Quiero levantarme a
            <Input className="mt-1" type="time" value={schedule.wakeTime} onChange={(event) => setSchedule((value) => ({ ...value, wakeTime: event.target.value }))} />
          </label>
          <label className="text-xs text-muted-foreground">
            Avisarme antes
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={String(schedule.reminderMinutes)}
              onChange={(event) => setSchedule((value) => ({ ...value, reminderMinutes: Number(event.target.value) }))}>
              <option value="15">15 minutos</option>
              <option value="20">20 minutos</option>
              <option value="30">30 minutos</option>
            </select>
          </label>
          <div className="flex flex-col justify-end rounded-lg border bg-background px-3 py-2">
            <span className="text-[11px] text-muted-foreground">Descanso previsto</span>
            <span className="text-base font-semibold tabular-nums">
              {sleepDurationHours(schedule.bedtime, schedule.wakeTime)?.toLocaleString("es-CO", { maximumFractionDigits: 1 }) ?? "—"} h
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Recibirás un aviso diario {schedule.reminderMinutes} minutos antes de tu hora de acostarte para apagar, organizarte y prepararte para dormir. Requiere activar las notificaciones en este dispositivo.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={profileQuery.isLoading || profileMutations.save.isPending}
            onClick={() => void saveSchedule().catch((error) => toast.error(describeError(error, "No se pudo guardar el horario habitual."), { duration: 10000 }))}>
            {profileMutations.save.isPending ? "Guardando…" : "Guardar horario y aviso"}
          </Button>
          {(schedule.bedtime || schedule.wakeTime) && (
            <Button size="sm" variant="ghost" onClick={() => setSchedule((value) => ({ ...value, bedtime: "", wakeTime: "" }))}>Limpiar</Button>
          )}
          <Button size="sm" variant="secondary" disabled={pushBusy} onClick={() => void activateSleepNotifications()}>
            <Bell className="mr-1.5 h-4 w-4" />{pushBusy ? "Activando…" : "Activar avisos en este dispositivo"}
          </Button>
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
                  {row.sessions.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {row.sessions.map((session,index)=>{
                        const duration=sleepSessionDurationHours(session);
                        const deleteKey=`${row.date}:${session.id}`;
                        const isConfirming=sessionPendingDelete===deleteKey;
                        const isEditing=editingSession?.key===deleteKey;
                        if(isEditing&&editingSession){
                          const updateDraft=(patch:Partial<SleepSession>)=>setEditingSession(current=>current?{...current,session:{...current.session,...patch}}:current);
                          return <div key={session.id} className="space-y-3 rounded-lg border border-primary/30 bg-background/70 p-3">
                            <p className="text-xs font-medium">Editar {session.kind==="nap"?"siesta":`sueño ${index+1}`}</p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              <label className="text-xs text-muted-foreground">Tipo
                                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={editingSession.session.kind}
                                  onChange={event=>updateDraft({kind:event.target.value as "sleep"|"nap"})}>
                                  <option value="sleep">Sueño</option><option value="nap">Siesta</option>
                                </select>
                              </label>
                              <label className="text-xs text-muted-foreground">Fecha de inicio
                                <Input className="mt-1" type="date" value={editingSession.session.startDate} onChange={event=>updateDraft({startDate:event.target.value})}/>
                              </label>
                              <label className="text-xs text-muted-foreground">Hora de inicio
                                <Input className="mt-1" type="time" value={editingSession.session.bedtime} onChange={event=>updateDraft({bedtime:event.target.value})}/>
                              </label>
                              <label className="text-xs text-muted-foreground">Fecha de finalización
                                <Input className="mt-1" type="date" value={editingSession.session.endDate} onChange={event=>updateDraft({endDate:event.target.value})}/>
                              </label>
                              <label className="text-xs text-muted-foreground">Hora de finalización
                                <Input className="mt-1" type="time" value={editingSession.session.wakeTime} onChange={event=>updateDraft({wakeTime:event.target.value})}/>
                              </label>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" size="sm" disabled={updateSleepSession.isPending}
                                onClick={()=>void saveEditedSession().catch(error=>toast.error(describeError(error,"No se pudo actualizar el periodo."),{duration:10000}))}>
                                {updateSleepSession.isPending?"Guardando…":"Guardar cambios"}
                              </Button>
                              <Button type="button" size="sm" variant="ghost" disabled={updateSleepSession.isPending}
                                onClick={()=>setEditingSession(null)}>Cancelar</Button>
                            </div>
                          </div>;
                        }
                        return <div key={session.id} className="flex flex-wrap items-center justify-between gap-2">
                          <p className="min-w-0 text-xs text-muted-foreground">
                            {session.kind==="nap"?"Siesta":`Sueño ${index+1}`} · {session.startDate} {session.bedtime} → {session.endDate} {session.wakeTime}
                            {duration!==null?` · ${formatSleepHours(duration)}`:""}
                          </p>
                          {isConfirming ? (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button type="button" size="sm" variant="destructive" disabled={deleteSleepSession.isPending}
                                onClick={()=>void deleteSleepSession.mutateAsync({metricDate:row.date,sessionId:session.id}).then(()=>{
                                  setSessionPendingDelete(null);
                                  toast.success("Periodo de sueño eliminado. Los demás registros se conservaron.");
                                }).catch(error=>toast.error(describeError(error,"No se pudo eliminar el periodo."),{duration:10000}))}>
                                {deleteSleepSession.isPending?"Eliminando…":"Confirmar"}
                              </Button>
                              <Button type="button" size="sm" variant="ghost" disabled={deleteSleepSession.isPending}
                                onClick={()=>setSessionPendingDelete(null)}>Cancelar</Button>
                            </div>
                          ) : (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground"
                                aria-label="Editar este periodo" title="Editar este periodo"
                                onClick={()=>{setSessionPendingDelete(null);setEditingSession({key:deleteKey,metricDate:row.date,session:{...session}});}}>
                                <Pencil className="mr-1 h-3.5 w-3.5"/><span className="text-[11px]">Editar</span>
                              </Button>
                              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-destructive"
                                aria-label={`Eliminar ${session.kind==="nap"?"siesta":"periodo de sueño"} del ${session.startDate} a las ${session.bedtime}`}
                                title="Eliminar este periodo" onClick={()=>setSessionPendingDelete(deleteKey)}>
                                <Trash2 className="mr-1 h-3.5 w-3.5"/><span className="text-[11px]">Eliminar</span>
                              </Button>
                            </div>
                          )}
                        </div>;
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {row.details.bedtime
                        ? `Me acosté a las ${row.details.bedtime} · falta la hora de levantarse`
                        : row.details.wakeTime
                          ? `Me levanté a las ${row.details.wakeTime} · falta la hora de acostarse`
                          : row.hours !== null
                            ? "Duración registrada manualmente"
                            : "Duración no registrada"}
                    </p>
                  )}
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
