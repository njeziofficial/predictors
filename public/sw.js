// Octopus Prediction's service worker. It only handles push notifications (prediction
// reminders): it caches nothing, so every page and API call still comes live from the network.
// Registered from src/lib/push.ts.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// The backend sends { title, body, url, tag } (PushMessage in the backend's PushNotifications.cs).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Octopus Prediction";
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        // A newer reminder for the same week replaces the older one instead of stacking.
        tag: data.tag || undefined,
        renotify: !!data.tag,
        data: { url: data.url || "/" },
      });
      await updateAppBadge();
    })(),
  );
});

// The count on the installed app's icon, where the system lets the app set it (iPhone, computers):
// how many notifications are showing. Android's launcher counts them by itself.
async function updateAppBadge() {
  try {
    if (!self.navigator.setAppBadge) return;
    const shown = (await self.registration.getNotifications()).length;
    await (shown > 0 ? self.navigator.setAppBadge(shown) : self.navigator.clearAppBadge());
  } catch {
    // Not supported here.
  }
}

self.addEventListener("notificationclose", (event) => event.waitUntil(updateAppBadge()));

// Tapping opens the app on the notification's page, reusing an open tab or installed window.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
