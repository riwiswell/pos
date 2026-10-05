import { useMemo } from "react";
import { HelpTip } from "@/components/common/HelpTip";
import { createFileRoute, Link } from "@tanstack/react-router";

import { GlobalDateHeader } from "@/components/common/GlobalDateHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/States";
import { Progress } from "@/components/ui/progress";
import { DailyFocusPicker } from "@/components/common/DailyFocusPicker";
import { Button } from "@/components/ui/button";
import { useGlobalDate } from "@/hooks/use-global-date";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useHabits, useLogs } from "@/hooks/use-habits";
import { useAccounts, useBalanceRows, useFinanceSettings, useTransactions } from "@/hooks/use-finance";
import { accountBalances, sumBy, totalBalance } from "@/lib/finance-math";
import { formatMoney } from "@/lib/money";
import { usePlannerItems } from "@/hooks/use-planner";
import { compareChronologically, shortTime } from "@/domain/planner";
import { greeting } from "@/lib/date";
import type { Habit, HabitLog } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Inicio — Personal OS" },
      {
        name: "description",
        content: "Tu resumen del día en Personal OS: enfoque, hábitos, finanzas y actividad.",
      },
      { property: "og:title", content: "Inicio — Personal OS" },
      {
        property: "og:description",
        content: "Tu resumen del día en Personal OS: enfoque, hábitos, finanzas y actividad.",
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
  const habitsQuery = useHabits();
  const logsQuery = useLogs(date);
  const profileQuery = useProfile();

  const accountsQuery = useAccounts();
  const balanceRowsQuery = useBalanceRows();
  const settingsQuery = useFinanceSettings();
  const dayTransactions = useTransactions({ from: date, to: date });

  const plannerQuery = usePlannerItems(date);
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

  const dayList = dayTransactions.data ?? [];
  const dayExpense = sumBy(dayList, "expense");
  const dayIncome = sumBy(dayList, "income");
  const balances = accountBalances(balanceRowsQuery.data ?? []);
  const balance = totalBalance(accountsQuery.data ?? [], balances);
  const hideAmounts = settingsQuery.data
    ? !settingsQuery.data.show_money_in_dashboard
    : false;
  const money = (value: number) => (hideAmounts ? "••••" : formatMoney(value));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Tu día en Personal OS</p>
      </div>

      <GlobalDateHeader />

      <section className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Planeador</h2>
          <Button asChild size="sm" variant="ghost">
            <Link to="/planeador" search={(prev: Record<string, unknown>) => prev}>
              Ir al Planeador
            </Link>
          </Button>
        </div>
        {plannerQuery.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Cargando…</p>
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

      <section className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Finanzas del día</h2>
          <Button asChild size="sm" variant="ghost">
            <Link to="/finanzas" search={(prev: Record<string, unknown>) => prev}>
              Ir a Finanzas
            </Link>
          </Button>
        </div>
        {dayTransactions.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Gastos</p>
                <p className="text-sm font-semibold tabular-nums">{money(dayExpense)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Ingresos
                </p>
                <p className="text-sm font-semibold tabular-nums text-success">
                  {money(dayIncome)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Balance
                </p>
                <p className="text-sm font-semibold tabular-nums">{money(balance)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {dayList.length === 0
                ? "Sin movimientos registrados en esta fecha."
                : `${dayList.length} movimiento${dayList.length === 1 ? "" : "s"} en esta fecha.`}
            </p>
          </>
        )}
      </section>

      <DailyFocusPicker date={date} />

      {habitsQuery.isLoading ? (
        <LoadingState />
      ) : habits.length === 0 ? (
        <EmptyState
          title="Aún no tienes hábitos"
          description="Crea tu primer hábito para empezar a construir tu historial real."
        />
      ) : (
        <>
          <section className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Resumen de hábitos</h2>
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

          <section className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Resumen de hábitos</h2>
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

        </>
      )}
    </div>
  );
}