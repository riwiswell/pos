import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";

import { formatMoney } from "@/lib/money";
import type { CategorySlice, DailyPoint } from "@/lib/finance-math";

/** Donut of the period's spending (or income) split by category. */
export function CategoryDonut({
  slices,
  total,
  hideAmounts,
  title = "Gastos por categoría",
}: {
  slices: CategorySlice[];
  total: number;
  hideAmounts: boolean;
  title?: string;
}) {
  const money = (value: number) => (hideAmounts ? "••••" : formatMoney(value));

  if (slices.length === 0) {
    return (
      <div className="glass rounded-2xl p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="text-sm text-muted-foreground">
          Sin movimientos en este período para graficar.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>

      <div className="flex items-center gap-4">
        <div className="relative h-32 w-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="total"
                nameKey="name"
                innerRadius={40}
                outerRadius={62}
                paddingAngle={2}
                stroke="none"
              >
                {slices.map((slice) => (
                  <Cell key={slice.categoryId ?? "none"} fill={slice.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
            <span className="text-sm font-semibold tabular-nums">{money(total)}</span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-1.5">
          {slices.slice(0, 5).map((slice) => (
            <li key={slice.categoryId ?? "none"} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="min-w-0 flex-1 truncate">{slice.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {total > 0 ? Math.round((slice.total / total) * 100) : 0}%
              </span>
              <span className="shrink-0 tabular-nums">{money(slice.total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Expense vs income per day inside the selected period. */
export function DailyBars({ data, hideAmounts }: { data: DailyPoint[]; hideAmounts: boolean }) {
  if (data.length === 0) {
    return (
      <div className="glass rounded-2xl p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Evolución del período
        </p>
        <p className="text-sm text-muted-foreground">Aún no hay movimientos en este período.</p>
      </div>
    );
  }



  return (
    <div className="glass rounded-2xl p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Evolución del período
      </p>
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              interval="preserveStartEnd"
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value: number, name) => [
                hideAmounts ? "••••" : formatMoney(value),
                name === "expense" ? "Gastos" : "Ingresos",
              ]}
            />
            <Bar dataKey="income" fill="#34d399" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}