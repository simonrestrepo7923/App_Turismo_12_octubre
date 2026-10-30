import type { LatLng } from '../types';

/**
 * Utilidades geográficas sobre coordenadas reales (WGS84).
 * Las distancias usan la fórmula de Haversine; para proyectar sobre un trazado se
 * usa una aproximación equirectangular local, precisa a la escala de un barrio.
 */

/** Centro aproximado de los recorridos en la Comuna 6 (Doce de Octubre, Medellín). */
export const BARRIO_CENTER: LatLng = { lat: 6.301, lng: -75.5806 };

/** Zona que cubre los recorridos (también georreferencia el plano ilustrado sin conexión). */
export const BARRIO_BOUNDS = {
  north: 6.3055,
  south: 6.2935,
  west: -75.5869,
  east: -75.5739,
};

/**
 * Rectángulo aproximado del departamento de Antioquia. Dentro de él no se ofrece simular
 * la ubicación: se usa siempre el GPS real. (Es un rectángulo, así que también incluye
 * franjas de departamentos vecinos.)
 */
export const ANTIOQUIA_BOUNDS = { north: 8.88, south: 5.42, west: -77.13, east: -73.88 };

export function isInsideAntioquia(p: LatLng): boolean {
  const b = ANTIOQUIA_BOUNDS;
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
}

/** Más allá de esta distancia el visitante se considera «fuera del barrio». */
export const BARRIO_RADIUS_M = 2500;

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rumbo inicial de `a` hacia `b` en grados (0 = norte, 90 = oriente). */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const DIRECTIONS = ['norte', 'nororiente', 'oriente', 'suroriente', 'sur', 'suroccidente', 'occidente', 'noroccidente'];

export function cardinalFromBearing(deg: number): string {
  return DIRECTIONS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export function isInsideBarrio(p: LatLng, radius = BARRIO_RADIUS_M): boolean {
  return haversineMeters(p, BARRIO_CENTER) <= radius;
}

export function isValidLatLng(p: Partial<LatLng> | null | undefined): p is LatLng {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat!) <= 90 && Math.abs(p.lng!) <= 180;
}

export function polylineLength(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineMeters(path[i - 1], path[i]);
  return total;
}

/** Proyección local en metros respecto a un origen (suficiente para distancias de barrio). */
function toLocal(origin: LatLng, p: LatLng) {
  const x = toRad(p.lng - origin.lng) * Math.cos(toRad(origin.lat)) * R;
  const y = toRad(p.lat - origin.lat) * R;
  return { x, y };
}

export interface PathProgress {
  /** Metros recorridos sobre el trazado hasta el punto más cercano. */
  along: number;
  /** Metros que faltan hasta el final del trazado. */
  remaining: number;
  /** Distancia perpendicular del punto al trazado (para detectar desvíos). */
  offset: number;
  /** Punto del trazado más cercano. */
  snapped: LatLng;
}

/** Ubica una posición sobre un trazado: cuánto se ha avanzado, cuánto falta y qué tan lejos está. */
export function progressAlongPath(path: LatLng[], p: LatLng): PathProgress {
  if (path.length === 0) return { along: 0, remaining: 0, offset: 0, snapped: p };
  if (path.length === 1) {
    const d = haversineMeters(path[0], p);
    return { along: 0, remaining: d, offset: d, snapped: path[0] };
  }
  let best = { along: 0, offset: Infinity, snapped: path[0] };
  let cumulative = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const segLen = haversineMeters(a, b);
    const pb = toLocal(a, b);
    const pp = toLocal(a, p);
    const len2 = pb.x * pb.x + pb.y * pb.y;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (pp.x * pb.x + pp.y * pb.y) / len2));
    const proj = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    const offset = haversineMeters(proj, p);
    if (offset < best.offset) best = { along: cumulative + segLen * t, offset, snapped: proj };
    cumulative += segLen;
  }
  return { along: best.along, remaining: Math.max(0, cumulative - best.along), offset: best.offset, snapped: best.snapped };
}

/** Punto ubicado a `meters` desde el inicio del trazado (para simular una caminata). */
export function pointAlongPath(path: LatLng[], meters: number): LatLng {
  if (path.length === 0) throw new Error('Trazado vacío');
  let remaining = Math.max(0, meters);
  for (let i = 1; i < path.length; i++) {
    const seg = haversineMeters(path[i - 1], path[i]);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return {
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
      };
    }
    remaining -= seg;
  }
  return { ...path[path.length - 1] };
}

/** Recuadro que contiene todas las coordenadas. */
export function boundsOf(points: LatLng[]): { south: number; west: number; north: number; east: number } | null {
  if (points.length === 0) return null;
  return {
    south: Math.min(...points.map((p) => p.lat)),
    north: Math.max(...points.map((p) => p.lat)),
    west: Math.min(...points.map((p) => p.lng)),
    east: Math.max(...points.map((p) => p.lng)),
  };
}

/** Velocidad peatonal promedio en ladera (≈ 4,2 km/h). */
export const WALK_SPEED_M_PER_MIN = 70;

export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_SPEED_M_PER_MIN));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.max(0, Math.round(meters / 10) * 10)} m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(meters / 1000).toLocaleString('es-CO')} km`;
}
