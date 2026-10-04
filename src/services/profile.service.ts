import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/domain/types";

const MEDIA_BUCKET = "profile-media";

export type ProfilePatch = Partial<
  Pick<Profile, "full_name" | "display_name" | "avatar_url" | "background_url" | "accent_color">
>;

/** Data service for the user profile. UI never talks to the backend directly. */
export const profileService = {
  async get(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  },

  async upsert(userId: string, patch: ProfilePatch) {
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...patch }, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  },

  /** Uploads an image to the private profile-media bucket and returns its path. */
  async uploadMedia(userId: string, file: File, kind: "avatar" | "background"): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    return path;
  },

  /** Resolves a stored value: absolute URLs pass through, storage paths get signed. */
  async mediaUrl(value: string | null): Promise<string | null> {
    if (!value) return null;
    if (/^https?:\/\//.test(value)) return value;
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(value, 60 * 60 * 8);
    if (error) return null;
    return data?.signedUrl ?? null;
  },
};