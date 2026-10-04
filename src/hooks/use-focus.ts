import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { focusService } from "@/services/focus.service";
import type { DailyFocusInput } from "@/domain/focus";

export const focusKeys = {
  byDate: (date: string) => ["daily_focus", date] as const,
};

function onError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ocurrió un error inesperado";
  toast.error(message);
}

export function useDailyFocus(date: string) {
  return useQuery({
    queryKey: focusKeys.byDate(date),
    queryFn: () => focusService.getByDate(date),
    staleTime: 15_000,
  });
}

export function useDailyFocusMutations(date: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: focusKeys.byDate(date) });

  const setFocus = useMutation({
    mutationFn: (input: DailyFocusInput) => focusService.setFocus(input),
    onSuccess: () => {
      void invalidate();
      toast.success("Enfoque guardado");
    },
    onError,
  });

  const clearFocus = useMutation({
    mutationFn: () => focusService.clear(date),
    onSuccess: () => {
      void invalidate();
      toast.success("Enfoque eliminado");
    },
    onError,
  });

  return { setFocus, clearFocus };
}