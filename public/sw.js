// Personal OS service worker: only handles medication notification actions.
// No fetch handler → it never caches or intercepts the app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  const action = event.action || "open";
  const doseId = event.notification.data && event.notification.data.doseId;
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (all.length) {
        all[0].postMessage({ type: "medication-action", action, doseId });
        if (action === "open" && "focus" in all[0]) await all[0].focus();
        return;
      }
      const url = `/salud?dose=${encodeURIComponent(doseId || "")}&action=${encodeURIComponent(action)}`;
      await self.clients.openWindow(url);
    })(),
  );
});