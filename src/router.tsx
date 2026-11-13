import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function queryLabel(queryKey: readonly unknown[]): string {
  const [scope, resource] = queryKey;

  if (scope === "profile") return "tu perfil";
  if (scope === "profile-media") return "la imagen de tu perfil";
  if (scope === "medications") return "tus medicamentos";
  if (scope === "medication_doses") return "las dosis de medicamentos";
  if (scope === "hydration_entries") return "tus registros de bebidas";
  if (scope === "health_metrics") return "tus mediciones de salud";
  if (scope === "habits") return "tus hábitos";
  if (scope === "habit_categories") return "las categorías de hábitos";
  if (scope === "habit_logs") return "tu historial de hábitos";
  if (scope === "daily_focus") return "tu enfoque diario";
  if (scope === "daily-proactive-briefing") return "el análisis de tu día";
  if (scope === "lg" && typeof resource === "string") {
    const labels: Record<string, string> = {
      medical_appointments: "tus citas médicas",
      life_events: "tu historial de actividad",
      life_goals: "tus objetivos",
      gamification_profiles: "tu progreso de gamificación",
      gamification_xp_events: "el historial de puntos",
      gamification_achievements: "tus logros",
      gamification_challenges: "tus desafíos",
      notification_jobs: "tus recordatorios",
      learning_items: "tu biblioteca",
    };
    return labels[resource] ?? `los datos de ${resource.replaceAll("_", " ")}`;
  }

  return typeof scope === "string"
    ? `los datos de ${scope.replaceAll("_", " ")}`
    : "tus datos";
}

function queryErrorInfo(error: unknown) {
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    return {
      message: typeof value.message === "string" ? value.message : "Error de consulta sin mensaje",
      code: typeof value.code === "string" ? value.code : undefined,
      details: typeof value.details === "string" ? value.details : undefined,
      hint: typeof value.hint === "string" ? value.hint : undefined,
      status: typeof value.status === "number"
        ? value.status
        : typeof value.statusCode === "number"
          ? value.statusCode
          : undefined,
    };
  }

  return {
    message: error instanceof Error ? error.message : String(error ?? "Error desconocido"),
    code: undefined,
    details: undefined,
    hint: undefined,
    status: undefined,
  };
}

export const getRouter = () => {
  let lastQueryErrorToastAt = 0;
  const queryCache = new QueryCache({
    onError: (error, query) => {
      // Keep cached content visible on background-refetch errors. Only warn when
      // a query has no usable data to show, and coalesce simultaneous failures.
      if (query.state.data !== undefined || query.meta?.suppressErrorToast === true) return;

      const info = queryErrorInfo(error);
      const label = queryLabel(query.queryKey);
      // Keep the actionable Supabase/HTTP error in the browser console without
      // logging query parameters that could contain user identifiers or private data.
      console.error("[Personal OS] Error al cargar consulta", {
        query: label,
        message: info.message,
        code: info.code,
        details: info.details,
        hint: info.hint,
        status: info.status,
      });

      const now = Date.now();
      if (now - lastQueryErrorToastAt < 3_000) return;
      lastQueryErrorToastAt = now;

      const message = info.message.replace(/\\s+/g, " ").slice(0, 220);
      const code = info.code ? ` [${info.code}]` : "";
      toast.error("No se pudieron cargar los datos", {
        description: `Falló ${label}: ${message}${code}`,
        duration: 10_000,
        action: {
          label: "Reintentar",
          onClick: () => {
            void query.fetch().catch(() => undefined);
          },
        },
      });
    },
  });

  const queryClient = new QueryClient({
    queryCache,
    defaultOptions: {
      queries: {
        // Reuse cached data briefly; existing results stay visible during background refetches.
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Retrying a write automatically can duplicate a non-idempotent action.
        retry: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
