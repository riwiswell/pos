import { useMemo } from "react";
import { Activity, CalendarCheck, ChartNoAxesCombined, Flame, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useHabits, useLogsRange } from "@/hooks/use-habits";
import { isHabitDone } from "@/domain/habits";
import { addDaysISO, fromISODate } from "@/lib/date";

export function HabitInsightsPanel({ date }: { date: string }) {
  const start = useMemo(() => addDaysISO(date, -29), [date]);
  const habitsQuery = useHabits();
  const logsQuery = useLogsRange(start, date);
  const habits = habitsQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const dailyHabits = habits.filter((habit) => habit.kind === "habit");
  const activityHabits = new Set(habits.filter((habit) => habit.kind === "activity").map((habit) => habit.id));

  const chartData = useMemo(() => {
    const byDate = new Map<string, typeof logs>();
    for (const log of logs) {
      byDate.set(log.date, [...(byDate.get(log.date) ?? []), log]);
    }
    const habitById = new Map(dailyHabits.map((habit) => [habit.id, habit] as const));
    return Array.from({ length: 30 }, (_, index) => {
      const day = addDaysISO(start, index);
      const dayLogs = byDate.get(day) ?? [];
      const completed = dayLogs.filter((log) => {
        const habit = habitById.get(log.habit_id);
        return habit ? isHabitDone(habit, log) : false;
      }).length;
      const d = fromISODate(day);
      return {
        date: day,
        label: new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(d).replace(".", ""),
        completed,
        percent: dailyHabits.length ? Math.round((completed / dailyHabits.length) * 100) : 0,
        activities: dayLogs.filter((log) => activityHabits.has(log.habit_id) && isHabitDone(habits.find((habit) => habit.id === log.habit_id)!, log)).length,
      };
    });
  }, [activityHabits, dailyHabits, habits, logs, start]);

  const totalCompleted = chartData.reduce((sum, day) => sum + day.completed, 0);
  const activeDays = chartData.filter((day) => day.completed > 0).length;
  const average = chartData.length ? Math.round(chartData.reduce((sum, day) => sum + day.percent, 0) / chartData.length) : 0;
  const activityCount = chartData.reduce((sum, day) => sum + day.activities, 0);
  const ranked = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      const habit = habits.find((item) => item.id === log.habit_id);
      if (!habit) continue;
      const used = habit.type === "check" ? Boolean(log.completed) : Number(log.value ?? 0) > 0;
      if (used) counts.set(habit.id, (counts.get(habit.id) ?? 0) + 1);
    }
    return habits
      .map((habit, index) => ({ habit, count: counts.get(habit.id) ?? 0, index }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .slice(0, 4);
  }, [habits, logs]);
  const bestDay = chartData.reduce((best, day) => day.percent > best.percent ? day : best, chartData[0]!);

  if (habitsQuery.isLoading || logsQuery.isLoading) {
    return <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">Calculando tu ritmo de los últimos 30 días…</div>;
  }
  if (habitsQuery.isError || logsQuery.isError) {
    return <div className="rounded-2xl border border-destructive/30 p-3 text-xs text-destructive">No se pudo cargar la gráfica de hábitos.</div>;
  }

  return (
    <section className="glass space-y-4 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><ChartNoAxesCombined className="h-4 w-4 text-primary"/><h2 className="font-semibold">Tu ritmo en 30 días</h2></div><p className="mt-1 text-xs text-muted-foreground">Constancia de hábitos y actividades registradas · hasta {date}</p></div>
        <div className="rounded-xl bg-primary/10 px-3 py-2 text-right"><p className="text-2xl font-bold tabular-nums">{average}%</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Promedio diario</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border bg-background/50 p-3"><CalendarCheck className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-semibold tabular-nums">{totalCompleted}</p><p className="text-[10px] text-muted-foreground">Hábitos completados</p></div>
        <div className="rounded-xl border bg-background/50 p-3"><Flame className="h-4 w-4 text-orange-400"/><p className="mt-2 text-xl font-semibold tabular-nums">{activeDays}/30</p><p className="text-[10px] text-muted-foreground">Días con avance</p></div>
        <div className="rounded-xl border bg-background/50 p-3"><Activity className="h-4 w-4 text-cyan-500"/><p className="mt-2 text-xl font-semibold tabular-nums">{activityCount}</p><p className="text-[10px] text-muted-foreground">Actividades registradas</p></div>
        <div className="rounded-xl border bg-background/50 p-3"><TrendingUp className="h-4 w-4 text-emerald-500"/><p className="mt-2 text-xl font-semibold tabular-nums">{bestDay?.percent ?? 0}%</p><p className="text-[10px] text-muted-foreground">Mejor día · {bestDay?.label ?? "—"}</p></div>
      </div>
      <div className="h-52 w-full sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="habit-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7cf6" stopOpacity={0.4}/><stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))"/>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd"/>
            <YAxis domain={[0,100]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value) => value + "%"}/>
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(value: number) => [value + "%", "Hábitos completados"]}/>
            <Area type="monotone" dataKey="percent" stroke="#8b7cf6" strokeWidth={2.5} fill="url(#habit-trend-fill)" activeDot={{ r: 4, strokeWidth: 0 }}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {ranked.length > 0 && <div className="space-y-2 border-t pt-3"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tus más constantes</h3><span className="text-[10px] text-muted-foreground">Días registrados en el período</span></div><div className="grid gap-2 sm:grid-cols-2">{ranked.map(({ habit, count }) => <div key={habit.id} className="flex items-center gap-2"><span className="text-lg">{habit.icon || (habit.kind === "activity" ? "🎯" : "✨")}</span><span className="min-w-0 flex-1 truncate text-xs">{habit.name}</span><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: Math.min(100, count / 30 * 100) + "%" }}/></div><span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">{count}/30</span></div>)}</div></div>}
      {dailyHabits.length === 0 && <p className="text-xs text-muted-foreground">Crea hábitos diarios para empezar a ver tu constancia en esta gráfica.</p>}
    </section>
  );
}
