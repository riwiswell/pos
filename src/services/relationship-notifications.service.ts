import { supabase } from "@/integrations/supabase/client";
const db = supabase as any;

/** Rebuild future reminder jobs after the source relationships change. */
export async function syncRelationshipNotificationSchedule(): Promise<void> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error("Tu sesión ha caducado. Inicia sesión de nuevo.");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("notification_preferences")
    .eq("id", session.user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const relationshipsEnabled =
    (profile?.notification_preferences as Record<string, unknown> | null)?.relationships !== false;

  const response = await fetch("/api/notification-preferences", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: "Bearer " + session.access_token,
    },
    body: JSON.stringify({ relationships: relationshipsEnabled }),
  });

  if (!response.ok) {
    let reason = "";
    try {
      const body = await response.json() as { error?: string };
      reason = body.error || "";
    } catch {
      // Keep the general message when the Worker response isn't JSON.
    }
    throw new Error(reason || "No se pudieron actualizar los recordatorios de relaciones.");
  }
}
