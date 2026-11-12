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
      const user_id = await currentUserId();
      const withIcon = await supabase
        .from("hydration_entries")
        .select("id,user_id,consumed_on,consumed_at,beverage_type,icon,amount_ml,note,created_at")
        .eq("user_id", user_id)
        .eq("consumed_on", date)
        .order("consumed_at", { ascending: true });

      if (!withIcon.error) return (withIcon.data ?? []) as HydrationEntry[];

      // The icon column is an optional presentation enhancement. Older
      // installations may not have applied the icon migration yet; that must
      // not make existing hydration records disappear or break the summary.
      const missingOptionalIcon =
        ["42703", "PGRST204"].includes(String(withIcon.error.code ?? "")) &&
        /icon/i.test(withIcon.error.message ?? "");
      if (!missingOptionalIcon) throw withIcon.error;

      const legacy = await supabase
        .from("hydration_entries")
        .select("id,user_id,consumed_on,consumed_at,beverage_type,amount_ml,note,created_at")
        .eq("user_id", user_id)
        .eq("consumed_on", date)
        .order("consumed_at", { ascending: true });
      if (legacy.error) throw legacy.error;
      return (legacy.data ?? []).map((entry) => ({ ...entry, icon: null })) as HydrationEntry[];
    },
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useHydrationMutations(date: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: hydrationKeys.day(date) });
  };
  const create = useMutation({
    mutationFn: async (input: { beverage_type: BeverageType; amount_ml: number; note?: string | null; icon?: string | null }) => {
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
          icon: input.icon ?? null,
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

  const update = useMutation({
    mutationFn: async (input: {
      id: string;
      beverage_type: BeverageType;
      icon?: string | null;
      amount_ml: number;
      note?: string | null;
      consumed_time: string;
    }) => {
      if (!Number.isInteger(input.amount_ml) || input.amount_ml < 1 || input.amount_ml > 5000) {
        throw new Error("La cantidad debe estar entre 1 y 5000 ml.");
      }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.consumed_time)) {
        throw new Error("La hora del registro no es válida.");
      }
      const user_id = await currentUserId();
      const consumed_at = new Date(date + "T" + input.consumed_time).toISOString();
      const { data, error } = await supabase
        .from("hydration_entries")
        .update({
          beverage_type: input.beverage_type,
          icon: input.icon ?? null,
          amount_ml: input.amount_ml,
          note: input.note?.trim() || null,
          consumed_at,
        })
        .eq("id", input.id)
        .eq("user_id", user_id)
        .eq("consumed_on", date)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No se encontró ese registro de hidratación de este día.");
      return input.id;
    },
    onSuccess: () => {
      refresh();
      toast.success("Registro de hidratación actualizado.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo actualizar el registro."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const user_id = await currentUserId();
      const { data, error } = await supabase
        .from("hydration_entries")
        .delete()
        .eq("id", id)
        .eq("user_id", user_id)
        .eq("consumed_on", date)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No se encontró ese registro de hidratación de este día.");
      return id;
    },
    onSuccess: () => {
      refresh();
      toast.success("Registro de hidratación eliminado.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo eliminar el registro."),
  });

  return { create, update, remove };
}
