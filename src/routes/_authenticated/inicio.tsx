import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

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
  const pendingCount = plannerItems.filter((i) => i.status !== "done").length;
  const eventCount = plannerItems.filter((i) => i.type === "event").length;
  const nextItem =
    [...plannerItems]
      .filter((i) => i.start_time && i.status !== "done")
      .sort(compareChronologically)[0] ?? null;

  const habits = habitsQuery.data ?? [];
  const logs = logsQuery.data ?? [];

  const logByHabit = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const log of logs) map.set(log.habit_id, log);
    return map;
  }, [logs]);

  /** Progress counts real habits only — daily activities never move this number. */
  const onlyHabits = habits.filter((h) => h.kind === "habit");
  const activities = habits.filter((h) => h.kind !== "habit");
  const done = onlyHabits.filter((h) => isDone(h, logByHabit.get(h.id))).length;
  const total = onlyHabits.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const activitiesDone = activities.filter((h) => isDone(h, logByHabit.get(h.id))).length;

  const name =
    profileQuery.data?.display_name ??
    profileQuery.data?.full_name ??
    user?.email?.split("@")[0] ??
    "";

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-[0_16px_40px_-28px_var(--primary)] sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tu espacio personal</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting()}{name ? `, ${name}` : ""}
            <HelpTip helpKey="dashboard" />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Una vista conectada de tu día. Avanza a tu ritmo.</p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:max-w-md">
            {showHabits && (
              <div className="rounded-2xl border border-border/70 bg-background/65 p-3">
                <p className="text-xs text-muted-foreground">Hábitos de hoy</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{done}<span className="text-sm font-normal text-muted-foreground"> / {total}</span></p>
                <p className="text-[11px] text-muted-foreground">{percent}% completado</p>
              </div>
            )}
            {showPlanner && (
              <div className="rounded-2xl border border-border/70 bg-background/65 p-3">
                <p className="text-xs text-muted-foreground">Agenda de hoy</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{pendingCount}<span className="text-sm font-normal text-muted-foreground"> pendientes</span></p>
                <p className="text-[11px] text-muted-foreground">{eventCount} evento{eventCount === 1 ? "" : "s"}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <GlobalDateHeader />

      <WeatherCard />

      {showPlanner && (
        <section className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1 text-sm font-semibold">Planeador <HelpTip helpKey="planner" /></h2>
            <Button asChild size="sm" variant="ghost">
              <Link to="/planeador" search={(prev: Record<string, unknown>) => prev}>
                Ir al Planeador
              </Link>
            </Button>
          </div>
          {plannerQuery.isLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Cargando…</p>
          ) : plannerQuery.isError ? (
            <ErrorState message={plannerQuery.error instanceof Error ? plannerQuery.error.message : "No se pudo cargar la agenda de esta fecha."} />
          ) : plannerItems.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nada agendado para esta fecha.</p>
          ) : (
            <>
              <p className="mt-2 text-sm">
                {pendingCount} pendiente{pendingCount === 1 ? "" : "s"} · {eventCount} evento
                {eventCount === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {nextItem
                  ? `Próximo: ${shortTime(nextItem.start_time)} · ${nextItem.title}`
                  : "Sin compromisos con hora."}
              </p>
            </>
          )}
        </section>
      )}

      {showFocus && <DailyFocusPicker date={date} />}

      {showHabits && (habitsQuery.isLoading || logsQuery.isLoading ? (
        <LoadingState />
      ) : habitsQuery.isError || logsQuery.isError ? (
        <ErrorState message={habitsQuery.error instanceof Error ? habitsQuery.error.message : logsQuery.error instanceof Error ? logsQuery.error.message : "No se pudieron cargar los hábitos y sus registros de esta fecha."} />
      ) : habits.length === 0 ? (
        <EmptyState
          title="Aún no tienes hábitos"
          description="Crea tu primer hábito para empezar a construir tu historial real."
        />
      ) : (
        <section className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1 text-sm font-semibold">Resumen de hábitos <HelpTip helpKey="habits.summary" /></h2>
            <span className="text-sm text-muted-foreground">
              {done}/{total}
            </span>
          </div>
          <Progress value={percent} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {percent}% completado
            {activities.length > 0
              ? ` · actividades del día ${activitiesDone}/${activities.length}`
              : ""}
          </p>
        </section>
      ))}

      {dashboardWidgets.length === 0 && (
        <EmptyState
          title="Inicio despejado"
          description="No hay bloques visibles. Puedes elegir Agenda, Enfoque o Hábitos desde Perfil y configuración."
        />
      )}
    </div>
  );
}