// Service worker tối thiểu — chỉ để trình duyệt cho phép "Cài đặt ứng dụng" (PWA).
//
// ponytail: CỐ TÌNH không cache gì cả. App lấy toàn bộ dữ liệu từ Supabase nên
// vẫn cần mạng; cache thêm chỉ đổi lấy rủi ro nhân viên bị kẹt ở bản cũ.
// Đây là đánh đổi có trần rõ ràng: cần chạy offline thật (xem bảng lương khi
// mất mạng...) thì thay bằng vite-plugin-pwa (Workbox) — nó lo cache-busting
// theo hash file của Vite, đừng tự viết tay chỗ đó.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Dọn cache của các bản SW cũ (nếu sau này có bản có cache rồi lại gỡ đi).
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Chrome yêu cầu phải có fetch handler thì mới hiện lời mời cài đặt.
// Không gọi respondWith() => trình duyệt xử lý như bình thường.
self.addEventListener('fetch', () => {});

// ─── Web Push ────────────────────────────────────────────────────────────────
// Payload do Edge Function notify-push gửi: { title, body, link, tag }.
self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (e) {
    d = { title: 'TD Games', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'TD Games', {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag, // trùng tag => thay thế, không dồn đống cùng 1 thông báo
      data: { link: d.link || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Đang mở app rồi thì điều hướng tab cũ, đừng mở thêm cửa sổ.
      for (const c of list) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(link).catch(() => {});
          return c.focus();
        }
      }
      return clients.openWindow(link);
    })
  );
});
