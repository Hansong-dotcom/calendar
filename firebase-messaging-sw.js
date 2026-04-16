/*
  가족 캘린더 Service Worker v20260416
  
  Firebase Messaging SDK를 SW에서 제거하고,
  순수 Web Push API로 알림을 1번만 표시한다.
  
  FCM 토큰 관리는 프론트엔드(index.html)의 Firebase SDK가 담당하므로
  SW에서는 push 수신 + 알림 표시만 하면 된다.
*/

// push 이벤트 수신 → 알림 1번 표시
self.addEventListener("push", (event) => {
  let title = "가족 캘린더";
  let body = "";
  let icon = "/calendar/icon-192.png";

  try {
    const payload = event.data?.json();
    if (payload) {
      const noti = payload.notification || {};
      const data = payload.data || {};
      title = noti.title || data.title || title;
      body  = noti.body  || data.body  || body;
      icon  = noti.icon  || icon;
    }
  } catch (e) {
    const text = event.data?.text();
    if (text) body = text;
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/calendar/icon-192.png",
    })
  );
});

// 알림 클릭 → 캘린더 열기
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/calendar") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/calendar/");
      }
    })
  );
});
