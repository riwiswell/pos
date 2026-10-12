import { supabase } from "@/integrations/supabase/client";

const env = import.meta.env;

export type BackgroundPushStatus =
  | "subscribed"
  | "unsupported"
  | "permission-denied"
  | "missing-key"
  | "no-session"
  | "failed";

/**
 * Must be called in direct response to a user click because the browser may
 * display a notification permission prompt.
 */
export async function subscribeToBackgroundPush(): Promise<BackgroundPushStatus> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }

  const key = env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;
  if (!key) return "missing-key";

  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return "permission-denied";

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return "no-session";

  const applicationServerKey = urlBase64ToUint8Array(key) as BufferSource;
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  const response = await fetch("/api/push-subscription", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: "Bearer " + session.access_token,
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON(),
      expiration_time: subscription.expirationTime
        ? new Date(subscription.expirationTime).toISOString()
        : null,
    }),
  });

  return response.ok ? "subscribed" : "failed";
}

function urlBase64ToUint8Array(input: string) {
  const padding = "=".repeat((4 - (input.length % 4)) % 4);
  const raw = atob((input + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}
