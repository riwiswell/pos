import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Droplets,
  Gamepad2,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { JournalEntryDialog } from "@/components/journal/JournalEntryDialog";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { HelpTip } from "@/components/common/HelpTip";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/States";
import { Progress } from "@/components/ui/progress";
import { DailyFocusPicker } from "@/components/common/DailyFocusPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useHabits, useLogs, useLogsRange, useHabitMutations } from "@/hooks/use-habits";
import { useJournalEntriesByDate } from "@/hooks/use-journal";
import { JOURNAL_META, entrySnippet, type JournalEntry } from "@/domain/journal";
import { usePersonalDateList } from "@/hooks/use-personal-domains";
import { useDoses } from "@/hooks/use-medications";
import { medicationWater, waterGlassesToMl } from "@/domain/health";
import { usePlannerItems } from "@/hooks/use-planner";
import { compareChronologically, shortTime } from "@/domain/planner";
import { addDaysISO, greeting } from "@/lib/date";
import { normalizeDashboardWidgets } from "@/domain/dashboard";
import { useLGList } from "@/hooks/use-life-graph";
import { useHydrationEntries } from "@/hooks/use-hydration";
import { LifeActivityFeed } from "@/components/dashboard/LifeActivityFeed";
import type { Habit, HabitLog } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Inicio — Personal OS" },
      {
        name: "description",
        content: "Tu resumen del día en Personal OS: agenda, enfoque y hábitos.",
      },
      { property: "og:title", content: "Inicio — Personal OS" },
      {
        property: "og:description",
        content: "Tu resumen del día en Personal OS: agenda, enfoque y hábitos.",
      },
    ],
  }),
  component: HomePage,
});

function isDone(habit: Habit, log: HabitLog | undefined) {
  if (habit.type === "check") return log?.completed ?? false;
  const target = habit.target ?? 0;
  const value = log?.value ?? 0;
  return target > 0 ? value >= target : value > 0;
}

