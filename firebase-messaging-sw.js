/*
  가족 캘린더 Service Worker v20260429

  서버에서 data-only payload로 전송.
  이 SW의 push 이벤트에서 showNotification을 정확히 1번 호출.
  Firebase SDK 없음 → 자동 알림 생성 없음 → 중복 없음.
*/

self.addEventListener("push", (event) => {
  let title = "가족 캘린더";
  let body = "";
  let icon = "/calendar/icon-192.png";

  if (event.data) {
    try {
      const payload = event.data.json();
      // FCM data-only: payload.data에 title, body 포함
      if (payload.data) {
        title = payload.data.title || title;
        body  = payload.data.body  || body;
        icon  = payload.data.icon  || icon;
      }
      // FCM notification fallback
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
      icon,
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
