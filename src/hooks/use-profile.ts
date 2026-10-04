import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { profileService, type ProfilePatch } from "@/services/profile.service";
import { useAuth } from "@/hooks/use-auth";

export const profileKeys = {
  profile: (userId: string | undefined) => ["profile", userId] as const,
  media: (value: string | null | undefined) => ["profile-media", value] as const,
};

/** Single source of truth for the signed-in user's profile. */
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileKeys.profile(user?.id),
    queryFn: () => profileService.get(user!.id),
    enabled: Boolean(user?.id),
  });
}

/** Turns a stored avatar/background value into a usable URL (signed if private). */
export function useProfileMediaUrl(value: string | null | undefined) {
  return useQuery({
    queryKey: profileKeys.media(value),
    queryFn: () => profileService.mediaUrl(value ?? null),
    enabled: Boolean(value),
    staleTime: 1000 * 60 * 30,
  });
}

export function useProfileMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["profile"] });
    void qc.invalidateQueries({ queryKey: ["profile-media"] });
  };

  const save = useMutation({
    mutationFn: (patch: ProfilePatch) => profileService.upsert(user!.id, patch),
    onSuccess: () => {
      invalidate();
      toast.success("Perfil actualizado");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "No pudimos guardar tu perfil"),
  });

  const uploadMedia = useMutation({
    mutationFn: (vars: { file: File; kind: "avatar" | "background" }) =>
      profileService.uploadMedia(user!.id, vars.file, vars.kind),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "No pudimos subir la imagen"),
  });

  return { save, uploadMedia };
}