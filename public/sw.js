// Service worker: offline cache (network first) + Web Push notifications.
const CACHE = "feg-v2";
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== "GET" || url.pathname.startsWith("/admin") || url.pathname.startsWith("/api") || url.origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then((cache) => cache.put(req, c)); } return res; }).catch(() => caches.match(req).then((r) => r || caches.match("/"))));
});
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Amics del futbol amateur", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Amics del futbol amateur", { body: d.body || "", icon: d.icon || "/icons/icon-192.png", badge: d.badge || "/icons/icon-192.png", tag: d.tag, data: { url: d.url || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { for (const c of cs) { if ("focus" in c) { c.navigate(url); return c.focus(); } } return self.clients.openWindow(url); }));
});
