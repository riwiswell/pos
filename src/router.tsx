import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  let lastQueryErrorToastAt = 0;
  const queryCache = new QueryCache({
    onError: (_error, query) => {
      // Keep cached content visible on background-refetch errors. Only warn when
      // a query has no usable data to show, and coalesce simultaneous failures.
      if (query.state.data !== undefined || query.meta?.suppressErrorToast === true) return;
      const now = Date.now();
      if (now - lastQueryErrorToastAt < 3_000) return;
      lastQueryErrorToastAt = now;
      toast.error("No se pudieron cargar los datos", {
        description: "Comprueba la conexión e inténtalo de nuevo. No se ha confirmado ningún cambio.",
      });
    },
    onSuccess: (_data, query) => {
      // A later successful fetch is allowed to report a future failure again.
      void query;
    },
  });
  const queryClient = new QueryClient({
    queryCache,
    defaultOptions: {
      queries: {
        // Screens already invalidate affected keys after writes. Reuse fresh data
        // briefly to avoid redundant Supabase round-trips during navigation.
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