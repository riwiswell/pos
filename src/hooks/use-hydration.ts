import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { BeverageType, HydrationEntry } from "@/domain/health";

export const hydrationKeys = {
  day: (date: string) => ["hydration_entries", date] as const,
};

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("No hay sesión activa");
  return data.user.id;
}

export function useHydrationEntries(date: string) {
  return useQuery({
    queryKey: hydrationKeys.day(date),
    queryFn: async (): Promise<HydrationEntry[]> => {
      const { data, error } = await supabase
        .from("hydration_entries")
        .select("*")
        .eq("consumed_on", date)
        .order("consumed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HydrationEntry[];
    },
    staleTime: 15_000,
  });
}

export function useHydrationMutations(date: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: hydrationKeys.day(date) });
  };
  const create = useMutation({
    mutationFn: async (input: { beverage_type: BeverageType; amount_ml: number; note?: string | null }) => {
      if (!Number.isInteger(input.amount_ml) || input.amount_ml < 1 || input.amount_ml > 5000) {
        throw new Error("La cantidad debe estar entre 1 y 5000 ml.");
      }
      const user_id = await currentUserId();
      const { data, error } = await supabase
        .from("hydration_entries")
        .insert({
          user_id,
          consumed_on: date,
          beverage_type: input.beverage_type,
          amount_ml: input.amount_ml,
          note: input.note?.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as HydrationEntry;
    },
    onSuccess: (entry) => {
      refresh();
      const labels: Record<BeverageType, string> = {
        water: "Agua",
        coffee: "Café",
        tea: "Té",
        milk: "Leche",
        other: "Bebida",
      };
      toast.success(labels[entry.beverage_type] + " registrado: " + entry.amount_ml + " ml");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo registrar la bebida."),
  });
  return { create };
}
