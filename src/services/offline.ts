import type { LatLng, PointOfInterest } from '../types';
import { CONFIG } from '../config';
import { boundsOf } from '../lib/geo';
import { getWalkingRoute } from './routing';

/**
 * Descarga de un recorrido para usarlo sin conexión (FICHA-001 escenario 2):
 * guarda el trazado de la ruta, las teselas del mapa de la zona y las fotos de
 * los puntos en la caché del navegador. El service worker las sirve después.
 */

export const TILE_CACHE = 'ruta12-tiles';
export const IMAGE_CACHE = 'ruta12-images';

// La política de OpenStreetMap prohíbe descargar más de 250 teselas para uso sin conexión.
const MAX_TILES = 120;

function tileXY(c: LatLng, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((c.lng + 180) / 360) * n);
  const latRad = (c.lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/** URLs de las teselas que cubren la zona (las mismas que pide el mapa). */
export function tileUrlsFor(coords: LatLng[], zooms = [15, 16, 17], paddingDeg = 0.0015): string[] {
  const b = boundsOf(coords);
  if (!b) return [];
  const subs = CONFIG.tileSubdomains.split('');
  const retina = (globalThis.devicePixelRatio ?? 1) > 1 ? '@2x' : '';
  const urls: string[] = [];
  for (const z of zooms) {
    const a = tileXY({ lat: b.north + paddingDeg, lng: b.west - paddingDeg }, z);
    const c = tileXY({ lat: b.south - paddingDeg, lng: b.east + paddingDeg }, z);
    for (let x = a.x; x <= c.x; x++) {
      for (let y = a.y; y <= c.y; y++) {
        const s = subs[Math.abs(x + y) % subs.length];
        urls.push(CONFIG.tileUrl.replace('{s}', s).replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)).replace('{r}', retina));
        if (urls.length >= MAX_TILES) return urls;
      }
    }
  }
  return urls;
}

export const offlineCacheAvailable = () => typeof caches !== 'undefined' && window.isSecureContext;

async function cacheAll(cacheName: string, urls: string[], mode: RequestMode): Promise<number> {
  const cache = await caches.open(cacheName);
  let saved = 0;
  // Descargas en pequeños lotes para no saturar la conexión del celular.
  for (let i = 0; i < urls.length; i += 6) {
    const batch = urls.slice(i, i + 6);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        if (await cache.match(url)) return true;
        const res = await fetch(url, { mode });
        if (res.ok || res.type === 'opaque') {
          await cache.put(url, res);
          return true;
        }
        return false;
      }),
    );
    saved += results.filter((r) => r.status === 'fulfilled' && r.value).length;
  }
  return saved;
}

export interface OfflineResult {
  tiles: number;
  images: number;
  route: 'calles' | 'aproximada' | 'ninguna';
}

export async function saveTourOffline(points: PointOfInterest[]): Promise<OfflineResult> {
  const coords = points.map((p) => p.coords);
  let route: OfflineResult['route'] = 'ninguna';
  if (coords.length >= 2) {
    const r = await getWalkingRoute(coords, { persist: true });
    route = r.source === 'osrm' ? 'calles' : 'aproximada';
  }
  if (!offlineCacheAvailable() || !navigator.onLine) return { tiles: 0, images: 0, route };
  const [tiles, images] = await Promise.all([
    cacheAll(TILE_CACHE, tileUrlsFor(coords), 'no-cors').catch(() => 0),
    cacheAll(IMAGE_CACHE, Array.from(new Set(points.flatMap((p) => p.images))), 'no-cors').catch(() => 0),
  ]);
  return { tiles, images, route };
}
