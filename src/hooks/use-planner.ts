import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { plannerService } from "@/services/planner.service";
import type { PlannerCategoryInput, PlannerItemInput } from "@/domain/planner";

export const plannerKeys = {
  categories: ["planner_categories"] as const,
  items: (date: string) => ["planner_items", date] as const,
};

function onError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ocurrió un error inesperado";
  toast.error(message);
}

export function usePlannerCategories() {
  return useQuery({
    queryKey: plannerKeys.categories,
    queryFn: plannerService.listCategories,
    staleTime: 60_000,
  });
}

export function usePlannerItems(date: string) {
  return useQuery({
    queryKey: plannerKeys.items(date),
    queryFn: () => plannerService.listByDate(date),
    staleTime: 15_000,
  });
}

export function usePlannerMutations(date: string) {
  const qc = useQueryClient();
  const invalidateItems = () => qc.invalidateQueries({ queryKey: plannerKeys.items(date) });
  const invalidateCategories = () => qc.invalidateQueries({ queryKey: plannerKeys.categories });

  const createCategory = useMutation({
    mutationFn: (input: PlannerCategoryInput) => plannerService.createCategory(input),
    onSuccess: () => {
      void invalidateCategories();
      toast.success("Categoría lista");
    },
    onError,
  });

  const updateCategory = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<PlannerCategoryInput> }) =>
      plannerService.updateCategory(vars.id, vars.patch),
    onSuccess: () => {
      void invalidateCategories();
      void invalidateItems();
    },
    onError,
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => plannerService.deleteCategory(id),
    onSuccess: () => {
      void invalidateCategories();
      void invalidateItems();
      toast.success("Categoría eliminada");
    },
    onError,
  });

  const createItem = useMutation({
    mutationFn: (input: PlannerItemInput) => plannerService.createItem(input),
    onSuccess: (item) => {
      void qc.invalidateQueries({ queryKey: plannerKeys.items(item.scheduled_on) });
      void invalidateItems();
      toast.success(item.type === "task" ? "Tarea creada" : "Evento creado");
    },
    onError,
  });

  const updateItem = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<PlannerItemInput> }) =>
      plannerService.updateItem(vars.id, vars.patch),
    onSuccess: (_data, vars) => {
      if (vars.patch.scheduled_on) {
        void qc.invalidateQueries({ queryKey: plannerKeys.items(vars.patch.scheduled_on) });
      }
      void invalidateItems();
      toast.success("Cambios guardados");
    },
    onError,
  });

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; done: boolean }) =>
      plannerService.setStatus(vars.id, vars.done),
    onSuccess: () => void invalidateItems(),
    onError,
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => plannerService.deleteItem(id),
    onSuccess: () => {
      void invalidateItems();
      toast.success("Elemento eliminado");
    },
    onError,
  });

  return { createCategory, updateCategory, deleteCategory, createItem, updateItem, setStatus, deleteItem };
}