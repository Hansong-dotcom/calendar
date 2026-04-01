importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyBZbMt-2k65C5fVPdGHtF_fa1Lw3CDZj5Y",
  authDomain:        "hansong2ne-calendar.firebaseapp.com",
  databaseURL:       "https://hansong2ne-calendar-default-rtdb.firebaseio.com",
  projectId:         "hansong2ne-calendar",
  storageBucket:     "hansong2ne-calendar.firebasestorage.app",
  messagingSenderId: "737884329068",
  appId:             "1:737884329068:web:8a274de25a45d71385b449"
});

const messaging = firebase.messaging();

// 백그라운드 알림 수신 (앱이 닫혀있을 때)
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  });
});