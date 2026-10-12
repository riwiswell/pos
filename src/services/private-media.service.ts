import { supabase } from "@/integrations/supabase/client";

/**
 * Shared private-image storage.
 * The legacy bucket name is intentionally preserved so existing finance and
 * journal paths remain readable; new domains must depend on this service, not
 * on the finance domain.
 */
const LEGACY_PRIVATE_IMAGE_BUCKET = "finance-photos";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
  "image/heic", "image/heif",
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif"]);

export function validateImageFile(file: File): void {
  if (!file.size) throw new Error("El archivo está vacío.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("La imagen supera el límite de 20 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension) || (file.type && !ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase()))) {
    throw new Error("Formato no admitido. Usa JPG, PNG, WebP, GIF, AVIF o HEIC.");
  }
}

function assertOwnedPath(path: string, userId: string): void {
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/")[0] !== userId || path.split("/").length !== 2) {
    throw new Error("La ruta de la foto no pertenece a tu cuenta.");
  }
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("No hay sesión activa");
  return data.user.id;
}

export const privateMediaService = {
  async uploadPhoto(file: File): Promise<string> {
    validateImageFile(file);
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
    const userId = await currentUserId();
    assertOwnedPath(path, userId);
    const { data, error } = await supabase.storage
      .from(LEGACY_PRIVATE_IMAGE_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  async removePhoto(path: string): Promise<void> {
    const userId = await currentUserId();
    assertOwnedPath(path, userId);
    const { error } = await supabase.storage.from(LEGACY_PRIVATE_IMAGE_BUCKET).remove([path]);
    if (error) throw error;
  },
};
