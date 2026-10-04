import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { habitsService } from "@/services/habits.service";
import type { HabitCategoryInput, HabitInput } from "@/domain/types";

export const habitKeys = {
  categories: ["habit_categories"] as const,
  habits: (includeInactive: boolean) => ["habits", includeInactive ? "all" : "active"] as const,
  logs: (date: string) => ["habit_logs", date] as const,
  recent: ["habit_logs", "recent"] as const,
  range: (start: string, end: string) => ["habit_logs", "range", start, end] as const,
};

function onError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ocurrió un error inesperado";
  toast.error(message);
}

export function useCategories() {
  return useQuery({ queryKey: habitKeys.categories, queryFn: habitsService.listCategories });
}

export function useHabits(includeInactive = false) {
  return useQuery({
    queryKey: habitKeys.habits(includeInactive),
    queryFn: () => habitsService.listHabits(includeInactive),
  });
}

export function useLogs(date: string) {
  return useQuery({
    queryKey: habitKeys.logs(date),
    queryFn: () => habitsService.listLogsByDate(date),
  });
}

/** Logs for a whole period, fetched in a single query. */
export function useLogsRange(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: habitKeys.range(start, end),
    queryFn: () => habitsService.listLogsInRange(start, end),
    enabled,
  });
}

export function useRecentLogs() {
  return useQuery({ queryKey: habitKeys.recent, queryFn: () => habitsService.recentLogs() });
}

export function useHabitMutations(date: string) {
  const qc = useQueryClient();

  const invalidateCategories = () => qc.invalidateQueries({ queryKey: habitKeys.categories });
  const invalidateHabits = () => qc.invalidateQueries({ queryKey: habitKeys.habits });
  const invalidateLogs = () => {
    void qc.invalidateQueries({ queryKey: habitKeys.logs(date) });
    void qc.invalidateQueries({ queryKey: habitKeys.recent });
  };

  const createCategory = useMutation({
    mutationFn: (vars: { input: HabitCategoryInput; position: number }) =>
      habitsService.createCategory(vars.input, vars.position),
    onSuccess: () => {
      void invalidateCategories();
      toast.success("Categoría creada");
    },
    onError,
  });

  const updateCategory = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<HabitCategoryInput & { position: number }> }) =>
      habitsService.updateCategory(vars.id, vars.patch),
    onSuccess: () => void invalidateCategories(),
    onError,
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => habitsService.deleteCategory(id),
    onSuccess: () => {
      void invalidateCategories();
      void invalidateHabits();
      toast.success("Categoría eliminada");
    },
    onError,
  });

  const reorderCategories = useMutation({
    mutationFn: (ordered: { id: string; position: number }[]) =>
      habitsService.reorderCategories(ordered),
    onSuccess: () => void invalidateCategories(),
    onError,
  });

  const createHabit = useMutation({
    mutationFn: (vars: { input: HabitInput; position: number }) =>
      habitsService.createHabit(vars.input, vars.position),
    onSuccess: () => {
      void invalidateHabits();
      toast.success("Hábito creado");
    },
    onError,
  });

  const updateHabit = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<HabitInput & { position: number; active: boolean }> }) =>
      habitsService.updateHabit(vars.id, vars.patch),
    onSuccess: () => void invalidateHabits(),
    onError,
  });

  const deleteHabit = useMutation({
    mutationFn: (id: string) => habitsService.deleteHabit(id),
    onSuccess: () => {
      void invalidateHabits();
      invalidateLogs();
      toast.success("Hábito eliminado");
    },
    onError,
  });

  const reorderHabits = useMutation({
    mutationFn: (ordered: { id: string; position: number }[]) =>
      habitsService.reorderHabits(ordered),
    onSuccess: () => void invalidateHabits(),
    onError,
  });

  const saveLog = useMutation({
    mutationFn: (vars: {
      habitId: string;
      patch: { completed?: boolean; value?: number; note?: string | null };
    }) => habitsService.saveLog(vars.habitId, date, vars.patch),
    onSuccess: () => invalidateLogs(),
    onError,
  });

  return {
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    createHabit,
    updateHabit,
    deleteHabit,
    reorderHabits,
    saveLog,
  };
}