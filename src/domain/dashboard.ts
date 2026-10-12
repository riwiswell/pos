export const DASHBOARD_WIDGETS = [
  { key: "planner", label: "Agenda del día", description: "Próximas tareas y eventos." },
  { key: "focus", label: "Enfoque del día", description: "Tu prioridad para la fecha seleccionada." },
  { key: "habits", label: "Resumen de hábitos", description: "Avance de hábitos y actividades." },
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number]["key"];
export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetKey[] = ["planner", "focus", "habits"];

/**
 * Normalize saved preferences from previous versions without silently enabling
 * nonexistent widgets. At least one real block stays enabled so a new profile never opens to an accidentally empty home.
 */
export function normalizeDashboardWidgets(value: unknown): DashboardWidgetKey[] {
  if (!Array.isArray(value) || value.length === 0) return [...DEFAULT_DASHBOARD_WIDGETS];
  const valid = value.filter((key): key is DashboardWidgetKey =>
    DASHBOARD_WIDGETS.some((widget) => widget.key === key),
  );
  return valid.length ? Array.from(new Set(valid)) : [...DEFAULT_DASHBOARD_WIDGETS];
}
