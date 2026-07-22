// POL · ENTRENO — Service Worker v3.7.0
// Estrategia: cache-first para el shell de la app + fuentes.
// Las llamadas a api.github.com (backups) van siempre a red — nunca se cachean.

const CACHE = 'pol-entreno-v3.7.0';

const SHELL = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600&display=swap',
];

// ─── INSTALL: precargar shell ─────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: limpiar cachés antiguas ───────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // GitHub API → siempre red (backups y restauración en tiempo real)
  if (url.hostname === 'api.github.com') return;

  // Google Fonts → cache-first con fallback silencioso (la app funciona sin fuentes)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Shell (index.html y ./): cache-first + revalidación en background (stale-while-revalidate)
  // Garantiza apertura offline; la próxima carga con red actualiza la caché.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => null);

      return cached || networkFetch;
    })
  );
});
