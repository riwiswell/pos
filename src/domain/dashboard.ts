export const DASHBOARD_WIDGETS = [
  { key: "planner", label: "Agenda del día", description: "Próximas tareas y eventos." },
  { key: "focus", label: "Enfoque del día", description: "Tu prioridad para la fecha seleccionada." },
  { key: "habits", label: "Resumen de hábitos", description: "Avance de hábitos y actividades." },
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number]["key"];
export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetKey[] = ["planner", "focus", "habits"];

/**
 * Normalize saved preferences from previous versions without silently enabling
 * nonexistent widgets. An empty array is a valid choice to show a clean home.
 */
export function normalizeDashboardWidgets(value: unknown): DashboardWidgetKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_DASHBOARD_WIDGETS];
  if (value.length === 0) return [];
  const valid = value.filter((key): key is DashboardWidgetKey =>
    DASHBOARD_WIDGETS.some((widget) => widget.key === key),
  );
  return valid.length ? Array.from(new Set(valid)) : [...DEFAULT_DASHBOARD_WIDGETS];
}
