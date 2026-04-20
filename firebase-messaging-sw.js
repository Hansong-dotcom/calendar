/*
  가족 캘린더 Service Worker v20260421

  서버에서 webpush.notification으로 전송하면
  브라우저가 자동으로 알림을 1번 표시한다.
  
  따라서 SW에서는 showNotification을 호출하지 않는다.
  이 SW는 알림 클릭 처리를 위해서만 존재한다.
*/

// 알림 클릭 → 캘린더 열기
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
