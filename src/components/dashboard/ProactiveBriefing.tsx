import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Sparkles } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  date: string;
}

export function ProactiveBriefing({ date }: Props) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["daily-proactive-briefing", user?.id, date],
    enabled: Boolean(user?.id),
    staleTime: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      const session = data.session;
      if (error || !session) throw new Error("Tu sesión no está disponible.");
      const response = await fetch("/api/assistant/briefing", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({ date }),
      });
      const result = (await response.json().catch(() => ({}))) as { briefing?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo analizar tu día.");
      if (!result.briefing) throw new Error("No hay una recomendación disponible.");
      return result.briefing;
    },
  });

  if (query.isLoading) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-300">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-amber-200" />
        POS está revisando tus tareas, citas y notas…
      </div>
    );
  }

  if (query.isError) {
    return (
      <p className="mt-3 text-xs text-slate-300/70">
        Hoy no pude completar el análisis automático de tus pendientes.
      </p>
    );
  }

  if (!query.data) return null;

  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-3 py-2.5 text-left">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-300/15 text-amber-200">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-amber-200">POS te sugiere</p>
        <p className="mt-0.5 text-sm leading-5 text-slate-100">{query.data}</p>
      </div>
    </div>
  );
}
