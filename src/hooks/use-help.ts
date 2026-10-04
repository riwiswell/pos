import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

/** Single global switch for contextual help (profiles.help_enabled). */
export function useHelpEnabled() {
  const profile = useProfile();
  const data = profile.data as { help_enabled?: boolean } | null | undefined;
  return data?.help_enabled ?? true;
}

export function useSetHelpEnabled() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from("profiles").update({ help_enabled: enabled }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}