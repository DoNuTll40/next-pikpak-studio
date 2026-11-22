const CACHE_NAME = "pikpak-studio-static-v1";
const STATIC_ASSETS = [
  "/studio.svg",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/icon-maskable-512x512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/desktop-auth") ||
    url.pathname.startsWith("/login") ||
    url.pathname === "/sw.js"
  ) {
    return;
  }

  // Immutable Next.js build assets & app icons: cache-first
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    STATIC_ASSETS.includes(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
          }
          return response;
        });
      }),
    );
    return;
  }

  // Page navigations: always prefer live network so catalog & auth stay fresh
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          "<!doctype html><html lang='th'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no'><title>PikPak Studio</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#111522;color:#edf2ff;font-family:system-ui,sans-serif;text-align:center;padding:24px}button{margin-top:16px;padding:10px 18px;border:0;border-radius:10px;background:#3065f5;color:#fff;font-size:14px;cursor:pointer}</style></head><body><main><h2>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h2><p>กรุณาตรวจสอบเครือข่ายแล้วลองใหม่อีกครั้ง</p><button onclick='location.reload()'>ลองใหม่</button></main></body></html>",
          { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
        ),
      ),
    );
  }
});
