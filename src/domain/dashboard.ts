export const DASHBOARD_WIDGETS = [
  { key: "planner", label: "Agenda del día", description: "Próximas tareas y eventos." },
  { key: "focus", label: "Enfoque del día", description: "Tu prioridad para la fecha seleccionada." },
  { key: "habits", label: "Resumen de hábitos", description: "Avance de hábitos y actividades." },
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number]["key"];
export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetKey[] = ["planner", "focus", "habits"];

export const HOME_DASHBOARD_WIDGETS = [
  { key: "weather", label: "Clima", description: "Condiciones y pronóstico de tu ciudad." },
  { key: "habits", label: "Hábitos del día", description: "Tu avance de hoy." },
  { key: "agenda", label: "Agenda", description: "Tareas y eventos de la fecha." },
  { key: "hydration", label: "Hidratación", description: "Agua y otros líquidos registrados." },
  { key: "diary", label: "Diario del día", description: "Ideas, pensamientos y capturas." },
  { key: "reading", label: "Lectura actual", description: "Progreso de tus libros." },
  { key: "games", label: "Juego actual", description: "El videojuego que tienes en curso." },
  { key: "activity", label: "Actividad reciente", description: "Tu historial conectado." },
  { key: "shared-challenges", label: "Retos compartidos", description: "Metas que avanzas con otras personas." },
] as const;

export type HomeDashboardWidgetKey = (typeof HOME_DASHBOARD_WIDGETS)[number]["key"];

export interface HomeDashboardLayout {
  order: HomeDashboardWidgetKey[];
  visible: HomeDashboardWidgetKey[];
}

/** A useful, compact first screen. The remaining cards can be enabled by each user. */
export const DEFAULT_HOME_DASHBOARD_ORDER: HomeDashboardWidgetKey[] = [
  "weather",
  "habits",
  "agenda",
  "hydration",
  "diary",
  "reading",
  "games",
  "activity",
  "shared-challenges",
];
export const DEFAULT_HOME_DASHBOARD_VISIBLE: HomeDashboardWidgetKey[] = [
  "weather",
  "habits",
  "agenda",
  "hydration",
  "diary",
];
export const DEFAULT_HOME_DASHBOARD_LAYOUT: HomeDashboardLayout = {
  order: [...DEFAULT_HOME_DASHBOARD_ORDER],
  visible: [...DEFAULT_HOME_DASHBOARD_VISIBLE],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Supports both the original array and the expanded per-user settings object.
 * The original three switches in Perfil continue to work without a migration.
 */
export function normalizeDashboardWidgets(value: unknown): DashboardWidgetKey[] {
  const stored = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.legacyWidgets)
      ? value.legacyWidgets
      : null;
  if (!stored) return [...DEFAULT_DASHBOARD_WIDGETS];
  if (stored.length === 0) return [];
  const valid = stored.filter((key): key is DashboardWidgetKey =>
    DASHBOARD_WIDGETS.some((widget) => widget.key === key),
  );
  return valid.length ? Array.from(new Set(valid)) : [...DEFAULT_DASHBOARD_WIDGETS];
}

/**
 * Existing profiles keep their explicit homeLayout choices. Profiles that still
 * have the legacy settings get five useful cards instead of all nine at once.
 */
export function normalizeHomeDashboardLayout(value: unknown): HomeDashboardLayout {
  if (isRecord(value) && isRecord(value.homeLayout)) {
    const saved = value.homeLayout;
    const requestedOrder = Array.isArray(saved.order) ? saved.order : [];
    const order = requestedOrder.filter((key): key is HomeDashboardWidgetKey =>
      HOME_DASHBOARD_WIDGETS.some((widget) => widget.key === key),
    );
    const completeOrder = [
      ...new Set([...order, ...DEFAULT_HOME_DASHBOARD_ORDER]),
    ];
    const requestedVisible = Array.isArray(saved.visible)
      ? saved.visible
      : DEFAULT_HOME_DASHBOARD_VISIBLE;
    const visible = Array.from(new Set(requestedVisible.filter((key): key is HomeDashboardWidgetKey =>
      HOME_DASHBOARD_WIDGETS.some((widget) => widget.key === key),
    )));
    // The previous release preselected every card. Treat that generated
    // nine-card setup as the old default (not a deliberate user selection)
    // and compact it once; manually selected subsets remain untouched.
    const compactVisible = visible.length === HOME_DASHBOARD_WIDGETS.length
      ? [...DEFAULT_HOME_DASHBOARD_VISIBLE]
      : visible;
    return { order: completeOrder, visible: compactVisible };
  }

  const legacy = normalizeDashboardWidgets(value);
  const visible = DEFAULT_HOME_DASHBOARD_VISIBLE.filter((key) => {
    if (key === "agenda") return legacy.includes("planner");
    if (key === "habits") return legacy.includes("habits");
    return true;
  });
  return { order: [...DEFAULT_HOME_DASHBOARD_ORDER], visible };
}

/** Preserve the old Perfil switches while saving the new Home arrangement. */
export function mergeDashboardSettings(
  currentValue: unknown,
  legacyWidgets: DashboardWidgetKey[],
  homeLayout?: HomeDashboardLayout,
) {
  return {
    legacyWidgets: [...legacyWidgets],
    homeLayout: homeLayout
      ? {
          order: [...homeLayout.order],
          visible: [...homeLayout.visible],
        }
      : normalizeHomeDashboardLayout(currentValue),
  };
}
