import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Droplets,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { HelpTip } from "@/components/common/HelpTip";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/States";
import { Progress } from "@/components/ui/progress";
import { DailyFocusPicker } from "@/components/common/DailyFocusPicker";
import { Button } from "@/components/ui/button";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useHabits, useLogs } from "@/hooks/use-habits";
import { usePersonalDateList } from "@/hooks/use-personal-domains";
import { useDoses } from "@/hooks/use-medications";
import { medicationWater } from "@/domain/health";
import { usePlannerItems } from "@/hooks/use-planner";
import { compareChronologically, shortTime } from "@/domain/planner";
import { greeting } from "@/lib/date";
import { normalizeDashboardWidgets } from "@/domain/dashboard";
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
  const plannerQuery = usePlannerItems(date, showPlanner);
  const plannerItems = plannerQuery.data ?? [];
  const sortedPlanner = useMemo(
    () => [...plannerItems].sort(compareChronologically),
    [plannerItems],
  );
  const pendingItems = sortedPlanner.filter((item) => item.status !== "done");
  const eventCount = plannerItems.filter((item) => item.type === "event").length;
  const nextItem = pendingItems.find((item) => item.start_time) ?? null;

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
    <div className="space-y-5 pb-8">
      <GlobalDateHeader />

      <section className="relative isolate overflow-hidden rounded-[28px] border border-white/10 bg-[#171b2b] px-5 py-6 shadow-[0_24px_70px_-38px_rgba(75,105,255,.55)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-100px] left-[38%] h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-medium tracking-wide text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              TU ESPACIO PERSONAL
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-[2.5rem]">
              {greeting()}{name ? `, ${name}` : ""}
              <HelpTip helpKey="dashboard" />
            </h1>
            <p className="mt-2 max-w-xl text-sm capitalize leading-6 text-slate-300/80">
              {dateLabel}. Un día a la vez; registra lo que importa y sigue a tu ritmo.
            </p>
            {showFocus && <div className="mt-5 max-w-xl"><DailyFocusPicker date={date} /></div>}
          </div>

          <div className="grid grid-cols-2 gap-2 md:min-w-[270px]">
            {showHabits && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur">
                <div className="flex items-center gap-2 text-xs text-slate-300"><Target className="h-4 w-4 text-cyan-300" /> Hábitos</div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{done}<span className="text-sm font-normal text-slate-400"> / {total}</span></p>
                <p className="mt-0.5 text-[11px] text-slate-400">{percent}% completado</p>
              </div>
            )}
            {showPlanner && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur">
                <div className="flex items-center gap-2 text-xs text-slate-300"><CalendarDays className="h-4 w-4 text-violet-300" /> Agenda</div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{pendingItems.length}<span className="text-sm font-normal text-slate-400"> pendientes</span></p>
                <p className="mt-0.5 text-[11px] text-slate-400">{eventCount} eventos</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)]">
        <div className="space-y-4">
          {showHabits && (
            habitsQuery.isLoading || logsQuery.isLoading ? <LoadingState /> :
            habitsQuery.isError || logsQuery.isError ? (
              <ErrorState message={habitsQuery.error instanceof Error ? habitsQuery.error.message : logsQuery.error instanceof Error ? logsQuery.error.message : "No se pudieron cargar los hábitos y sus registros de esta fecha."} />
            ) : (
              <section className="overflow-hidden rounded-[26px] border border-border/70 bg-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-primary">Tu progreso</p>
                    <h2 className="mt-1 text-lg font-semibold">Hábitos del día <HelpTip helpKey="habits.summary" /></h2>
                  </div>
                  <Link to="/habitos" search={(prev: Record<string, unknown>) => prev} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Ver hábitos <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {habits.length === 0 ? (
                  <div className="px-5 pb-5"><EmptyState title="Aún no tienes hábitos" description="Crea tu primer hábito para empezar a construir tu historial real." /></div>
                ) : (
                  <div className="grid gap-4 px-5 pb-5 sm:grid-cols-[170px_1fr] sm:items-center">
                    <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full" style={{ background: `conic-gradient(#8b7cff ${percent}%, color-mix(in srgb, var(--border) 70%, transparent) 0)` }}>
                      <div className="flex h-[112px] w-[112px] flex-col items-center justify-center rounded-full bg-card">
                        <span className="text-3xl font-semibold tabular-nums">{percent}%</span>
                        <span className="text-[11px] text-muted-foreground">completado</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="mb-3 flex items-end justify-between gap-3">
                        <div><p className="text-2xl font-semibold tabular-nums">{done}<span className="text-sm font-normal text-muted-foreground"> de {total}</span></p><p className="text-xs text-muted-foreground">hábitos completados</p></div>
                        {activities.length > 0 && <div className="text-right"><p className="text-lg font-semibold tabular-nums">{activitiesDone}/{activities.length}</p><p className="text-[11px] text-muted-foreground">actividades</p></div>}
                      </div>
                      <Progress value={percent} className="h-2.5" />
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {onlyHabits.slice(0, 4).map((habit) => {
                          const complete = isDone(habit, logByHabit.get(habit.id));
                          return (
                            <div key={habit.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/55 px-3 py-2">
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${complete ? "bg-emerald-500/15 text-emerald-500" : "bg-background text-muted-foreground"}`}>
                                {complete ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                              </span>
                              <span className="truncate text-xs">{habit.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )
          )}

          {showPlanner && (
            <section className="rounded-[26px] border border-border/70 bg-card p-5 shadow-sm">
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
                <div className="mt-4 space-y-2">
                  {sortedPlanner.slice(0, 4).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-muted/45 px-3.5 py-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"><Clock3 className="h-4.5 w-4.5" /></span>
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
        </div>

        <aside className="space-y-4">
          <HydrationOverview date={date} />
          <WeatherCard />
        </aside>
      </div>

      {dashboardWidgets.length === 0 && (
        <EmptyState
          title="Inicio despejado"
          description="No hay bloques visibles. Puedes elegir Agenda, Enfoque o Hábitos desde Perfil y configuración."
        />
      )}
    </div>
  );
}

function HydrationOverview({ date }: { date: string }) {
  const metrics = usePersonalDateList<{ water_liters: number | null }>("health_metrics", "metric_date", date);
  const doses = useDoses(date);
  const manualLiters = Number(metrics.data?.[0]?.water_liters ?? 0) || 0;
  const totalLiters = manualLiters + medicationWater(doses.data ?? []) / 4;
  const targetLiters = 2.25;
  const percent = Math.min(100, Math.round((totalLiters / targetLiters) * 100));
  const amount = totalLiters.toLocaleString("es-CO", { maximumFractionDigits: 2 });

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-cyan-400/15 bg-gradient-to-br from-cyan-500/[.13] via-card to-card p-5 shadow-sm">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-400"><Droplets className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-cyan-500">Bienestar</p><h2 className="font-semibold">Hidratación</h2></div></div>
          <Button asChild size="sm" variant="ghost" className="rounded-xl"><Link to="/salud" search={(prev: Record<string, unknown>) => prev}>Registrar <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
        </div>
        {metrics.isError || doses.isError ? <p className="mt-4 text-xs text-muted-foreground">No se pudo cargar el resumen de hidratación.</p> : (
          <>
            <div className="mt-5 flex items-end justify-between gap-3"><p className="text-3xl font-semibold tabular-nums">{metrics.isLoading || doses.isLoading ? "…" : amount}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {targetLiters} L</span></p><span className="text-sm font-semibold text-cyan-500 tabular-nums">{metrics.isLoading || doses.isLoading ? " " : `${percent}%`}</span></div>
            <Progress value={metrics.isLoading || doses.isLoading ? 0 : percent} className="mt-3 h-2.5" />
            <p className="mt-2 text-[11px] text-muted-foreground">Datos del registro de Salud; no se crean registros paralelos.</p>
          </>
        )}
      </div>
    </section>
  );
}
