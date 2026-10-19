/* Phone notifications: loaded into the generated service worker (workbox importScripts). */
const CALL_VIBRATION = [500, 250, 500, 250, 500, 250, 500];

/** Closes the alerts already showing for one call (it re-alerts every few seconds while ringing). */
function closeCallAlerts(callId) {
  if (!callId) return Promise.resolve();
  return self.registration.getNotifications().then((list) => {
    list.forEach((n) => {
      if (n.data && n.data.callId === callId) n.close();
    });
  }).catch(() => undefined);
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Kano Kaftan";
  const isCall = data.category === "call";
  // Android/desktop Chrome can put buttons on a notification; iPhone/iPad (and
  // Safari) can't, so there the whole notification is the "answer" tap.
  const canShowButtons = typeof Notification !== "undefined" && Notification.maxActions > 0;
  const callBody = canShowButtons ? "Answer or decline below" : "Tap to open the call — then Answer or Decline";
  event.waitUntil(
    (isCall ? closeCallAlerts(data.callId) : Promise.resolve()).then(() => self.registration.showNotification(title, {
      body: isCall ? callBody : data.body || "",
      icon: "/pwa-192x192.png",
      badge: "/notification-badge.png",
      tag: data.tag,
      data: { url: data.url || "/", callId: data.callId || null },
      // Incoming calls stay on screen and buzz until answered or dismissed.
      requireInteraction: isCall,
      vibrate: isCall ? CALL_VIBRATION : undefined,
      renotify: isCall,
      // Buttons on the notification (Android). iPhone shows a plain notification.
      actions: isCall && data.callId && canShowButtons
        ? [
            { action: "answer", title: "Answer" },
            { action: "decline", title: "Decline" },
          ]
        : [],
    }))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const info = event.notification.data || {};
  if (info.callId) event.waitUntil(closeCallAlerts(info.callId));
  // Decline: just stop the alert; the call rings out on the caller's side and is logged as missed.
  if (event.action === "decline") return;

  const url = new URL(info.url || "/", self.location.origin);
  if (info.callId) url.searchParams.set(event.action === "answer" ? "answer_call" : "ring_call", info.callId);
  const target = url.href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((focused) => (focused && "navigate" in focused ? focused.navigate(target) : focused));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
