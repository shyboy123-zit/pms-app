/* PMS Service Worker — Web Push 수신 + 알림 클릭 처리 */
/* 채팅 알림 전용. 정교한 오프라인 캐싱은 하지 않음(앱은 온라인 전제). */

const SW_VERSION = 'pms-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 설치 가능(installability)을 위한 최소 fetch 핸들러 — 네트워크 그대로 통과
self.addEventListener('fetch', (event) => {
  // pass-through (no caching)
});

// 푸시 수신 → 알림 표시
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: '새 메시지', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || '새 메시지';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'pms-chat',        // 같은 tag면 알림 갱신(쌓이지 않음)
    renotify: true,                      // 같은 tag여도 다시 소리/진동
    vibrate: [120, 60, 120],
    data: { url: data.url || '/chat' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭 → 앱 열기(이미 열려 있으면 포커스 + 채팅으로 이동)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/chat';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            try { client.navigate(targetUrl); } catch (e) { /* ignore */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
