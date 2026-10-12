// Personal OS service worker: displays server-sent push notifications and handles clicks.
// It intentionally does not cache or intercept application requests.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const rawData = payload && typeof payload.data === "object" && payload.data !== null
    ? payload.data
    : {};
  const candidateUrl = rawData.url || payload.url || "/inicio";
  let safeUrl = "/inicio";
  try {
    const parsed = new URL(candidateUrl, self.location.origin);
    if (parsed.origin === self.location.origin) safeUrl = parsed.pathname + parsed.search + parsed.hash;
  } catch {
    // Fall back to the app home when the supplied URL is malformed.
  }

  const options = {
    body: typeof payload.body === "string" ? payload.body : "Tienes un recordatorio pendiente.",
    tag: typeof payload.tag === "string" ? payload.tag : "personal-os",
    icon: "/favicon.ico",
    data: { ...rawData, url: safeUrl },
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(
      typeof payload.title === "string" && payload.title ? payload.title : "Personal OS",
      options,
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  const action = event.action || "open";
  const data = event.notification.data || {};
  const doseId = data.doseId;
  event.notification.close();

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    // Medication action buttons are handled by the open app, which owns auth/session state.
    if (doseId && (action === "take" || action === "snooze")) {
      if (all.length) {
        all[0].postMessage({ type: "medication-action", action, doseId });
        if ("focus" in all[0]) await all[0].focus();
      } else {
        await self.clients.openWindow(
          new URL("/salud?dose=" + encodeURIComponent(doseId) + "&action=" + encodeURIComponent(action), self.location.origin).href,
        );
      }
      return;
    }

    const targetUrl = new URL(data.url || "/inicio", self.location.origin).href;
    if (all.length) {
      const client = all[0];
      if ("navigate" in client && client.url !== targetUrl) await client.navigate(targetUrl);
      if ("focus" in client) await client.focus();
    } else {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