function HomePage() {
  const { date } = useGlobalDate();
  const { user } = useAuth();
  const profileQuery = useProfile();
  const dashboardWidgets = normalizeDashboardWidgets(profileQuery.data?.dashboard_widgets);
  const showPlanner = dashboardWidgets.includes("planner");
  const showFocus = dashboardWidgets.includes("focus");
  const showHabits = dashboardWidgets.includes("habits");
  const habitsQuery = useHabits(false, showHabits);
  const logsQuery = useLogs(date, showHabits);
  const weekStart = useMemo(() => addDaysISO(date, -6), [date]);
  const weekLogsQuery = useLogsRange(weekStart, date, showHabits);
  const usageStart = useMemo(() => addDaysISO(date, -29), [date]);
  const usageLogsQuery = useLogsRange(usageStart, date, showHabits);
  const habitMutations = useHabitMutations(date);
  const [quickCounterValues, setQuickCounterValues] = useState<Record<string, string>>({});
  const journalQuery = useJournalEntriesByDate(date);
  const [journalDialogOpen, setJournalDialogOpen] = useState(false);
  const [editingJournalEntry, setEditingJournalEntry] = useState<JournalEntry | null>(null);
  const plannerQuery = usePlannerItems(date, showPlanner);
  const plannerItems = plannerQuery.data ?? [];
  const sortedPlanner = useMemo(
    () => [...plannerItems].sort(compareChronologically),
    [plannerItems],
  );
  const pendingItems = sortedPlanner.filter((item) => item.status !== "done");
  const eventCount = plannerItems.filter((item) => item.type === "event").length;
  const nextItem = pendingItems.find((item) => item.start_time) ?? null;
  const gamificationQuery = useLGList("gamification_profiles");
  const challengesQuery = useLGList("gamification_challenges");
  const gamification = gamificationQuery.data?.[0];
  const gamificationXp = Number(gamification?.xp ?? 0);
  const gamificationLevel = Number(gamification?.level ?? Math.floor(gamificationXp / 100) + 1);
  const gamificationStreak = Number(gamification?.current_streak ?? 0);
  const activeChallenge = (challengesQuery.data ?? []).find((challenge: any) => challenge.status === "active");
  const connectionsQuery = useLGList("life_links");
  const levelProgress = gamificationXp % 100;

  const habits = habitsQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const logByHabit = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const log of logs) map.set(log.habit_id, log);
    return map;
  }, [logs]);

  const onlyHabits = habits.filter((habit) => habit.kind === "habit");
  const activities = habits.filter((habit) => habit.kind !== "habit");
  const done = onlyHabits.filter((habit) => isDone(habit, logByHabit.get(habit.id))).length;
  const total = onlyHabits.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const activitiesDone = activities.filter((habit) => isDone(habit, logByHabit.get(habit.id))).length;
  const usageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const habitById = new Map(habits.map((habit) => [habit.id, habit] as const));
    for (const log of usageLogsQuery.data ?? []) {
      const habit = habitById.get(log.habit_id);
      if (!habit) continue;
      const wasUsed = habit.type === "check"
        ? Boolean(log.completed)
        : Number(log.value ?? 0) > 0;
      if (wasUsed) counts.set(habit.id, (counts.get(habit.id) ?? 0) + 1);
    }
    return counts;
  }, [habits, usageLogsQuery.data]);
  const rankedHabits = useMemo(
    () => habits
      .map((habit, index) => ({ habit, index, uses: usageCounts.get(habit.id) ?? 0 }))
      .sort((a, b) => b.uses - a.uses || a.index - b.index)
      .map(({ habit }) => habit),
    [habits, usageCounts],
  );
  const weeklyRhythm = useMemo(() => {
    const habitById = new Map<string, Habit>();
    for (const habit of onlyHabits) habitById.set(habit.id, habit);
    const logsByDate = new Map<string, HabitLog[]>();
    for (const log of weekLogsQuery.data ?? []) {
      if (!habitById.has(log.habit_id)) continue;
      const dayLogs = logsByDate.get(log.date) ?? [];
      dayLogs.push(log);
      logsByDate.set(log.date, dayLogs);
    }

    const days: { date: string; label: string; dayNumber: number; recorded: number; completed: number; percent: number | null }[] = [];
    for (let day = weekStart; day <= date; day = addDaysISO(day, 1)) {
      const dayLogs = logsByDate.get(day) ?? [];
      const completed = dayLogs.filter((log) => {
        const habit = habitById.get(log.habit_id);
        return habit ? isDone(habit, log) : false;
      }).length;
      days.push({
        date: day,
        label: new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(new Date(day + "T12:00:00")).replace(".", ""),
        dayNumber: Number(day.slice(-2)),
        recorded: dayLogs.length,
        completed,
        percent: dayLogs.length ? Math.round((completed / dayLogs.length) * 100) : null,
      });
    }
    return days;
  }, [date, onlyHabits, weekLogsQuery.data, weekStart]);

  const name =
    profileQuery.data?.display_name ??
    profileQuery.data?.full_name ??
    user?.email?.split("@")[0] ??
    "";

  const dateLabel = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date + "T12:00:00"));

  return (
    <div className="inicio-dashboard flex flex-col gap-4">
      <GlobalDateHeader compact />

      <section className="inicio-hero relative isolate overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-br from-[#202342] via-[#171b2b] to-[#10262f] px-5 py-4 shadow-[0_22px_55px_-34px_rgba(75,105,255,.55)]">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-100px] left-[38%] h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-medium tracking-wide text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              TU ESPACIO PERSONAL
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {greeting()}{name ? `, ${name}` : ""}
              <HelpTip helpKey="dashboard" />
            </h1>
            <p className="mt-1 max-w-xl text-sm capitalize leading-5 text-slate-300/80">
              {dateLabel}. Un día a la vez; registra lo que importa y sigue a tu ritmo.
            </p>
            {showFocus && <div className="mt-3 max-w-xl"><DailyFocusPicker date={date} compact /></div>}
          </div>

          <div className="grid grid-cols-2 gap-2 md:min-w-[390px] md:grid-cols-3">
            {showHabits && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur">
                <div className="flex items-center gap-2 text-xs text-slate-300"><Target className="h-4 w-4 text-cyan-300" /> Hábitos</div>
                <p className="mt-2 text-xl font-semibold tabular-nums text-white">{done}<span className="text-sm font-normal text-slate-400"> / {total}</span></p>
                <p className="mt-0.5 text-[11px] text-slate-400">{percent}% completado</p>
              </div>
            )}
            {showPlanner && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur">
                <div className="flex items-center gap-2 text-xs text-slate-300"><CalendarDays className="h-4 w-4 text-violet-300" /> Agenda</div>
                <p className="mt-2 text-xl font-semibold tabular-nums text-white">{pendingItems.length}<span className="text-sm font-normal text-slate-400"> pendientes</span></p>
                <p className="mt-0.5 text-[11px] text-slate-400">{eventCount} eventos</p>
              </div>
            )}
            <Link to="/gamificacion" search={(prev: Record<string, unknown>) => prev} className="rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-400/[.13] to-white/[.05] p-3 backdrop-blur transition-colors hover:border-amber-300/40">
              <div className="flex items-center gap-2 text-xs text-slate-300"><Trophy className="h-4 w-4 text-amber-300" /> Nivel personal</div>
              <p className="mt-2 text-xl font-semibold tabular-nums text-white">{gamificationQuery.isLoading ? "…" : `Nv. ${gamificationLevel}`}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{gamificationXp} XP · {gamificationStreak} días de racha</p>
              <Progress value={levelProgress} className="mt-2 h-1.5 bg-white/10"/>
              <p className="mt-1 truncate text-[10px] text-slate-300">{connectionsQuery.isLoading ? "…" : `${connectionsQuery.data?.length ?? 0} conexiones activas`}{activeChallenge ? ` · Reto: ${activeChallenge.title} (${activeChallenge.progress}/${activeChallenge.target})` : ""}</p>
            </Link>
          </div>
        </div>
      </section>

      <div className="mb-1"><WeatherCard /></div>
      <div className="inicio-dashboard-grid grid gap-3">
        <div className="inicio-habits-column min-w-0">
          {showHabits && (
            habitsQuery.isLoading || logsQuery.isLoading || usageLogsQuery.isLoading ? <LoadingState /> :
            habitsQuery.isError || logsQuery.isError || usageLogsQuery.isError ? (
              <ErrorState message={
                habitsQuery.error instanceof Error ? habitsQuery.error.message :
                logsQuery.error instanceof Error ? logsQuery.error.message :
                usageLogsQuery.error instanceof Error ? usageLogsQuery.error.message :
                "No se pudieron cargar los hábitos y su historial de uso."
              } />
            ) : (
              <section className="inicio-habits-card overflow-hidden rounded-[26px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[.08] via-card to-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-primary">Tu progreso</p>
                    <h2 className="mt-1 text-lg font-semibold">Hábitos del día <HelpTip helpKey="habits.summary" /></h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Ordenados por uso en los últimos 30 días.</p>
                  </div>
                  <Link to="/habitos" search={(prev: Record<string, unknown>) => prev} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Ver hábitos <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {habits.length === 0 ? (
                  <div className="px-5 pb-5"><EmptyState title="Aún no tienes hábitos" description="Crea tu primer hábito para empezar a construir tu historial real." /></div>
                ) : (
                  <div className="grid gap-3 px-4 pb-3 sm:grid-cols-[108px_1fr] sm:items-center">
                    <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full" style={{ background: `conic-gradient(#8b7cff ${percent}%, color-mix(in srgb, var(--border) 70%, transparent) 0)` }}>
                      <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-card">
                        <span className="text-2xl font-semibold tabular-nums">{percent}%</span>
                        <span className="text-[11px] text-muted-foreground">completado</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <div><p className="text-2xl font-semibold tabular-nums">{done}<span className="text-sm font-normal text-muted-foreground"> de {total}</span></p><p className="text-xs text-muted-foreground">hábitos completados</p></div>
                        {activities.length > 0 && <div className="text-right"><p className="text-lg font-semibold tabular-nums">{activitiesDone}/{activities.length}</p><p className="text-[11px] text-muted-foreground">actividades</p></div>}
                      </div>
                      <Progress value={percent} className="h-2.5" />
                      <div className="mt-3 grid grid-cols-1 gap-1.5">
                        {rankedHabits.slice(0, 4).map((habit) => {
                          const habitLog = logByHabit.get(habit.id);
                          const complete = isDone(habit, habitLog);
                          const value = habitLog?.value ?? 0;
                          return (
                            <div key={habit.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/55 px-2.5 py-1.5">
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${complete ? "bg-emerald-500/15 text-emerald-500" : "bg-background text-muted-foreground"}`}>
                                {complete ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span aria-hidden className="shrink-0 text-sm">{habit.icon || (habit.kind === "activity" ? "🎯" : "✨")}</span>
                                  <p className="min-w-0 flex-1 truncate text-xs font-medium">{habit.name}</p>
                                  {habit.kind === "activity" && <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">Actividad</span>}
                                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground" title={`Registrado en ${usageCounts.get(habit.id) ?? 0} de los últimos 30 días`}>
                                    {usageCounts.get(habit.id) ?? 0}/30 días
                                  </span>
                                </div>
                                {habit.type === "counter" && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {value}{habit.target ? ` / ${habit.target}` : ""} {habit.unit ?? ""}
                                  </p>
                                )}
                              </div>
                              {habit.type === "check" ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant={complete ? "default" : "outline"}
                                  className="h-7 w-7 shrink-0 rounded-full"
                                  aria-label={complete ? `Desmarcar ${habit.name}` : `Completar ${habit.name}`}
                                  title={complete ? "Desmarcar" : "Completar"}
                                  disabled={habitMutations.saveLog.isPending}
                                  onClick={() => habitMutations.saveLog.mutate({
                                    habitId: habit.id,
                                    patch: { completed: !complete, value },
                                  })}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  inputMode="decimal"
                                  aria-label={`Minutos o cantidad de ${habit.name}`}
                                  title="Escribe el total directamente"
                                  className="h-8 w-20 shrink-0 px-2 text-center text-sm tabular-nums"
                                  value={quickCounterValues[habit.id] ?? String(value)}
                                  disabled={habitMutations.saveLog.isPending}
                                  onChange={(event) => setQuickCounterValues(current => ({ ...current, [habit.id]: event.target.value }))}
                                  onBlur={() => {
                                    const raw = quickCounterValues[habit.id] ?? String(value);
                                    const parsed = Number(raw.replace(",", "."));
                                    if (Number.isFinite(parsed) && parsed >= 0 && parsed !== value) {
                                      habitMutations.saveLog.mutate({
                                        habitId: habit.id,
                                        patch: {
                                          value: parsed,
                                          completed: habit.target ? parsed >= habit.target : parsed > 0,
                                        },
                                      });
                                    }
                                    setQuickCounterValues(current => { const next = { ...current }; delete next[habit.id]; return next; });
                                  }}
                                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {habits.length > 0 && (
                  <div className="border-t border-border/70 px-4 py-3">
                    <WeeklyHabitRhythm days={weeklyRhythm} loading={weekLogsQuery.isLoading} error={weekLogsQuery.isError} />
                  </div>
                )}
              </section>
            )
          )}

        </div>

        <div className="inicio-planner-column min-w-0">
          <div className="flex h-full min-w-0 flex-col gap-3">
          {showPlanner && (
            <section className="rounded-[26px] border border-amber-400/20 bg-gradient-to-br from-amber-500/[.07] via-card to-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-violet-400">Organiza tu tiempo</p>
                  <h2 className="mt-1 text-lg font-semibold">Agenda <HelpTip helpKey="planner" /></h2>
                </div>
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <Link to="/planeador" search={(prev: Record<string, unknown>) => prev}>Abrir agenda <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              </div>
              {plannerQuery.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Cargando agenda…</p> :
                plannerQuery.isError ? <ErrorState message={plannerQuery.error instanceof Error ? plannerQuery.error.message : "No se pudo cargar la agenda."} /> :
                sortedPlanner.length === 0 ? <p className="mt-4 rounded-2xl bg-muted/45 px-4 py-5 text-sm text-muted-foreground">No tienes actividades registradas para esta fecha.</p> :
                <div className="mt-3 space-y-2">
                  {sortedPlanner.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-muted/45 px-3 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"><Clock3 className="h-4.5 w-4.5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.start_time ? shortTime(item.start_time) : "Sin hora"} · {item.type === "event" ? "Evento" : "Actividad"}</p>
                      </div>
                      {item.status === "done" && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-500">Hecho</span>}
                    </div>
                  ))}
                  {pendingItems.length > 0 && <p className="pt-1 text-xs text-muted-foreground"><TrendingUp className="mr-1 inline h-3.5 w-3.5" /> {pendingItems.length} pendiente{pendingItems.length === 1 ? "" : "s"}{nextItem?.start_time ? ` · siguiente a las ${shortTime(nextItem.start_time)}` : ""}</p>}
                </div>
              }
            </section>
          )}
          <CurrentBookCard />
          <CurrentGameCard />
          </div>
        </div>

        <aside className="inicio-wellbeing-column min-w-0">
          <HydrationOverview date={date} compact />
          <DiaryOverview
            entries={journalQuery.data ?? []}
            loading={journalQuery.isLoading}
            error={journalQuery.isError}
            onCreate={() => {
              setEditingJournalEntry(null);
              setJournalDialogOpen(true);
            }}
            onOpen={(entry) => {
              setEditingJournalEntry(entry);
              setJournalDialogOpen(true);
            }}
          />
        </aside>
      </div>

      <LifeActivityFeed connections={connectionsQuery.data ?? []} connectionsLoading={connectionsQuery.isLoading} />

      {dashboardWidgets.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/15 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
          Inicio no tiene widgets activos. Puedes configurarlos desde Perfil.
        </p>
      )}

      <JournalEntryDialog
        open={journalDialogOpen}
        onOpenChange={(open) => {
          setJournalDialogOpen(open);
          if (!open) setEditingJournalEntry(null);
        }}
        entry={editingJournalEntry}
        defaultDate={date}
        initialType="thought"
      />
    </div>
  );
}




function CurrentBookCard(){
 const query=useLGList("learning_items","updated_at");
 const allBooks=(query.data??[]).filter((item:any)=>item.kind==="book") as any[];
 const progressOf=(item:any)=>{
  const total=Number(item.total_pages??0), page=Number(item.current_page??0);
  return total>0?Math.min(100,Math.max(0,page/total*100)):Math.min(100,Math.max(0,Number(item.progress??0)));
 };
 const completedBooks=allBooks.filter((item:any)=>Boolean(item.completed_on)||item.status==="completed"||progressOf(item)>=100);
 const completedBook=[...completedBooks].sort((a,b)=>(Date.parse(b.completed_on??b.updated_at??b.created_at??"")||0)-(Date.parse(a.completed_on??a.updated_at??a.created_at??"")||0))[0];
 const activeBooks=allBooks.filter((item:any)=>item.status!=="archived"&&!completedBooks.some((done:any)=>done.id===item.id)&&progressOf(item)<100);
 const book=[...activeBooks].sort((a,b)=>{
  const byProgress=progressOf(b)-progressOf(a);
  return byProgress!==0?byProgress:(Date.parse(b.updated_at??b.created_at??"")||0)-(Date.parse(a.updated_at??a.created_at??"")||0);
 })[0];
 const total=Number(book?.total_pages??0), page=Number(book?.current_page??0), progress=book?progressOf(book):0;
 const completedPageCount=Number(completedBook?.current_page??completedBook?.total_pages??0);
 return <section className="inicio-learning-card relative min-w-0 overflow-hidden rounded-[24px] border border-sky-400/20 bg-gradient-to-br from-[#152a3b] via-[#172331] to-card p-4 shadow-sm">
  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sky-400/10 blur-2xl"/>
  <div className="relative">
   <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300"><BookOpen className="h-5 w-5"/></span><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-sky-300">Aprendizaje</p><h2 className="text-sm font-semibold text-white">{book?"Lectura actual":"Tu recorrido de lectura"}</h2></div></div>
    <Link to="/aprendizaje" search={(prev:Record<string,unknown>)=>prev} className="text-[11px] font-medium text-sky-300 hover:underline">Biblioteca <ArrowUpRight className="ml-0.5 inline h-3 w-3"/></Link>
   </div>
   {query.isLoading?<p className="mt-4 text-xs text-slate-300">Buscando tu lectura…</p>:query.isError?<p className="mt-4 text-xs text-slate-300">No se pudo consultar Aprendizaje.</p>:<>
    {completedBook&&<div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 p-2.5 text-amber-100"><Trophy className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"/><div className="min-w-0 text-xs"><b>¡Felicitaciones! Terminaste {completedBook.title}.</b><p className="mt-0.5 text-amber-100/80">{completedPageCount>0?completedPageCount+" páginas completadas · ":""}{completedBooks.length} {completedBooks.length===1?"libro terminado":"libros terminados"} en tu biblioteca.</p></div></div>}
    {book?<><p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-sky-300">La lectura más cerca de terminar</p><p className="mt-1 line-clamp-2 text-base font-semibold text-white">{book.title}</p><div className="mt-3 flex items-end justify-between gap-3"><p className="text-2xl font-semibold tabular-nums text-white">{Math.round(progress)}%</p><p className="text-right text-[11px] text-slate-300">{total>0?"Página "+page+" de "+total+" · "+Math.max(0,total-page)+" restantes":"Progreso registrado"}</p></div><Progress value={progress} className="mt-2 h-2 bg-white/10"/></>:<div className="mt-3 rounded-xl border border-white/10 bg-white/[.04] p-3"><p className="text-sm font-medium text-white">{completedBook?"¡Has completado todas tus lecturas registradas!":"Aún no tienes una lectura activa"}</p><p className="mt-1 text-xs text-slate-300">{completedBook?"Agrega el siguiente libro a tu biblioteca para continuar tu recorrido.":"Añade un libro en Aprendizaje y aparecerá aquí con su progreso real."}</p></div>}
   </>}
  </div>
 </section>;
}

function CurrentGameCard() {
  const query = useLGList("learning_items", "updated_at");
  const activeGames = (query.data ?? []).filter(
    (item: any) =>
      (item.kind === "game" || item.kind === "video_game") &&
      item.status !== "completed" &&
      item.status !== "archived" &&
      Number(item.progress ?? 0) < 100,
  ) as any[];
  const game = [...activeGames].sort((a, b) => {
    const byProgress = Number(b.progress ?? 0) - Number(a.progress ?? 0);
    if (byProgress !== 0) return byProgress;
    return (Date.parse(b.updated_at ?? b.created_at ?? "") || 0) - (Date.parse(a.updated_at ?? a.created_at ?? "") || 0);
  })[0];
  const progress = Math.min(100, Math.max(0, Number(game?.progress ?? 0)));
  const progressLabel = progress.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <section className="inicio-game-card relative min-w-0 overflow-hidden rounded-[24px] border border-violet-400/20 bg-gradient-to-br from-[#292044] via-[#211d31] to-card p-4 shadow-sm">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/15 text-violet-300"><Gamepad2 className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-violet-300">Ocio digital</p><h2 className="text-sm font-semibold text-white">Juego actual</h2></div></div>
          <Link to="/aprendizaje" search={(prev: Record<string, unknown>) => prev} className="text-[11px] font-medium text-violet-300 hover:underline">Mis juegos <ArrowUpRight className="ml-0.5 inline h-3 w-3" /></Link>
        </div>
        {query.isLoading ? <p className="mt-4 text-xs text-slate-300">Buscando tu juego…</p> : query.isError ? <p className="mt-4 text-xs text-slate-300">No se pudo consultar tu biblioteca de juegos.</p> : game ? (
          <>
            <p className="mt-4 line-clamp-2 text-base font-semibold text-white">{game.title}</p>
            {(game.platform || game.genre) && <p className="mt-1 text-[11px] text-violet-200">{[game.platform, game.genre].filter(Boolean).join(" · ")}</p>}
            {(game.goal_description || game.goal_date || game.notes) && <p className="mt-1 line-clamp-2 text-xs text-slate-300">{game.goal_description || game.notes}{game.goal_date ? " · Meta: " + game.goal_date : ""}</p>}
            <div className="mt-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> En curso</span><span className="text-xs tabular-nums text-slate-300">{progressLabel}% registrado</span></div>
            <Progress value={progress} className="mt-2 h-2 bg-white/10" />
          </>
        ) : <div className="mt-4 rounded-xl border border-white/10 bg-white/[.04] p-3"><p className="text-sm font-medium text-white">Todavía no has elegido un juego activo</p><p className="mt-1 text-xs text-slate-300">Añade un juego desde la pestaña Videojuegos de Aprendizaje y aparecerá aquí automáticamente.</p></div>}
      </div>
    </section>
  );
}

function DiaryOverview({
  entries,
  loading,
  error,
  onCreate,
  onOpen,
}: {
  entries: JournalEntry[];
  loading: boolean;
  error: boolean;
  onCreate: () => void;
  onOpen: (entry: JournalEntry) => void;
}) {
  return (
    <section className="glass space-y-2.5 rounded-[24px] border border-rose-400/20 bg-gradient-to-br from-rose-500/[.07] via-card to-card p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300">
            <BookOpen className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">Diario del día</h2>
            <p className="text-[11px] text-muted-foreground">Tus capturas en esta fecha</p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-xl" onClick={onCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Anotar
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl bg-muted/45 px-3 py-2.5 text-xs text-muted-foreground">
          No se pudo cargar el Diario para esta fecha.
        </p>
      ) : loading ? (
        <div className="space-y-2">
          <div className="h-11 animate-pulse rounded-xl bg-muted/65" />
          <div className="h-11 animate-pulse rounded-xl bg-muted/65" />
        </div>
      ) : entries.length === 0 ? (
        <p className="rounded-xl bg-muted/45 px-3 py-2.5 text-xs text-muted-foreground">
          Aún no has guardado capturas para esta fecha. Puedes anotar una idea, pensamiento o reflexión.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.slice(0, 2).map((entry) => {
            const meta = JOURNAL_META[entry.type];
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpen(entry)}
                className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-border/60 bg-background/45 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
                  {meta.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">{entry.title || meta.label}</span>
                    {entry.entry_time && (
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{entry.entry_time.slice(0, 5)}</span>
                    )}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                    {entrySnippet(entry, 110) || meta.label}
                  </span>
                </span>
              </button>
            );
          })}
          <Link
            to="/diario"
            search={(prev: Record<string, unknown>) => prev}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            Abrir Diario <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </section>
  );
}

type WeeklyHabitDay = {
  date: string;
  label: string;
  dayNumber: number;
  recorded: number;
  completed: number;
  percent: number | null;
};

function WeeklyHabitRhythm({
  days,
  loading,
  error,
}: {
  days: WeeklyHabitDay[];
  loading: boolean;
  error: boolean;
}) {
  const activeDays = days.filter((day) => day.recorded > 0);
  const average = activeDays.length
    ? Math.round(activeDays.reduce((sum, day) => sum + (day.percent ?? 0), 0) / activeDays.length)
    : null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Ritmo semanal</h3>
          <p className="text-[11px] text-muted-foreground">Solo cuenta los hábitos que registraste</p>
        </div>
        {average !== null && (
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{average}%</p>
            <p className="text-[10px] text-muted-foreground">promedio registrado</p>
          </div>
        )}
      </div>

      {error ? (
        <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          No se pudo cargar el historial semanal.
        </p>
      ) : loading ? (
        <div className="grid h-[76px] grid-cols-7 items-end gap-2" aria-label="Cargando ritmo semanal">
          {days.map((day) => <div key={day.date} className="h-12 animate-pulse rounded-lg bg-muted/70" />)}
        </div>
      ) : activeDays.length === 0 ? (
        <p className="rounded-xl bg-muted/45 px-3 py-2.5 text-xs text-muted-foreground">
          Aún no hay registros en estos siete días. Los días vacíos se mantienen neutrales; no se cuentan como fallos.
        </p>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => (
            <div
              key={day.date}
              className="flex min-w-0 flex-col items-center gap-1.5"
              title={day.recorded
                ? `${day.label} ${day.dayNumber}: ${day.completed} de ${day.recorded} registros completados`
                : `${day.label} ${day.dayNumber}: sin registros`}
            >
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {day.percent === null ? "—" : `${day.percent}%`}
              </span>
              <div className="flex h-10 w-full items-end overflow-hidden rounded-lg bg-muted/65">
                {day.percent !== null && (
                  <div
                    className="w-full rounded-lg bg-gradient-to-t from-violet-600 to-cyan-400 transition-[height]"
                    style={{ height: `${Math.max(8, day.percent)}%` }}
                  />
                )}
              </div>
              <span className="text-[10px] capitalize text-muted-foreground">{day.label}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{day.dayNumber}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HydrationOverview({ date, compact = false }: { date: string; compact?: boolean }) {
  const metrics = usePersonalDateList<{ water_liters: number | null }>("health_metrics", "metric_date", date);
  const doses = useDoses(date);
  const entries = useHydrationEntries(date);
  const legacyWaterMl = (Number(metrics.data?.[0]?.water_liters ?? 0) || 0) * 1000;
  const recordedWaterMl = (entries.data ?? []).filter((entry) => entry.beverage_type === "water").reduce((sum, entry) => sum + Number(entry.amount_ml || 0), 0);
  const otherFluidMl = (entries.data ?? []).filter((entry) => entry.beverage_type !== "water").reduce((sum, entry) => sum + Number(entry.amount_ml || 0), 0);
  const medicineWaterMl = waterGlassesToMl(medicationWater(doses.data ?? []));
  const waterMl = legacyWaterMl + recordedWaterMl + medicineWaterMl;
  const totalFluidMl = waterMl + otherFluidMl;
  const targetLiters = 2.25;
  const percent = Math.min(100, Math.round((waterMl / (targetLiters * 1000)) * 100));
  const waterAmount = (waterMl / 1000).toLocaleString("es-CO", { maximumFractionDigits: 2 });
  const fmtMl = (value: number) => Math.round(value).toLocaleString("es-CO");

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[.13] via-card to-card p-3.5 shadow-sm">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-400"><Droplets className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-cyan-500">Bienestar</p><h2 className="font-semibold">Hidratación</h2></div></div>
          <Button asChild size="sm" variant="ghost" className="rounded-xl"><Link to="/salud" search={(prev: Record<string, unknown>) => prev}>Registrar <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
        </div>
        {metrics.isError || doses.isError || entries.isError ? <p className="mt-4 text-xs text-muted-foreground">No se pudo cargar el resumen de hidratación.</p> : (
          <>
            <div className="mt-3 flex items-end justify-between gap-3"><p className="text-2xl font-semibold tabular-nums">{metrics.isLoading || doses.isLoading || entries.isLoading ? "…" : waterAmount}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {targetLiters.toLocaleString("es-CO")} L</span></p><span className="text-sm font-semibold text-cyan-500 tabular-nums">{metrics.isLoading || doses.isLoading || entries.isLoading ? " " : `${percent}%`}</span></div>
            <Progress value={metrics.isLoading || doses.isLoading || entries.isLoading ? 0 : percent} className="mt-3 h-2.5" />
            {!metrics.isLoading && !doses.isLoading && !entries.isLoading && <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground"><p>Agua simple: {fmtMl(waterMl)} ml · Otros líquidos: {fmtMl(otherFluidMl)} ml</p><p>Total registrado: {fmtMl(totalFluidMl)} ml</p></div>}
          </>
        )}
      </div>
    </section>
  );
}
