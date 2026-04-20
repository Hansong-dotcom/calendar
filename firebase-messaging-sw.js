/*
  가족 캘린더 Service Worker v20260420
  
  Firebase Messaging SDK 없이 순수 Web Push로 동작.
  서버에서 data-only payload로 전송 → 브라우저 자동 알림 없음 →
  이 SW에서 showNotification 1번만 호출 → 알림 정확히 1회.
*/

self.addEventListener("push", (event) => {
  let title = "가족 캘린더";
  let body = "";

  if (event.data) {
    try {
      const payload = event.data.json();
      // FCM data-only: { data: { title, body } }
      if (payload.data) {
        title = payload.data.title || title;
        body  = payload.data.body  || body;
      }
      // fallback: notification 형태
      if (payload.notification) {
        title = payload.notification.title || title;
        body  = payload.notification.body  || body;
      }
    } catch (e) {
      body = event.data.text() || "";
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/calendar/icon-192.png",
      badge: "/calendar/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((cls) => {
      for (const c of cls) {
        if (c.url.includes("/calendar") && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow("/calendar/");
    })
  );
});
