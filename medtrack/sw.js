/* Offline-Cache: Die App soll auch ohne Netz funktionieren. */
const CACHE = 'medtrack-v2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './icons/icon.svg',
  './js/app.js', './js/store.js', './js/model.js',
  './js/ui/dom.js', './js/ui/chart.js',
  './js/pk/engine.js', './js/pk/compounds.js',
  './js/safety/labs.js', './js/safety/advice.js',
  './js/views/dashboard.js', './js/views/meds.js', './js/views/curve.js',
  './js/views/labs.js', './js/views/body.js', './js/views/gym.js',
  './js/views/safety.js', './js/views/library.js', './js/views/settings.js',
  './js/reminders.js', './js/photos.js',
  './js/data/exercises.js', './js/gym/stats.js', './js/body/metrics.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});

/** Tippt jemand auf eine Benachrichtigung, soll die App in den Vordergrund. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const client of list) if ('focus' in client) return client.focus();
    return self.clients.openWindow('./index.html');
  }));
});
