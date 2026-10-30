/* Service worker de Ruta Doce de Octubre (generado al compilar; no editar en dist/). */
const VERSION = '__VERSION__';
const SHELL = `ruta12-shell-${VERSION}`;
const TILES = 'ruta12-tiles';
const IMAGES = 'ruta12-images';
const FONTS = 'ruta12-fonts';
const ASSETS = __ASSETS__;
const FONT_CSS = __FONT_CSS__;

/** Guarda las hojas de estilo de Google Fonts y los archivos de fuente que referencian. */
async function cacheFonts() {
  const cache = await caches.open(FONTS);
  for (const cssUrl of FONT_CSS) {
    try {
      const res = await fetch(cssUrl, { mode: 'cors' });
      if (!res.ok) continue;
      const css = await res.clone().text();
      await cache.put(cssUrl, res);
      const files = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
      await Promise.all(files.map((f) => fetch(f, { mode: 'cors' }).then((r) => r.ok && cache.put(f, r)).catch(() => undefined)));
    } catch {
      // Sin conexión durante la instalación: se reintentará al usar la app.
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([caches.open(SHELL).then((c) => c.addAll(ASSETS)), cacheFonts()]));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ruta12-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k);
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') {
    cache.put(request, res.clone()).then(() => max && trim(cacheName, max));
  }
  return res;
}

async function staleWhileRevalidate(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreVary: true });
  const network = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone()).then(() => max && trim(cacheName, max));
      return res;
    })
    .catch(() => hit);
  return hit || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Navegación: primero la red; sin conexión, la app guardada.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html', { ignoreSearch: true })));
    return;
  }
  // Archivos de la app (con hash en el nombre): primero la caché.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL));
    return;
  }
  // Teselas del mapa.
  if (/basemaps\.cartocdn\.com|tile\.openstreetmap\.org/.test(url.hostname)) {
    event.respondWith(cacheFirst(request, TILES, 1500));
    return;
  }
  // Tipografías e íconos.
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, FONTS, 40));
    return;
  }
  // Fotografías.
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, IMAGES, 300));
  }
  // El servicio de rutas siempre va a la red (la app guarda sus propias rutas).
});
