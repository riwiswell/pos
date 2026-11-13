import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";

import { habitsService } from "@/services/habits.service";
import type { HabitCategoryInput, HabitInput, HabitLog } from "@/domain/types";

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

export function useHabits(includeInactive = false, enabled = true) {
  return useQuery({
    queryKey: habitKeys.habits(includeInactive),
    queryFn: () => habitsService.listHabits(includeInactive),
    enabled,
  });
}

export function useLogs(date: string, enabled = true) {
  return useQuery({
    queryKey: habitKeys.logs(date),
    queryFn: () => habitsService.listLogsByDate(date),
    enabled,
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
  const logWriteSequence = useRef(0);
  const latestLogWrite = useRef(new Map<string, number>());
  const confirmedLogByHabit = useRef(new Map<string, HabitLog | null>());
  const logWriteQueue = useRef(new Map<string, Promise<HabitLog>>());

  const invalidateCategories = () => qc.invalidateQueries({ queryKey: habitKeys.categories });
  const invalidateHabits = () => qc.invalidateQueries({ queryKey: ["habits"] });
  const invalidateLogs = () => {
    void qc.invalidateQueries({ queryKey: habitKeys.logs(date) });
    void qc.invalidateQueries({ queryKey: habitKeys.recent });
    void qc.invalidateQueries({ queryKey: ["habit_logs", "range"] });
  };
  const invalidateLifeGraph = () => {
    void qc.invalidateQueries({ queryKey: ["lg", "life_links"] });
    void qc.invalidateQueries({ queryKey: ["lg", "life_events"] });
    for (const key of ["gamification_profiles", "gamification_xp_events", "gamification_achievements", "gamification_challenges"]) {
      void qc.invalidateQueries({ queryKey: ["lg", key] });
    }
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
    }) => {
      // Serialize quick repeated clicks so the last value is also the last DB write.
      const previousWrite = logWriteQueue.current.get(vars.habitId);
      const write = previousWrite
        ? previousWrite.catch(() => undefined).then(() => habitsService.saveLog(vars.habitId, date, vars.patch))
        : habitsService.saveLog(vars.habitId, date, vars.patch);
      logWriteQueue.current.set(vars.habitId, write);
      void write.finally(() => {
        if (logWriteQueue.current.get(vars.habitId) === write) logWriteQueue.current.delete(vars.habitId);
      }).catch(() => undefined);
      return write;
    },
    onMutate: (vars) => {
      const key = habitKeys.logs(date);
      const sequence = ++logWriteSequence.current;
      latestLogWrite.current.set(vars.habitId, sequence);

      const current = qc.getQueryData<HabitLog[]>(key) ?? [];
      const previous = current.find((log) => log.habit_id === vars.habitId);
      if (!confirmedLogByHabit.current.has(vars.habitId)) {
        confirmedLogByHabit.current.set(vars.habitId, previous ?? null);
      }

      void qc.cancelQueries({ queryKey: key });
      const now = new Date().toISOString();
      const optimistic: HabitLog = {
        id: previous?.id ?? "optimistic-" + vars.habitId + "-" + sequence,
        user_id: previous?.user_id ?? "",
        habit_id: vars.habitId,
        date,
        completed: vars.patch.completed ?? previous?.completed ?? false,
        value: vars.patch.value ?? previous?.value ?? 0,
        note: vars.patch.note !== undefined ? vars.patch.note : previous?.note ?? null,
        created_at: previous?.created_at ?? now,
        updated_at: now,
      };
      qc.setQueryData<HabitLog[]>(key, (logs) => [
        ...(logs ?? []).filter((log) => log.habit_id !== vars.habitId),
        optimistic,
      ]);

      return { sequence };
    },
    onError: (error, vars, context) => {
      if (context && latestLogWrite.current.get(vars.habitId) === context.sequence) {
        const confirmed = confirmedLogByHabit.current.get(vars.habitId) ?? null;
        qc.setQueryData<HabitLog[]>(habitKeys.logs(date), (logs) => [
          ...(logs ?? []).filter((log) => log.habit_id !== vars.habitId),
          ...(confirmed ? [confirmed] : []),
        ]);
        confirmedLogByHabit.current.delete(vars.habitId);
      }
      onError(error);
    },
    onSuccess: (saved, vars, context) => {
      if (context && latestLogWrite.current.get(vars.habitId) === context.sequence) {
        qc.setQueryData<HabitLog[]>(habitKeys.logs(date), (logs) => [
          ...(logs ?? []).filter((log) => log.habit_id !== vars.habitId),
          saved,
        ]);
        confirmedLogByHabit.current.set(vars.habitId, saved);
      }
      void qc.invalidateQueries({ queryKey: habitKeys.recent });
      void qc.invalidateQueries({ queryKey: ["habit_logs", "range"] });
      invalidateLifeGraph();
    },
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
