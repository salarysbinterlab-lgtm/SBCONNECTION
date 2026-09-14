const CACHE_NAME = 'sb-connect-runtime-v3';
const BASE_URL = new URL('./', self.location.href);
// precache เฉพาะของที่จำเป็นต่อการเปิดแอปจริง ๆ
// วิดีโอ intro (257 KB) และ GIF (571 KB) ถูกเอาออก เพราะทำให้ทุกเครื่องต้องโหลดตั้งแต่ติดตั้ง
// ทั้งสองไฟล์ยังถูก cache อัตโนมัติจาก runtime cache ตอนผู้ใช้เปิดหน้าแรกครั้งแรกอยู่ดี
const APP_SHELL = [
  '',
  'offline.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png'
].map((path) => new URL(path, BASE_URL).toString());

// ไม่เก็บไฟล์ใหญ่เกินนี้ลง cache เพื่อไม่ให้กิน quota ของเบราว์เซอร์จนถูกล้างทั้งก้อน
const MAX_CACHEABLE_BYTES = 2 * 1024 * 1024;

function isCacheable(response) {
  if (!response || !response.ok || response.type === 'opaque') return false;
  const length = Number(response.headers.get('content-length') || 0);
  return !(length && length > MAX_CACHEABLE_BYTES);
}
const OFFLINE_URL = new URL('offline.html', BASE_URL).toString();

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isCacheable(response)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
