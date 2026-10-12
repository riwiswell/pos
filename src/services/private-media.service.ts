import { supabase } from "@/integrations/supabase/client";

/**
 * Shared private-image storage.
 * The legacy bucket name is intentionally preserved so existing finance and
 * journal paths remain readable; new domains must depend on this service, not
 * on the finance domain.
 */
const LEGACY_PRIVATE_IMAGE_BUCKET = "finance-photos";

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("No hay sesión activa");
  return data.user.id;
}

export const privateMediaService = {
  async uploadPhoto(file: File): Promise<string> {
    const userId = await currentUserId();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(LEGACY_PRIVATE_IMAGE_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    return path;
  },

  async photoUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(LEGACY_PRIVATE_IMAGE_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  async removePhoto(path: string): Promise<void> {
    const { error } = await supabase.storage.from(LEGACY_PRIVATE_IMAGE_BUCKET).remove([path]);
    if (error) throw error;
  },
};
