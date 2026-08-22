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
