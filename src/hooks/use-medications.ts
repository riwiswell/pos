import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { medicationsService } from "@/services/medications.service";
import type { DoseStatus, MedicationInput } from "@/domain/health";

export const medKeys = {
  all: ["medications"] as const,
  doses: (date: string) => ["medication_doses", date] as const,
  history: (from: string, to: string) => ["medication_history", from, to] as const,
};

function onError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Ocurrió un error inesperado");
}

export function useMedications() {
  return useQuery({ queryKey: medKeys.all, queryFn: medicationsService.list, staleTime: 30_000 });
}

export function useDoses(date: string) {
  return useQuery({
    queryKey: medKeys.doses(date),
    queryFn: () => medicationsService.dosesFor(date),
    staleTime: 15_000,
  });
}

export function useTakenCounts() {
  return useQuery({ queryKey: ["medication_taken_counts"], queryFn: medicationsService.takenCounts });
}

const WATER_KEY = "personal-os:med-water";
/** Last water amount the user picked; only a preselection, editable per dose. */
export function lastWater(): number {
  if (typeof window === "undefined") return 0.5;
  const n = Number(localStorage.getItem(WATER_KEY));
  return localStorage.getItem(WATER_KEY) !== null && Number.isFinite(n) ? n : 0.5;
}
function rememberWater(n: number) {
  localStorage.setItem(WATER_KEY, String(n));
}

export function useDoseHistory(from: string, to: string) {
  return useQuery({
    queryKey: medKeys.history(from, to),
    queryFn: () => medicationsService.history(from, to),
  });
}

export function useMedicationMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: medKeys.all });
    void qc.invalidateQueries({ queryKey: ["medication_doses"] });
    void qc.invalidateQueries({ queryKey: ["medication_history"] });
    void qc.invalidateQueries({ queryKey: ["medication_taken_counts"] });
  };

  const create = useMutation({
    mutationFn: (input: MedicationInput) => medicationsService.create(input),
    onSuccess: () => {
      refresh();
      toast.success("Medicamento guardado");
    },
    onError,
  });
  const update = useMutation({
    mutationFn: (v: { id: string; patch: Partial<MedicationInput> }) =>
      medicationsService.update(v.id, v.patch),
    onSuccess: () => {
      refresh();
      toast.success("Cambios guardados");
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => medicationsService.remove(id),
    onSuccess: () => {
      refresh();
      toast.success("Medicamento eliminado");
    },
    onError,
  });
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: DoseStatus; water?: number }) =>
      medicationsService.setStatus(v.id, v.status, v.status === "taken" ? (v.water ?? lastWater()) : undefined),
    onSuccess: refresh,
    onError,
  });
  const setWater = useMutation({
    mutationFn: (v: { id: string; glasses: number }) => {
      rememberWater(v.glasses);
      return medicationsService.setWater(v.id, v.glasses);
    },
    onSuccess: refresh,
    onError,
  });

  return { create, update, remove, setStatus, setWater };
}