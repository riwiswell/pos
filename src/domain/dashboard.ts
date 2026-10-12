export const DASHBOARD_WIDGETS = [
  { key: "planner", label: "Agenda del día", description: "Próximas tareas y eventos." },
  { key: "focus", label: "Enfoque del día", description: "Tu prioridad para la fecha seleccionada." },
  { key: "habits", label: "Resumen de hábitos", description: "Avance de hábitos y actividades." },
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number]["key"];
export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetKey[] = ["planner", "focus", "habits"];

/**
 * Older profiles and newly created profiles are initialized by the migration.
 * Once a user explicitly saves an empty list, respect that choice and let Home
 * show its clean empty state instead of silently turning disabled widgets back on.
 */
export function normalizeDashboardWidgets(value: unknown): DashboardWidgetKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_DASHBOARD_WIDGETS];
  if (value.length === 0) return [];
  const valid = value.filter((key): key is DashboardWidgetKey =>
    DASHBOARD_WIDGETS.some((widget) => widget.key === key),
  );
  return valid.length ? Array.from(new Set(valid)) : [...DEFAULT_DASHBOARD_WIDGETS];
}
